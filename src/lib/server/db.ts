import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL is required for database access.');
}

// Reuse one connection client across requests in the same process.
const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
