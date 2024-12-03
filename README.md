# Phoney Forwarder

Just dorking around, nothing to see here. Move along.

## Setup

Install deps

```bash
npm install
```

```bash
npx wrangler d1 create phoney-forwarder
```

Update [wrangler.toml](./wrangler.toml) with the results

Apply the DB migrations

```bash
npx wrangler d1 migrations apply phoney-forwarder --remote
```

Push up a Google API Key that has access to

```bash
npx wrangler secret put GOOGLE_API_KEY
```

Push up an Open AI API Key

```bash
npx wrangler secret put OPENAI_API_KEY
```

Deploy

```bash
npm run deploy
```

Hit the host name to see the admin panel. Copy the hostname/incoming to your incoming Voice Call configuration on any Twilio number.


## Notes
Structured outputs: https://platform.openai.com/docs/guides/structured-outputs
Places API: https://developers.google.com/maps/documentation/places/web-service/text-search#try-it


## Truth window
DB Schema https://chatgpt.com/share/674e0ecf-4b34-800f-a3fc-e5dd7000ccd3
Front-end https://chatgpt.com/share/674e7177-f23c-800f-9587-84e6e18707c2
