import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

function createDatabase() {
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required for database access.');
	}

	const client = postgres(env.DATABASE_URL);
	return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDatabase>;

let database: Database | null = null;

function getDatabase() {
	database ??= createDatabase();
	return database;
}

// Reuse one connection client across requests in the same process, but create it lazily
// so production image builds do not require runtime-only DATABASE_URL secrets.
export const db = new Proxy({} as Database, {
	get(_target, property, receiver) {
		const databaseClient = getDatabase();
		const value = Reflect.get(databaseClient, property, receiver);

		return typeof value === 'function' ? value.bind(databaseClient) : value;
	}
});
