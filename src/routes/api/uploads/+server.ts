import { randomUUID } from 'node:crypto';
import { json, type RequestHandler } from '@sveltejs/kit';
import { createUpload } from '$lib/server/queries/uploads';
import {
	createPresignedImageUpload,
	resolveUploadStorage,
	UploadConfigurationError,
	storeImageObject,
	type StoredImageObject
} from '$lib/server/uploads/storage';
import { validateImageMetadata } from '$lib/server/uploads/validation';

type UploadIntent = {
	name?: unknown;
	size?: unknown;
	type?: unknown;
};

function createImageFilename(extension: string) {
	return `${Date.now()}-${randomUUID()}.${extension}`;
}

async function recordUpload({
	originalName,
	size,
	storedObject,
	type
}: {
	originalName: string;
	size: number;
	storedObject: StoredImageObject;
	type: string;
}) {
	return createUpload({
		filename: storedObject.key,
		originalName,
		mimeType: type,
		sizeBytes: size,
		url: storedObject.url
	});
}

async function createProxiedUpload(request: Request) {
	const formData = await request.formData();
	const image = formData.get('image');

	if (!(image instanceof File)) {
		return json({ message: 'Expected an image file.' }, { status: 400 });
	}

	const validation = validateImageMetadata({ type: image.type, size: image.size });

	if (!validation.extension) {
		return json({ message: validation.message }, { status: validation.status });
	}

	const filename = createImageFilename(validation.extension);
	const bytes = Buffer.from(await image.arrayBuffer());
	let storedObject: StoredImageObject;

	try {
		storedObject = await storeImageObject({
			filename,
			bytes,
			contentType: image.type
		});
	} catch (error) {
		if (error instanceof UploadConfigurationError) {
			return json({ message: error.message }, { status: 500 });
		}

		console.error('Image upload failed', error);
		return json({ message: 'Upload failed.' }, { status: 502 });
	}

	const upload = await recordUpload({
		originalName: image.name,
		size: image.size,
		storedObject,
		type: image.type
	});

	return json({
		id: upload.id,
		name: image.name,
		size: image.size,
		type: image.type,
		url: storedObject.url
	});
}

async function createPresignedUpload(request: Request) {
	let intent: UploadIntent;

	try {
		intent = (await request.json()) as UploadIntent;
	} catch {
		return json({ message: 'Expected upload metadata as JSON.' }, { status: 400 });
	}

	if (typeof intent.name !== 'string' || !intent.name.trim()) {
		return json({ message: 'Expected an image file name.' }, { status: 400 });
	}

	if (typeof intent.type !== 'string') {
		return json({ message: 'Expected an image MIME type.' }, { status: 400 });
	}

	if (typeof intent.size !== 'number' || !Number.isFinite(intent.size) || intent.size < 0) {
		return json({ message: 'Expected an image size.' }, { status: 400 });
	}

	let storage;

	try {
		storage = resolveUploadStorage();
	} catch (error) {
		if (error instanceof UploadConfigurationError) {
			return json({ message: error.message }, { status: 500 });
		}

		throw error;
	}

	if (storage.type !== 'r2') {
		return json(
			{
				message: 'Presigned uploads require R2 storage.',
				strategy: 'proxy'
			},
			{ status: 409 }
		);
	}

	const validation = validateImageMetadata({ type: intent.type, size: intent.size });

	if (!validation.extension) {
		return json({ message: validation.message }, { status: validation.status });
	}

	try {
		const presignedUpload = await createPresignedImageUpload({
			filename: createImageFilename(validation.extension),
			contentType: intent.type
		});

		return json({
			expiresIn: presignedUpload.expiresIn,
			headers: presignedUpload.headers,
			key: presignedUpload.key,
			name: intent.name,
			size: intent.size,
			strategy: 'presigned',
			type: intent.type,
			uploadUrl: presignedUpload.uploadUrl,
			url: presignedUpload.url
		});
	} catch (error) {
		if (error instanceof UploadConfigurationError) {
			return json({ message: error.message }, { status: 500 });
		}

		console.error('Presigned image upload creation failed', error);
		return json({ message: 'Upload failed.' }, { status: 502 });
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';

	if (contentType.includes('application/json')) {
		return createPresignedUpload(request);
	}

	return createProxiedUpload(request);
};
