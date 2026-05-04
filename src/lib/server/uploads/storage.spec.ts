import { describe, expect, it, vi } from 'vitest';
import {
	createPresignedImageUpload,
	UploadConfigurationError,
	resolveUploadStorage,
	resolveStoredImageObject,
	storeImageObject
} from './storage';

const r2Env = {
	UPLOAD_STORAGE: 'r2',
	R2_ACCOUNT_ID: 'account-id',
	R2_ACCESS_KEY_ID: 'access-key',
	R2_SECRET_ACCESS_KEY: 'secret-key',
	R2_BUCKET: 'richtext-assets',
	R2_PUBLIC_BASE_URL: 'https://assets.example.com/richtext/',
	R2_PREFIX: 'editor-uploads'
};

describe('resolveUploadStorage', () => {
	it('builds R2 storage settings from environment variables', () => {
		const storage = resolveUploadStorage(r2Env);

		expect(storage).toMatchObject({
			type: 'r2',
			bucket: 'richtext-assets',
			endpoint: 'https://account-id.r2.cloudflarestorage.com',
			prefix: 'editor-uploads',
			publicBaseUrl: 'https://assets.example.com/richtext'
		});
	});

	it('requires a public base URL when R2 storage is enabled', () => {
		expect(() =>
			resolveUploadStorage({
				...r2Env,
				R2_PUBLIC_BASE_URL: undefined
			})
		).toThrow(UploadConfigurationError);
	});

	it('uses local storage by default', () => {
		const storage = resolveUploadStorage({});

		expect(storage).toMatchObject({
			type: 'local',
			publicPath: '/uploads',
			uploadsDirectory: expect.stringContaining('static')
		});
	});
});

describe('storeImageObject', () => {
	it('uploads bytes to R2 and returns the public object URL', async () => {
		const send = vi.fn().mockResolvedValue({});

		const result = await storeImageObject(
			{
				filename: 'sample.png',
				bytes: Buffer.from('image-bytes'),
				contentType: 'image/png'
			},
			{
				env: r2Env,
				r2Client: { send }
			}
		);

		expect(send).toHaveBeenCalledOnce();
		expect(send.mock.calls[0]?.[0].input).toMatchObject({
			Bucket: 'richtext-assets',
			Key: 'editor-uploads/sample.png',
			Body: Buffer.from('image-bytes'),
			ContentType: 'image/png'
		});
		expect(result).toEqual({
			key: 'editor-uploads/sample.png',
			url: 'https://assets.example.com/richtext/editor-uploads/sample.png'
		});
	});
});

describe('createPresignedImageUpload', () => {
	it('signs an R2 PUT upload and returns the browser upload contract', async () => {
		const signUrl = vi.fn().mockResolvedValue('https://account-id.r2.cloudflarestorage.com/signed');

		const result = await createPresignedImageUpload(
			{
				filename: 'sample.png',
				contentType: 'image/png'
			},
			{
				env: r2Env,
				signUrl
			}
		);

		expect(signUrl).toHaveBeenCalledOnce();
		expect(signUrl.mock.calls[0]?.[1].input).toMatchObject({
			Bucket: 'richtext-assets',
			Key: 'editor-uploads/sample.png',
			ContentType: 'image/png'
		});
		expect(signUrl.mock.calls[0]?.[2]).toEqual({ expiresIn: 900 });
		expect(result).toEqual({
			expiresIn: 900,
			headers: {
				'Cache-Control': 'public, max-age=31536000, immutable',
				'Content-Type': 'image/png'
			},
			key: 'editor-uploads/sample.png',
			uploadUrl: 'https://account-id.r2.cloudflarestorage.com/signed',
			url: 'https://assets.example.com/richtext/editor-uploads/sample.png'
		});
	});

	it('rejects presigned uploads when local storage is active', async () => {
		await expect(
			createPresignedImageUpload(
				{
					filename: 'sample.png',
					contentType: 'image/png'
				},
				{ env: {} }
			)
		).rejects.toThrow(UploadConfigurationError);
	});
});

describe('resolveStoredImageObject', () => {
	it('rebuilds the public URL for a confirmed R2 object key', () => {
		const result = resolveStoredImageObject('editor-uploads/sample.png', { env: r2Env });

		expect(result).toEqual({
			key: 'editor-uploads/sample.png',
			url: 'https://assets.example.com/richtext/editor-uploads/sample.png'
		});
	});

	it('rejects confirmed keys outside the configured R2 prefix', () => {
		expect(() => resolveStoredImageObject('other/sample.png', { env: r2Env })).toThrow(
			UploadConfigurationError
		);
	});
});
