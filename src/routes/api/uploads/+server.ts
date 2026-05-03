import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { json, type RequestHandler } from '@sveltejs/kit';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
	'image/gif': 'gif',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const image = formData.get('image');

	if (!(image instanceof File)) {
		return json({ message: 'Expected an image file.' }, { status: 400 });
	}

	const extension = IMAGE_EXTENSIONS[image.type];

	if (!extension) {
		return json({ message: 'Use PNG, JPG, WebP, or GIF.' }, { status: 415 });
	}

	if (image.size > MAX_IMAGE_BYTES) {
		return json({ message: 'Image must be 5MB or smaller.' }, { status: 413 });
	}

	const uploadsDirectory = join(cwd(), 'static', 'uploads');
	const filename = `${Date.now()}-${randomUUID()}.${extension}`;
	const filePath = join(uploadsDirectory, filename);
	const bytes = Buffer.from(await image.arrayBuffer());

	await mkdir(uploadsDirectory, { recursive: true });
	await writeFile(filePath, bytes);

	return json({
		name: image.name,
		size: image.size,
		type: image.type,
		url: `/uploads/${filename}`
	});
};
