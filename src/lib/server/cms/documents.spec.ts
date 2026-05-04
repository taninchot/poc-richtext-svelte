import { describe, expect, it, vi } from 'vitest';
import { CMSValidationError, normalizeDocumentPayload, saveCmsDocument } from './documents';
import type { RichTextSnapshot } from '$lib/tiptap/editor-data';

const snapshot: RichTextSnapshot = {
	html: '<p>Hello</p>',
	json: {
		type: 'doc',
		content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
	},
	text: 'Hello',
	words: 1,
	characters: 5
};

function createQueries() {
	return {
		createDocument: vi.fn().mockResolvedValue({
			id: 'created-id',
			title: 'Hello',
			status: 'draft'
		}),
		updateDocument: vi.fn().mockResolvedValue({
			id: 'existing-id',
			title: 'Updated',
			status: 'published'
		})
	};
}

describe('normalizeDocumentPayload', () => {
	it('normalizes valid document input for saving as a draft', () => {
		const result = normalizeDocumentPayload({
			title: '  Hello document  ',
			snapshot
		});

		expect(result).toEqual({
			title: 'Hello document',
			snapshot,
			status: 'draft'
		});
	});

	it('accepts published status when publishing content', () => {
		const result = normalizeDocumentPayload({
			title: 'Release note',
			snapshot,
			status: 'published'
		});

		expect(result.status).toBe('published');
	});

	it('rejects missing title and invalid snapshots', () => {
		expect(() =>
			normalizeDocumentPayload({
				title: ' ',
				snapshot: { json: { type: 'paragraph' } }
			})
		).toThrow(CMSValidationError);
	});
});

describe('saveCmsDocument', () => {
	it('creates a document when no id is provided', async () => {
		const queries = createQueries();

		const result = await saveCmsDocument(null, { title: 'Hello', snapshot }, queries);

		expect(queries.createDocument).toHaveBeenCalledWith('Hello', snapshot, 'draft');
		expect(queries.updateDocument).not.toHaveBeenCalled();
		expect(result).toMatchObject({ id: 'created-id' });
	});

	it('creates a published document when publishing a new entry', async () => {
		const queries = createQueries();

		await saveCmsDocument(null, { title: 'Launch', snapshot, status: 'published' }, queries);

		expect(queries.createDocument).toHaveBeenCalledWith('Launch', snapshot, 'published');
		expect(queries.updateDocument).not.toHaveBeenCalled();
	});

	it('updates an existing document when an id is provided', async () => {
		const queries = createQueries();

		const result = await saveCmsDocument(
			'existing-id',
			{ title: 'Updated', snapshot, status: 'published' },
			queries
		);

		expect(queries.updateDocument).toHaveBeenCalledWith('existing-id', {
			title: 'Updated',
			snapshot,
			status: 'published'
		});
		expect(queries.createDocument).not.toHaveBeenCalled();
		expect(result).toMatchObject({ id: 'existing-id', status: 'published' });
	});
});
