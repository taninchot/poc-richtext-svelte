import { pgEnum, pgTable, uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import type { JSONContent } from '@tiptap/core';

export const documentStatusEnum = pgEnum('document_status', ['draft', 'published']);

export const documents = pgTable('documents', {
	id: uuid('id').defaultRandom().primaryKey(),
	title: text('title').notNull(),
	// URL-friendly identifier, auto-generated from title + random suffix
	slug: text('slug').notNull().unique(),
	status: documentStatusEnum('status').notNull().default('draft'),
	// Tiptap ProseMirror JSON — source of truth when re-opening the editor
	contentJson: jsonb('content_json').$type<JSONContent>(),
	// Pre-rendered HTML — used for display without re-instantiating Tiptap
	contentHtml: text('content_html'),
	wordCount: integer('word_count').notNull().default(0),
	characterCount: integer('character_count').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	// Must be updated manually on every UPDATE query (no DB trigger in this PoC)
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	// Set when status transitions to 'published', never reset back to null
	publishedAt: timestamp('published_at', { withTimezone: true })
});

export const uploads = pgTable('uploads', {
	id: uuid('id').defaultRandom().primaryKey(),
	// Nullable: upload can happen before the document is saved (draft flow)
	// onDelete: 'set null' keeps the file record even if the document is deleted
	documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
	// Stored filename / R2 object key (swap local path for R2 key when migrating)
	filename: text('filename').notNull(),
	originalName: text('original_name').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: integer('size_bytes').notNull(),
	// Local: /uploads/<filename>  →  R2: https://<bucket>.r2.dev/<key>
	url: text('url').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// Inferred TypeScript types
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
