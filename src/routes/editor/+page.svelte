<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Content, JSONContent } from '@tiptap/core';
	import {
		Braces,
		CheckCircle2,
		Database,
		FileCode,
		FileText,
		Gauge,
		Plus,
		RefreshCw,
		Save,
		Send,
		Trash2,
		Type
	} from 'lucide-svelte';
	import RichTextPreview from '$lib/tiptap/RichTextPreview.svelte';
	import TiptapEditor from '$lib/tiptap/TiptapEditor.svelte';
	import { createEmptySnapshot, type RichTextSnapshot } from '$lib/tiptap/editor-data';

	type CmsStatus = 'draft' | 'published';

	type CmsDocumentSummary = {
		id: string;
		title: string;
		slug: string;
		status: CmsStatus;
		wordCount: number;
		characterCount: number;
		createdAt: string;
		updatedAt: string;
		publishedAt: string | null;
	};

	type CmsDocument = CmsDocumentSummary & {
		contentJson: JSONContent | null;
		contentHtml: string | null;
	};

	type ApiMessage = {
		message?: string;
	};

	type DocumentListResponse = ApiMessage & {
		documents?: CmsDocumentSummary[];
	};

	type DocumentResponse = ApiMessage & {
		document?: CmsDocument;
	};

	type CmsState = {
		status: 'idle' | 'loading' | 'saving' | 'done' | 'error';
		message: string;
	};

	let snapshot = $state<RichTextSnapshot>(createEmptySnapshot());
	let title = $state('Untitled rich text draft');
	let documents = $state<CmsDocumentSummary[]>([]);
	let activeDocumentId = $state<string | null>(null);
	let activeStatus = $state<CmsStatus>('draft');
	let editorContent = $state<Content | undefined>(undefined);
	let editorKey = $state(0);
	let cmsState = $state<CmsState>({ status: 'idle', message: '' });
	let outputMode = $state<'html' | 'json'>('html');
	let activeDocument = $derived(
		documents.find((document) => document.id === activeDocumentId) ?? null
	);
	let isCmsBusy = $derived(cmsState.status === 'loading' || cmsState.status === 'saving');
	let serializedJson = $derived(JSON.stringify(snapshot.json, null, 2));

	function updateSnapshot(nextSnapshot: RichTextSnapshot) {
		snapshot = nextSnapshot;
	}

	async function readApiResponse<T extends ApiMessage>(response: Response): Promise<T> {
		const body = (await response.json().catch(() => ({}))) as T;

		if (!response.ok) {
			throw new Error(body.message ?? `Request failed with ${response.status}.`);
		}

		return body;
	}

	function documentSnapshot(document: CmsDocument): RichTextSnapshot {
		const fallback = createEmptySnapshot();

		return {
			html: document.contentHtml ?? '',
			json: document.contentJson ?? fallback.json,
			text: '',
			words: document.wordCount,
			characters: document.characterCount
		};
	}

	function formatDate(value: string | null) {
		if (!value) return 'Not published';

		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	async function loadDocuments() {
		cmsState = { status: 'loading', message: 'Loading documents' };

		try {
			const result = await readApiResponse<DocumentListResponse>(await fetch('/api/documents'));
			documents = result.documents ?? [];
			cmsState = { status: 'done', message: 'Document list synced' };
		} catch (error) {
			cmsState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Could not load documents.'
			};
		}
	}

	async function openDocument(id: string) {
		cmsState = { status: 'loading', message: 'Opening document' };

		try {
			const result = await readApiResponse<DocumentResponse>(await fetch(`/api/documents/${id}`));

			if (!result.document) {
				throw new Error('Document not found.');
			}

			const nextSnapshot = documentSnapshot(result.document);

			activeDocumentId = result.document.id;
			activeStatus = result.document.status;
			title = result.document.title;
			snapshot = nextSnapshot;
			editorContent = nextSnapshot.json;
			editorKey += 1;
			cmsState = { status: 'done', message: `Opened ${result.document.title}` };
		} catch (error) {
			cmsState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Could not open document.'
			};
		}
	}

	function newDocument() {
		activeDocumentId = null;
		activeStatus = 'draft';
		title = 'Untitled rich text draft';
		snapshot = createEmptySnapshot();
		editorContent = undefined;
		editorKey += 1;
		cmsState = { status: 'idle', message: 'New draft started' };
	}

	async function saveDocument(status: CmsStatus) {
		const cleanTitle = title.trim();

		if (!cleanTitle) {
			cmsState = { status: 'error', message: 'Document title is required.' };
			return;
		}

		cmsState = {
			status: 'saving',
			message: status === 'published' ? 'Publishing document' : 'Saving draft'
		};

		try {
			const response = await fetch(
				activeDocumentId ? `/api/documents/${activeDocumentId}` : '/api/documents',
				{
					method: activeDocumentId ? 'PATCH' : 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						title: cleanTitle,
						snapshot,
						status
					})
				}
			);
			const result = await readApiResponse<DocumentResponse>(response);

			if (!result.document) {
				throw new Error('Document save failed.');
			}

			activeDocumentId = result.document.id;
			activeStatus = result.document.status;
			title = result.document.title;
			cmsState = {
				status: 'done',
				message: status === 'published' ? 'Published' : 'Draft saved'
			};
			await loadDocuments();
			cmsState = {
				status: 'done',
				message: status === 'published' ? 'Published' : 'Draft saved'
			};
		} catch (error) {
			cmsState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Could not save document.'
			};
		}
	}

	async function deleteCurrentDocument() {
		if (!activeDocumentId) return;
		if (!window.confirm(`Delete "${title}"?`)) return;

		cmsState = { status: 'saving', message: 'Deleting document' };

		try {
			await readApiResponse<ApiMessage>(
				await fetch(`/api/documents/${activeDocumentId}`, { method: 'DELETE' })
			);
			newDocument();
			await loadDocuments();
			cmsState = { status: 'done', message: 'Document deleted' };
		} catch (error) {
			cmsState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Could not delete document.'
			};
		}
	}

	onMount(() => {
		void loadDocuments();
	});
</script>

<svelte:head>
	<title>SvelteKit Bun Tiptap PoC</title>
	<meta
		name="description"
		content="Proof of concept for SvelteKit, Bun, and Tiptap rich text editing."
	/>
</svelte:head>

<main class="workspace">
	<header class="topbar">
		<div>
			<p class="eyebrow">SvelteKit + Bun</p>
			<h1>Richtext CMS Lab</h1>
		</div>
		<div class="topbar-actions">
			<a class="viewer-link" href={resolve('/')}>View content</a>
			<div class="stack-tags" aria-label="Tech stack">
				<span>Bun</span>
				<span>SvelteKit</span>
				<span>Tiptap 3</span>
				<span>Drizzle</span>
			</div>
		</div>
	</header>

	<section class="cms-control" aria-label="CMS document controls">
		<label class="title-field">
			<span>Title · {activeStatus}</span>
			<input bind:value={title} disabled={isCmsBusy} maxlength="140" />
		</label>

		<div class="cms-actions">
			<button
				type="button"
				class="command primary"
				disabled={isCmsBusy}
				onclick={() => saveDocument('draft')}
			>
				<Save size={16} />
				<span>Save draft</span>
			</button>
			<button
				type="button"
				class="command publish"
				disabled={isCmsBusy}
				onclick={() => saveDocument('published')}
			>
				<Send size={16} />
				<span>Publish</span>
			</button>
			<button type="button" class="command" disabled={isCmsBusy} onclick={newDocument}>
				<Plus size={16} />
				<span>New</span>
			</button>
			<button type="button" class="command" disabled={isCmsBusy} onclick={loadDocuments}>
				<RefreshCw size={16} />
				<span>Refresh</span>
			</button>
			<button
				type="button"
				class="command danger"
				disabled={isCmsBusy || !activeDocumentId}
				onclick={deleteCurrentDocument}
			>
				<Trash2 size={16} />
				<span>Delete</span>
			</button>
		</div>

		<div
			class:good={cmsState.status === 'done'}
			class:error={cmsState.status === 'error'}
			class="cms-status"
		>
			{#if cmsState.status === 'done'}
				<CheckCircle2 size={16} />
			{:else if cmsState.status === 'loading' || cmsState.status === 'saving'}
				<span class="spin"><RefreshCw size={16} /></span>
			{:else}
				<FileText size={16} />
			{/if}
			<span>{cmsState.message || (activeDocument ? activeDocument.slug : 'Unsaved draft')}</span>
		</div>
	</section>

	<section class="lab-grid">
		{#key editorKey}
			<TiptapEditor initialContent={editorContent} onChange={updateSnapshot} />
		{/key}

		<aside class="inspector" aria-label="Editor output">
			<div class="documents-card">
				<div class="documents-head">
					<div class="output-title">
						<Database size={17} />
						<span>Documents</span>
					</div>
					<strong>{documents.length}</strong>
				</div>

				<div class="document-list">
					{#if documents.length === 0}
						<p class="empty-state">No saved documents.</p>
					{:else}
						{#each documents as document (document.id)}
							<button
								type="button"
								class="document-row"
								class:active={activeDocumentId === document.id}
								disabled={isCmsBusy}
								onclick={() => openDocument(document.id)}
							>
								<span class="doc-title">{document.title}</span>
								<span class:published={document.status === 'published'} class="doc-status"
									>{document.status}</span
								>
								<span class="doc-meta"
									>{document.wordCount.toLocaleString()} words · {formatDate(
										document.updatedAt
									)}</span
								>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<div class="metric-grid">
				<article>
					<Type size={17} />
					<span>Words</span>
					<strong>{snapshot.words.toLocaleString()}</strong>
				</article>
				<article>
					<Gauge size={17} />
					<span>Chars</span>
					<strong>{snapshot.characters.toLocaleString()}</strong>
				</article>
			</div>

			<div class="output-card">
				<div class="output-head">
					<div class="output-title">
						{#if outputMode === 'html'}
							<FileCode size={17} />
						{:else}
							<Braces size={17} />
						{/if}
						<span>{outputMode.toUpperCase()}</span>
					</div>
					<div class="segment" aria-label="Output mode">
						<button
							type="button"
							class:active={outputMode === 'html'}
							aria-pressed={outputMode === 'html'}
							onclick={() => (outputMode = 'html')}
						>
							HTML
						</button>
						<button
							type="button"
							class:active={outputMode === 'json'}
							aria-pressed={outputMode === 'json'}
							onclick={() => (outputMode = 'json')}
						>
							JSON
						</button>
					</div>
				</div>

				<pre>{outputMode === 'html' ? snapshot.html : serializedJson}</pre>
			</div>

			<div class="rendered-card">
				<div class="rendered-head">Preview</div>
				<RichTextPreview doc={snapshot.json} />
			</div>
		</aside>
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background:
			linear-gradient(90deg, rgba(31, 138, 131, 0.08) 1px, transparent 1px),
			linear-gradient(rgba(34, 31, 26, 0.07) 1px, transparent 1px), #efe7d2;
		background-size: 38px 38px;
		color: #221f1a;
		font-family: 'Segoe UI', 'Aptos', sans-serif;
	}

	button {
		font: inherit;
	}

	.workspace {
		width: min(1440px, 100%);
		margin: 0 auto;
		padding: 28px;
	}

	.topbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 18px;
	}

	.cms-control {
		display: grid;
		grid-template-columns: minmax(260px, 1fr) auto;
		gap: 12px 16px;
		align-items: end;
		margin-bottom: 18px;
		border: 1px solid #221f1a;
		background: #fffdf7;
		padding: 14px;
		box-shadow: 0 14px 38px rgba(22, 21, 18, 0.12);
	}

	.title-field {
		display: grid;
		gap: 7px;
		min-width: 0;
	}

	.title-field span,
	.cms-status,
	.doc-status,
	.doc-meta {
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0;
	}

	.title-field input {
		width: 100%;
		border: 1px solid rgba(34, 31, 26, 0.24);
		background: #fff7d6;
		color: #221f1a;
		padding: 11px 12px;
		font: inherit;
		font-weight: 760;
	}

	.title-field input:focus {
		outline: 3px solid rgba(31, 138, 131, 0.22);
		border-color: #1f8a83;
	}

	.cms-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 8px;
	}

	.command {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		min-height: 38px;
		border: 1px solid rgba(34, 31, 26, 0.24);
		border-radius: 6px;
		background: #fffdf7;
		color: #221f1a;
		padding: 8px 11px;
		font-size: 0.82rem;
		font-weight: 820;
		cursor: pointer;
	}

	.command:hover {
		border-color: #221f1a;
		background: #fff7d6;
		transform: translateY(-1px);
	}

	.command.primary {
		background: #221f1a;
		color: #fff7d6;
	}

	.command.publish {
		background: #1f8a83;
		color: #fffdf7;
	}

	.command.danger {
		color: #8f2f1d;
	}

	.command:disabled {
		cursor: progress;
		opacity: 0.55;
		transform: none;
	}

	.cms-status {
		grid-column: 1 / -1;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
		color: rgba(34, 31, 26, 0.68);
	}

	.cms-status.good {
		color: #0f6f69;
	}

	.cms-status.error {
		color: #8f2f1d;
	}

	.eyebrow {
		margin: 0 0 4px;
		color: #0f6f69;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0;
	}

	h1 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 2.45rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0;
	}

	.stack-tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 8px;
	}

	.topbar-actions {
		display: grid;
		justify-items: end;
		gap: 8px;
	}

	.viewer-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 36px;
		border: 1px solid rgba(34, 31, 26, 0.24);
		border-radius: 6px;
		background: #221f1a;
		color: #fff7d6;
		padding: 8px 11px;
		font-size: 0.82rem;
		font-weight: 820;
		text-decoration: none;
	}

	.viewer-link:hover {
		background: #1f8a83;
		transform: translateY(-1px);
	}

	.stack-tags span {
		border: 1px solid rgba(34, 31, 26, 0.28);
		background: #fff7d6;
		padding: 7px 10px;
		font-size: 0.78rem;
		font-weight: 750;
	}

	.lab-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(330px, 420px);
		gap: 18px;
		align-items: start;
	}

	.inspector {
		display: grid;
		gap: 14px;
		min-width: 0;
		position: sticky;
		top: 18px;
	}

	.metric-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.metric-grid article,
	.documents-card,
	.output-card,
	.rendered-card {
		border: 1px solid #221f1a;
		background: #fffdf7;
		box-shadow: 0 12px 30px rgba(22, 21, 18, 0.1);
	}

	.metric-grid article {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 10px;
		align-items: center;
		padding: 14px;
	}

	.metric-grid span {
		color: rgba(34, 31, 26, 0.64);
		font-size: 0.82rem;
		font-weight: 760;
		text-transform: uppercase;
		letter-spacing: 0;
	}

	.metric-grid strong {
		grid-column: 1 / -1;
		font-size: 1.9rem;
		line-height: 1;
	}

	.output-head,
	.documents-head,
	.rendered-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid rgba(34, 31, 26, 0.16);
		padding: 10px;
		background: #221f1a;
		color: #fff7d6;
	}

	.documents-head strong {
		display: inline-grid;
		place-items: center;
		min-width: 26px;
		height: 26px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(255, 255, 255, 0.1);
		font-size: 0.82rem;
	}

	.document-list {
		display: grid;
		max-height: 285px;
		overflow: auto;
		background: #fffdf7;
	}

	.document-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 10px;
		width: 100%;
		border: 0;
		border-bottom: 1px solid rgba(34, 31, 26, 0.12);
		background: transparent;
		color: #221f1a;
		padding: 11px 12px;
		text-align: left;
		cursor: pointer;
	}

	.document-row:hover,
	.document-row.active {
		background: #fff7d6;
	}

	.document-row:disabled {
		cursor: progress;
		opacity: 0.62;
	}

	.doc-title {
		min-width: 0;
		overflow: hidden;
		font-weight: 820;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-status {
		align-self: start;
		border: 1px solid rgba(34, 31, 26, 0.18);
		padding: 3px 6px;
		color: rgba(34, 31, 26, 0.66);
	}

	.doc-status.published {
		border-color: rgba(31, 138, 131, 0.35);
		background: #edf8f4;
		color: #0f6f69;
	}

	.doc-meta {
		grid-column: 1 / -1;
		color: rgba(34, 31, 26, 0.54);
		font-size: 0.72rem;
		text-transform: none;
	}

	.empty-state {
		margin: 0;
		padding: 14px;
		color: rgba(34, 31, 26, 0.62);
		font-size: 0.88rem;
		font-weight: 700;
	}

	.spin {
		display: inline-grid;
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.output-title {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0;
	}

	.segment {
		display: inline-flex;
		gap: 2px;
		border: 1px solid rgba(255, 255, 255, 0.22);
		padding: 2px;
		background: rgba(255, 255, 255, 0.08);
	}

	.segment button {
		border: 0;
		background: transparent;
		color: #fff7d6;
		padding: 5px 8px;
		font-size: 0.76rem;
		font-weight: 800;
		cursor: pointer;
	}

	.segment button.active {
		background: #ffe08a;
		color: #221f1a;
	}

	pre {
		height: 300px;
		margin: 0;
		overflow: auto;
		padding: 14px;
		background: #fffdf7;
		color: #221f1a;
		font-family: 'Cascadia Code', Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.55;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.rendered-head {
		justify-content: start;
		font-size: 0.82rem;
		font-weight: 800;
	}

	@media (max-width: 1040px) {
		.cms-control {
			grid-template-columns: 1fr;
		}

		.cms-actions {
			justify-content: start;
		}

		.lab-grid {
			grid-template-columns: 1fr;
		}

		.inspector {
			position: static;
		}
	}

	@media (max-width: 680px) {
		.workspace {
			padding: 16px;
		}

		.topbar {
			display: grid;
			align-items: start;
		}

		.stack-tags {
			justify-content: start;
		}

		.topbar-actions {
			justify-items: start;
		}

		h1 {
			font-size: 2rem;
		}
	}
</style>
