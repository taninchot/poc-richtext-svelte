import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const routesDirectory = resolve(process.cwd(), 'src/routes');
const homePagePath = resolve(routesDirectory, '+page.svelte');
const editorPagePath = resolve(routesDirectory, 'editor/+page.svelte');

describe('content routes', () => {
	it('/editor owns the rich text editing surface', async () => {
		expect.hasAssertions();
		expect(existsSync(editorPagePath)).toBe(true);

		if (!existsSync(editorPagePath)) return;

		const editorPage = await readFile(editorPagePath, 'utf8');

		expect(editorPage).toContain('TiptapEditor');
	});

	it('/ stays a read-only content viewer', async () => {
		expect.hasAssertions();
		const homePage = await readFile(homePagePath, 'utf8');

		expect(homePage).not.toContain('TiptapEditor');
		expect(homePage).toContain('RichTextPreview');
	});
});
