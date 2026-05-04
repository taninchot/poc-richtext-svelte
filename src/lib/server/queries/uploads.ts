import { eq } from 'drizzle-orm';
import { db } from '../db';
import { uploads } from '../schema';

type CreateUploadInput = {
	filename: string;
	originalName: string;
	mimeType: string;
	sizeBytes: number;
	url: string;
	documentId?: string;
};

/** Record a new upload. documentId is optional — attach later via attachUpload(). */
export async function createUpload(data: CreateUploadInput) {
	const rows = await db.insert(uploads).values(data).returning();
	return rows[0];
}

/** Link an orphaned upload to a document after the document is saved. */
export async function attachUpload(uploadId: string, documentId: string) {
	await db.update(uploads).set({ documentId }).where(eq(uploads.id, uploadId));
}
