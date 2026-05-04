import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const uploadRoutePath = resolve(process.cwd(), 'src/routes/api/uploads/+server.ts');
const confirmRoutePath = resolve(process.cwd(), 'src/routes/api/uploads/confirm/+server.ts');
const editorPath = resolve(process.cwd(), 'src/lib/tiptap/TiptapEditor.svelte');

describe('presigned upload flow', () => {
	it('records uploads only after the browser confirms a successful PUT', async () => {
		expect.hasAssertions();
		const uploadRoute = await readFile(uploadRoutePath, 'utf8');
		const editor = await readFile(editorPath, 'utf8');

		expect(uploadRoute).not.toContain('originalName: intent.name');
		expect(existsSync(confirmRoutePath)).toBe(true);
		expect(editor).toContain('/api/uploads/confirm');
	});
});
