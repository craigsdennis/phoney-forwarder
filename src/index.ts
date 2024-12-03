import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { Hono } from 'hono';

import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { map, z } from 'zod';
import { workersUrl } from 'twilio/lib/jwt/taskrouter/util';

const app = new Hono<{ Bindings: Env }>();

type ForwarderParams = {
	content: string;
	defaultLocation: string;
	notificationUrl: string;
};

export class ForwarderWorkflow extends WorkflowEntrypoint<Env, ForwarderParams> {
	async run(event: WorkflowEvent<ForwarderParams>, step: WorkflowStep) {
		const { content, defaultLocation, notificationUrl } = event.payload;
		const extractedData = await step.do('Extract Restaurant Information', async () => {
			const openai = new OpenAI({
				apiKey: this.env.OPENAI_API_KEY,
			});
			const RestaurantInfo = z.object({
				name: z.string(),
				location: z.string(),
			});
			const completion = await openai.beta.chat.completions.parse({
				model: 'gpt-4o',
				messages: [
					{ role: 'system', content: `Extract the restaurant information. If you cannot extract the location use "${defaultLocation}"` },
					{ role: 'user', content },
				],
				response_format: zodResponseFormat(RestaurantInfo, 'restaurant'),
			});

			const restaurant = completion.choices[0].message.parsed;
			return restaurant;
		});
		if (extractedData === null) {
			return { success: false };
		}
		const restaurantInfo = await step.do('Lookup Restaurant Details', async () => {
			const phoneUtil = PhoneNumberUtil.getInstance();
			const textQuery = `${content} near ${extractedData.location}`;
			const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Goog-Api-Key': this.env.GOOGLE_API_KEY,
					'X-Goog-FieldMask': 'places.displayName,places.nationalPhoneNumber',
				},
				body: JSON.stringify({ textQuery }),
			});
			if (!response.ok) {
				throw new Error(`Google API returned ${response.status}: ${response.statusText}`);
			}
			const results = await response.json();
			const place = results.places[0];
			console.log({ place });
			const number = phoneUtil.parseAndKeepRawInput(place.nationalPhoneNumber, 'US');
			return {
				title: place.displayName.text,
				phoneNumber: phoneUtil.format(number, PhoneNumberFormat.E164),
			};
		});
		const status = await step.do('Update database', async () => {
			// TODO: e164 it?
			const result = await this.env.DB.prepare('INSERT INTO forwards (phone_number, title, original_request) VALUES (?, ?, ?);')
				.bind(restaurantInfo.phoneNumber, restaurantInfo.title, content)
				.all();
			return { success: true, updated: new Date(), restaurantInfo };
		});
		const notfication = await step.do('Notify', async () => {
			console.log(status);
		});
		return status;
	}
}

app.post('/api/forwards', async (c) => {
	const payload = await c.req.json();
	const workflow = await c.env.FORWARDER.create({
		params: {
			content: payload.content,
			defaultLocation: payload.defaultLocation,
		},
	});
	return c.json({ success: true, payload, workflowId: workflow.id });
});

app.get('/api/forwards', async (c) => {
	const results = await c.env.DB.prepare('SELECT * FROM forwards ORDER BY created_at DESC LIMIT 5').all();
	return c.json(results);
});

app.get('/api/mappings', async (c) => {
	const results = await c.env.DB.prepare('SELECT * FROM mappings ORDER BY created_at').all();
	return c.json(results);
});

app.delete('api/mappings/:mappingId', async(c) => {
	const mappingId = c.req.param("mappingId");
	const results = await c.env.DB.prepare(`DELETE FROM mappings where ID=?`).bind(mappingId).all();
	return c.json({success: true, results});
});

app.post('/incoming', async (c) => {
	const body = await c.req.parseBody();
	let phoneNumber = '';
	// Check mappings
	const mappings = await c.env.DB.prepare(`SELECT forwarded_phone_number FROM mappings WHERE caller_phone_number=? AND incoming_phone_number=? LIMIT 1`)
		.bind(body.From, body.To)
		.all();
	if (mappings.results.length === 1) {
		phoneNumber = mappings.results[0].forwarded_phone_number as string;
	} else {
		const forward = await c.env.DB.prepare(`SELECT * FROM forwards ORDER BY created_at DESC LIMIT 1`).all();
		phoneNumber = forward.results[0].phone_number as string;
		await c.env.DB.prepare(`INSERT INTO mappings (forwarded_phone_number, caller_phone_number, incoming_phone_number) VALUES (?, ?, ?)`)
			.bind(phoneNumber, body.From, body.To)
			.run();
	}
	const twiml = `
	<Response>
		<Dial>${phoneNumber}</Dial>
	</Response>
	`;

	return c.body(twiml, { headers: { 'Content-Type': 'application/xml' } });
});

export default app;
