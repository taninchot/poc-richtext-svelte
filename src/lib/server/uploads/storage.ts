import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env as privateEnv } from '$env/dynamic/private';

type UploadEnv = Record<string, string | undefined>;

type LocalUploadStorage = {
	type: 'local';
	uploadsDirectory: string;
	publicPath: string;
};

type R2UploadStorage = {
	type: 'r2';
	bucket: string;
	endpoint: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicBaseUrl: string;
	prefix: string;
};

type UploadStorage = LocalUploadStorage | R2UploadStorage;

type R2Client = {
	send: (command: PutObjectCommand) => Promise<unknown>;
};

type UploadStorageDependencies = {
	env?: UploadEnv;
	rootDirectory?: string;
	r2Client?: R2Client;
	signUrl?: (
		client: S3Client,
		command: PutObjectCommand,
		options: { expiresIn: number }
	) => Promise<string>;
	ensureDirectory?: (path: string, options: { recursive: true }) => Promise<unknown>;
	writeFile?: (path: string, data: Uint8Array) => Promise<unknown>;
};

type StoreImageObjectInput = {
	filename: string;
	bytes: Uint8Array;
	contentType: string;
};

export type StoredImageObject = {
	key: string;
	url: string;
};

export type PresignedImageUpload = StoredImageObject & {
	expiresIn: number;
	headers: {
		'Cache-Control': string;
		'Content-Type': string;
	};
	uploadUrl: string;
};

export class UploadConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UploadConfigurationError';
	}
}

const PRESIGNED_UPLOAD_EXPIRES_IN_SECONDS = 15 * 60;
const UPLOAD_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function trimTrailingSlash(value: string) {
	return value.replace(/\/+$/, '');
}

function trimSlashes(value: string) {
	return value.replace(/^\/+|\/+$/g, '');
}

function requiredEnv(env: UploadEnv, name: string) {
	const value = env[name]?.trim();

	if (!value) {
		throw new UploadConfigurationError(`Missing ${name} for R2 image uploads.`);
	}

	return value;
}

function resolveR2Endpoint(env: UploadEnv) {
	const explicitEndpoint = env.R2_ENDPOINT?.trim();

	if (explicitEndpoint) return trimTrailingSlash(explicitEndpoint);

	const accountId = requiredEnv(env, 'R2_ACCOUNT_ID');
	return `https://${accountId}.r2.cloudflarestorage.com`;
}

function objectKey(prefix: string, filename: string) {
	const cleanFilename = filename.replace(/^[/\\]+/, '').replace(/[/\\]+/g, '-');
	return prefix ? `${prefix}/${cleanFilename}` : cleanFilename;
}

function publicObjectUrl(publicBaseUrl: string, key: string) {
	return `${trimTrailingSlash(publicBaseUrl)}/${trimSlashes(key)}`;
}

export function resolveUploadStorage(
	env: UploadEnv = privateEnv,
	rootDirectory = cwd()
): UploadStorage {
	const storageType = env.UPLOAD_STORAGE?.trim().toLowerCase() ?? 'local';

	if (storageType === 'local') {
		return {
			type: 'local',
			uploadsDirectory: join(rootDirectory, 'static', 'uploads'),
			publicPath: '/uploads'
		};
	}

	if (storageType !== 'r2') {
		throw new UploadConfigurationError(`Unsupported UPLOAD_STORAGE value: ${storageType}.`);
	}

	return {
		type: 'r2',
		bucket: requiredEnv(env, 'R2_BUCKET'),
		endpoint: resolveR2Endpoint(env),
		accessKeyId: requiredEnv(env, 'R2_ACCESS_KEY_ID'),
		secretAccessKey: requiredEnv(env, 'R2_SECRET_ACCESS_KEY'),
		publicBaseUrl: trimTrailingSlash(requiredEnv(env, 'R2_PUBLIC_BASE_URL')),
		prefix: trimSlashes(env.R2_PREFIX?.trim() || 'uploads')
	};
}

function createR2Client(storage: R2UploadStorage) {
	return new S3Client({
		region: 'auto',
		endpoint: storage.endpoint,
		credentials: {
			accessKeyId: storage.accessKeyId,
			secretAccessKey: storage.secretAccessKey
		}
	});
}

async function storeLocalObject(
	storage: LocalUploadStorage,
	{ filename, bytes }: StoreImageObjectInput,
	dependencies: UploadStorageDependencies
): Promise<StoredImageObject> {
	const ensureDirectory = dependencies.ensureDirectory ?? mkdir;
	const write = dependencies.writeFile ?? writeFile;
	const key = objectKey('', filename);

	await ensureDirectory(storage.uploadsDirectory, { recursive: true });
	await write(join(storage.uploadsDirectory, key), bytes);

	return {
		key,
		url: `${storage.publicPath}/${key}`
	};
}

async function storeR2Object(
	storage: R2UploadStorage,
	{ filename, bytes, contentType }: StoreImageObjectInput,
	dependencies: UploadStorageDependencies
): Promise<StoredImageObject> {
	const key = objectKey(storage.prefix, filename);
	const client = dependencies.r2Client ?? createR2Client(storage);

	await client.send(
		new PutObjectCommand({
			Bucket: storage.bucket,
			Key: key,
			Body: bytes,
			ContentType: contentType,
			CacheControl: UPLOAD_CACHE_CONTROL
		})
	);

	return {
		key,
		url: publicObjectUrl(storage.publicBaseUrl, key)
	};
}

export async function storeImageObject(
	input: StoreImageObjectInput,
	dependencies: UploadStorageDependencies = {}
): Promise<StoredImageObject> {
	const storage = resolveUploadStorage(dependencies.env, dependencies.rootDirectory);

	if (storage.type === 'local') {
		return storeLocalObject(storage, input, dependencies);
	}

	return storeR2Object(storage, input, dependencies);
}

export async function createPresignedImageUpload(
	{
		filename,
		contentType,
		expiresIn = PRESIGNED_UPLOAD_EXPIRES_IN_SECONDS
	}: {
		filename: string;
		contentType: string;
		expiresIn?: number;
	},
	dependencies: UploadStorageDependencies = {}
): Promise<PresignedImageUpload> {
	const storage = resolveUploadStorage(dependencies.env, dependencies.rootDirectory);

	if (storage.type !== 'r2') {
		throw new UploadConfigurationError('Presigned image uploads require UPLOAD_STORAGE=r2.');
	}

	const key = objectKey(storage.prefix, filename);
	const command = new PutObjectCommand({
		Bucket: storage.bucket,
		Key: key,
		ContentType: contentType,
		CacheControl: UPLOAD_CACHE_CONTROL
	});
	const signUrl = dependencies.signUrl ?? getSignedUrl;
	const uploadUrl = await signUrl(createR2Client(storage), command, { expiresIn });

	return {
		expiresIn,
		headers: {
			'Cache-Control': UPLOAD_CACHE_CONTROL,
			'Content-Type': contentType
		},
		key,
		uploadUrl,
		url: publicObjectUrl(storage.publicBaseUrl, key)
	};
}
