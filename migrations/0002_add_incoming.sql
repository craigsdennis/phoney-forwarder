-- Migration number: 0002 	 2024-12-03T02:24:06.722Z
ALTER TABLE mappings
ADD COLUMN incoming_phone_number TEXT;
