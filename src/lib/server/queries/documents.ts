import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { documents } from '../schema';
import type { RichTextSnapshot } from '$lib/tiptap/editor-data';

type DocumentStatus = 'draft' | 'published';

// --- Slug ---

function slugify(title: string): string {
	const base =
		title
			.toLowerCase()
			.replace(/[^\w\s-]/g, '') // strip non-ASCII (Thai, symbols, etc.)
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim() || 'document';
	const suffix = Math.random().toString(36).slice(2, 7);
	return `${base}-${suffix}`;
}

// --- Queries ---

/** List all documents, newest first. Excludes heavy content_json/html. */
export async function listDocuments() {
	return db
		.select({
			id: documents.id,
			title: documents.title,
			slug: documents.slug,
			status: documents.status,
			wordCount: documents.wordCount,
			characterCount: documents.characterCount,
			createdAt: documents.createdAt,
			updatedAt: documents.updatedAt,
			publishedAt: documents.publishedAt
		})
		.from(documents)
		.orderBy(desc(documents.updatedAt));
}

/** Get a single document with full content for editing. */
export async function getDocumentById(id: string) {
	const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
	return rows[0] ?? null;
}

/** Create a document from the editor snapshot. */
export async function createDocument(
	title: string,
	snapshot: RichTextSnapshot,
	status: DocumentStatus = 'draft'
) {
	const now = new Date();
	const rows = await db
		.insert(documents)
		.values({
			title,
			slug: slugify(title),
			status,
			contentJson: snapshot.json,
			contentHtml: snapshot.html,
			wordCount: snapshot.words,
			characterCount: snapshot.characters,
			...(status === 'published' ? { publishedAt: now, updatedAt: now } : {})
		})
		.returning();
	return rows[0];
}

type UpdatePayload = {
	title: string;
	snapshot: RichTextSnapshot;
	status?: DocumentStatus;
};

/** Update content and optionally change publish status. */
export async function updateDocument(id: string, { title, snapshot, status }: UpdatePayload) {
	const now = new Date();
	const rows = await db
		.update(documents)
		.set({
			title,
			contentJson: snapshot.json,
			contentHtml: snapshot.html,
			wordCount: snapshot.words,
			characterCount: snapshot.characters,
			status: status ?? 'draft',
			updatedAt: now,
			// publishedAt is set once on first publish and never cleared
			...(status === 'published' ? { publishedAt: now } : {})
		})
		.where(eq(documents.id, id))
		.returning();
	return rows[0] ?? null;
}

export async function deleteDocument(id: string) {
	await db.delete(documents).where(eq(documents.id, id));
}
