import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.resetModules();
	vi.doUnmock('$env/dynamic/private');
});

describe('security headers', () => {
	it('adds CSP and browser hardening headers to every response', async () => {
		expect.hasAssertions();
		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {} as Parameters<typeof handle>[0]['event'],
			resolve: async () => new Response('ok')
		});

		expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
		expect(response.headers.get('content-security-policy')).toContain("object-src 'none'");
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-frame-options')).toBe('DENY');
		expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
		expect(response.headers.get('permissions-policy')).toContain('camera=()');
	});

	it('can disable app CSP while keeping browser hardening headers', async () => {
		expect.hasAssertions();
		vi.doMock('$env/dynamic/private', () => ({ env: { ENABLE_APP_CSP: 'false' } }));

		const { handle } = await import('./hooks.server');
		const response = await handle({
			event: {} as Parameters<typeof handle>[0]['event'],
			resolve: async () => new Response('ok')
		});

		expect(response.headers.has('content-security-policy')).toBe(false);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('x-frame-options')).toBe('DENY');
		expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});
});
