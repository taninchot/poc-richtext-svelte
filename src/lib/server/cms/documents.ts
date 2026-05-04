import type { RichTextSnapshot } from '$lib/tiptap/editor-data';

type DocumentStatus = 'draft' | 'published';

type DocumentPayload = {
	title?: unknown;
	snapshot?: unknown;
	status?: unknown;
};

type SaveDocumentInput = {
	title: string;
	snapshot: RichTextSnapshot;
	status: DocumentStatus;
};

type SaveDocumentQueries<DocumentResult> = {
	createDocument: (
		title: string,
		snapshot: RichTextSnapshot,
		status: DocumentStatus
	) => Promise<DocumentResult>;
	updateDocument: (
		id: string,
		payload: SaveDocumentInput
	) => Promise<DocumentResult | null | undefined>;
};

export class CMSValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CMSValidationError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isSnapshot(value: unknown): value is RichTextSnapshot {
	if (!isRecord(value)) return false;
	if (typeof value.html !== 'string') return false;
	if (typeof value.text !== 'string') return false;
	if (typeof value.words !== 'number' || !Number.isFinite(value.words) || value.words < 0) {
		return false;
	}
	if (
		typeof value.characters !== 'number' ||
		!Number.isFinite(value.characters) ||
		value.characters < 0
	) {
		return false;
	}
	if (!isRecord(value.json) || value.json.type !== 'doc') return false;

	return true;
}

export function normalizeDocumentPayload(input: DocumentPayload): SaveDocumentInput {
	const title = typeof input.title === 'string' ? input.title.trim() : '';

	if (!title) {
		throw new CMSValidationError('Document title is required.');
	}

	if (!isSnapshot(input.snapshot)) {
		throw new CMSValidationError('A valid rich text snapshot is required.');
	}

	const status = input.status ?? 'draft';

	if (status !== 'draft' && status !== 'published') {
		throw new CMSValidationError('Document status must be draft or published.');
	}

	return {
		title,
		snapshot: input.snapshot,
		status
	};
}

export async function saveCmsDocument<DocumentResult>(
	id: string | null,
	input: DocumentPayload,
	queries: SaveDocumentQueries<DocumentResult>
) {
	const payload = normalizeDocumentPayload(input);

	if (!id) {
		return queries.createDocument(payload.title, payload.snapshot, payload.status);
	}

	return queries.updateDocument(id, payload);
}
