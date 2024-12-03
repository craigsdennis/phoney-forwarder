-- Migration number: 0001 	 2024-12-02T19:49:23.860Z
CREATE TABLE forwards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    title TEXT NOT NULL,
    original_request TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_phone_number TEXT NOT NULL,
    forwarded_phone_number TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
