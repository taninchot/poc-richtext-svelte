import { json, type RequestHandler } from '@sveltejs/kit';
import { createUpload } from '$lib/server/queries/uploads';
import { resolveStoredImageObject, UploadConfigurationError } from '$lib/server/uploads/storage';
import { validateImageMetadata } from '$lib/server/uploads/validation';

type ConfirmUploadIntent = {
	key?: unknown;
	name?: unknown;
	size?: unknown;
	type?: unknown;
};

async function readIntent(request: Request) {
	try {
		return (await request.json()) as ConfirmUploadIntent;
	} catch {
		return null;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const intent = await readIntent(request);

	if (!intent) {
		return json({ message: 'Expected upload confirmation as JSON.' }, { status: 400 });
	}

	if (typeof intent.key !== 'string' || !intent.key.trim()) {
		return json({ message: 'Expected uploaded object key.' }, { status: 400 });
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

	const validation = validateImageMetadata({ type: intent.type, size: intent.size });

	if (!validation.extension) {
		return json({ message: validation.message }, { status: validation.status });
	}

	if (!intent.key.endsWith(`.${validation.extension}`)) {
		return json({ message: 'Uploaded object key does not match image type.' }, { status: 400 });
	}

	try {
		const storedObject = resolveStoredImageObject(intent.key);
		const upload = await createUpload({
			filename: storedObject.key,
			originalName: intent.name,
			mimeType: intent.type,
			sizeBytes: intent.size,
			url: storedObject.url
		});

		return json({
			id: upload.id,
			key: storedObject.key,
			name: intent.name,
			size: intent.size,
			type: intent.type,
			url: storedObject.url
		});
	} catch (error) {
		if (error instanceof UploadConfigurationError) {
			return json({ message: error.message }, { status: 500 });
		}

		console.error('Upload confirmation failed', error);
		return json({ message: 'Upload confirmation failed.' }, { status: 502 });
	}
};
