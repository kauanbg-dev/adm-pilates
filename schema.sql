-- Postgres (Neon / Vercel) — rode uma vez no SQL Editor do banco.

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS studio (
  id INT PRIMARY KEY CHECK (id = 1),
  payload JSONB NOT NULL
);
