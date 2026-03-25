#!/usr/bin/env node
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'eventfinder.db');
const SCHEMA_PATH = join(__dirname, '..', 'data', 'schema.sql');

console.log('Initializing EventFinder database...');
console.log(`DB path: ${DB_PATH}`);

const schema = readFileSync(SCHEMA_PATH, 'utf8');
const db = new Database(DB_PATH);

db.exec(schema);
db.close();

console.log('Database initialized successfully.');
