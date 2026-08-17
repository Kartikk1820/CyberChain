import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.LEDGER_DATA_DIR ?? path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db: Database.Database = new Database(path.join(DATA_DIR, "ledger.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    idx           INTEGER PRIMARY KEY,
    timestamp     TEXT NOT NULL,
    payload_hash  TEXT NOT NULL,
    ref           TEXT,
    previous_hash TEXT NOT NULL,
    hash          TEXT NOT NULL UNIQUE
  );
`);
