import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { DATABASE_URL } from '$env/static/private';
import * as schema from './schema';

if (!DATABASE_URL) {
	throw new Error('DATABASE_URL is required for database access.');
}

// Reuse one connection client across requests in the same process.
const client = postgres(DATABASE_URL);

export const db = drizzle(client, { schema });
