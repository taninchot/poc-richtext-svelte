# AGENTS.md

## Project Overview

This is a SvelteKit proof of concept for a rich text editor built with Bun, Svelte 5 runes, Tiptap 3, and Drizzle/Postgres.

Key areas:

- `src/routes/+page.svelte`: main rich text lab UI, editor snapshot state, output inspector, and preview.
- `src/lib/tiptap/TiptapEditor.svelte`: client-only Tiptap editor setup, toolbar, bubble menu, image upload trigger, and snapshot emission.
- `src/lib/tiptap/RichTextPreview.svelte`: safe Svelte rendering of Tiptap JSON for preview. Prefer extending this renderer over injecting raw HTML.
- `src/lib/tiptap/editor-data.ts`: editor snapshot types, sample content, and character limit.
- `src/routes/api/uploads/+server.ts`: local image upload endpoint. It writes files to `static/uploads` and records metadata with Drizzle.
- `src/lib/server/schema.ts`: Drizzle schema for documents and uploads.
- `src/lib/server/queries/`: server-side Drizzle query helpers.
- `drizzle/`: generated migrations and migration metadata.

## Tooling

- Use Bun for dependency and script commands.
- Important scripts:
  - `bun run dev`
  - `bun run check`
  - `bun run lint`
  - `bun run test`
  - `bun run build`
  - `bun run db:generate`
  - `bun run db:migrate`
  - `bun run db:studio`
- The project uses `bun.lock`; do not introduce another package-manager lockfile.
- `DATABASE_URL` is required for Drizzle-backed server code. See `.env.example`.

## Code Style

- Follow `.prettierrc`: tabs, single quotes, no trailing commas, print width 100.
- Svelte runes mode is forced for project files in `svelte.config.js`; write new Svelte components with runes patterns such as `$props`, `$state`, `$derived`, and snippets where appropriate.
- Keep TypeScript strict and prefer explicit domain types for editor snapshots, uploads, documents, and query payloads.
- Use `$lib` imports for app-local modules.
- Use `lucide-svelte` icons for editor and app controls when a matching icon exists.

## Rich Text Rules

- Treat Tiptap JSON as the source of truth for persisted editor content.
- `snapshot.html` is useful for inspection or cached rendering, but avoid rendering untrusted HTML directly in Svelte.
- When adding Tiptap extensions, update both the editor configuration and `RichTextPreview.svelte` if the node or mark needs preview support.
- Keep link/image safety checks in the preview renderer when expanding supported attributes.
- Preserve the image constraints unless intentionally changing upload policy: PNG, JPG, WebP, GIF, max 5 MB.

## Database And Uploads

- Drizzle schema changes live in `src/lib/server/schema.ts`.
- Generate migrations with `bun run db:generate`; do not hand-edit generated migration metadata unless repairing a known migration issue.
- Local uploaded files are generated under `static/uploads` and ignored by git except `.gitkeep`.
- The upload endpoint currently stores files locally and records rows in `uploads`. Production storage should be swapped to object storage such as S3, R2, or Supabase Storage.

## Verification

Run the narrowest useful checks for the change, and prefer these before handing work back:

- `bun run check` for Svelte and TypeScript validation.
- `bun run lint` for Prettier and ESLint.
- `bun run test` for Vitest tests.
- `bun run build` for full SvelteKit build confidence.

Vitest is configured with `expect.requireAssertions: true`, so tests should contain explicit assertions.

## Working Notes

- Keep generated directories such as `.svelte-kit`, `build`, `node_modules`, and local dev logs out of edits.
- Do not overwrite in-progress user changes. This repo may have active work in `package.json`, `bun.lock`, upload handling, and server/db files.
- The README and sample content include Thai text; preserve existing localized copy unless the task asks to rewrite it.
