import { describe, expect, it, vi } from 'vitest';

describe('database module', () => {
	it('does not require DATABASE_URL while the module is imported', async () => {
		expect.hasAssertions();
		vi.stubEnv('DATABASE_URL', '');

		const module = await import('./db');

		expect(module.db).toBeDefined();
		vi.unstubAllEnvs();
	});
});
