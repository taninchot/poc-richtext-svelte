export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
	'image/gif': 'gif',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

export type ImageMetadataValidation =
	| { extension: string; message?: never; status?: never }
	| { extension?: never; message: string; status: number };

export function imageExtension(mimeType: string) {
	return IMAGE_EXTENSIONS[mimeType];
}

export function validateImageMetadata({
	type,
	size
}: {
	type: string;
	size: number;
}): ImageMetadataValidation {
	const extension = imageExtension(type);
	if (!extension) {
		return { message: 'Use PNG, JPG, WebP, or GIF.', status: 415 };
	}

	if (size > MAX_IMAGE_BYTES) {
		return { message: 'Image must be 5MB or smaller.', status: 413 };
	}

	return { extension };
}
