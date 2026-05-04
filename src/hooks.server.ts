import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const contentSecurityPolicy = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https:",
	"connect-src 'self' https:",
	"font-src 'self' data:",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'"
].join('; ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	if (env.ENABLE_APP_CSP !== 'false') {
		response.headers.set('Content-Security-Policy', contentSecurityPolicy);
	}

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(), payment=()'
	);

	return response;
};
