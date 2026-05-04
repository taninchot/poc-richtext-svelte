<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { JSONContent } from '@tiptap/core';
	import { BookOpenText, Edit3, FileText, RefreshCw } from 'lucide-svelte';
	import RichTextPreview from '$lib/tiptap/RichTextPreview.svelte';
	import { createEmptySnapshot } from '$lib/tiptap/editor-data';

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

	type ReaderState = {
		status: 'idle' | 'loading' | 'done' | 'error';
		message: string;
	};

	const emptyDocument = createEmptySnapshot().json;

	let documents = $state<CmsDocumentSummary[]>([]);
	let activeDocument = $state<CmsDocument | null>(null);
	let readerState = $state<ReaderState>({ status: 'idle', message: '' });

	let publishedDocuments = $derived(
		documents.filter((document) => document.status === 'published')
	);
	let activeDocumentJson = $derived(activeDocument?.contentJson ?? emptyDocument);
	let isLoading = $derived(readerState.status === 'loading');

	async function readApiResponse<T extends ApiMessage>(response: Response): Promise<T> {
		const body = (await response.json().catch(() => ({}))) as T;

		if (!response.ok) {
			throw new Error(body.message ?? `Request failed with ${response.status}.`);
		}

		return body;
	}

	function formatDate(value: string | null) {
		if (!value) return 'Not published';

		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	async function openDocument(id: string) {
		readerState = { status: 'loading', message: 'Loading content' };

		try {
			const result = await readApiResponse<DocumentResponse>(await fetch(`/api/documents/${id}`));

			if (!result.document) {
				throw new Error('Document not found.');
			}

			activeDocument = result.document;
			readerState = { status: 'done', message: 'Content loaded' };
		} catch (error) {
			readerState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Could not load content.'
			};
		}
	}

	async function loadPublishedDocuments() {
		readerState = { status: 'loading', message: 'Loading published documents' };

		try {
			const result = await readApiResponse<DocumentListResponse>(await fetch('/api/documents'));
			documents = result.documents ?? [];

			const firstPublished = documents.find((document) => document.status === 'published') ?? null;

			if (!firstPublished) {
				activeDocument = null;
				readerState = { status: 'done', message: 'No published content yet' };
				return;
			}

			await openDocument(firstPublished.id);
		} catch (error) {
			readerState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Could not load documents.'
			};
		}
	}

	onMount(() => {
		void loadPublishedDocuments();
	});
</script>

<svelte:head>
	<title>Content Viewer</title>
	<meta name="description" content="Read published rich text content from the CMS." />
</svelte:head>

<main class="reader-shell">
	<header class="reader-topbar">
		<div>
			<p class="eyebrow">Published content</p>
			<h1>{activeDocument?.title ?? 'Content Viewer'}</h1>
		</div>

		<a class="editor-link" href={resolve('/editor')}>
			<Edit3 size={16} />
			<span>Editor</span>
		</a>
	</header>

	<section class="reader-grid">
		<aside class="document-nav" aria-label="Published documents">
			<div class="nav-head">
				<div class="nav-title">
					<BookOpenText size={17} />
					<span>Published</span>
				</div>
				<button
					type="button"
					class="icon-command"
					disabled={isLoading}
					aria-label="Refresh published documents"
					title="Refresh"
					onclick={loadPublishedDocuments}
				>
					<RefreshCw size={16} />
				</button>
			</div>

			<div class="document-list">
				{#if publishedDocuments.length === 0}
					<p class="empty-state">No published content.</p>
				{:else}
					{#each publishedDocuments as document (document.id)}
						<button
							type="button"
							class="document-row"
							class:active={activeDocument?.id === document.id}
							disabled={isLoading}
							onclick={() => openDocument(document.id)}
						>
							<span class="doc-title">{document.title}</span>
							<span class="doc-meta"
								>{document.wordCount.toLocaleString()} words - {formatDate(
									document.publishedAt ?? document.updatedAt
								)}</span
							>
						</button>
					{/each}
				{/if}
			</div>
		</aside>

		<article class="content-sheet" aria-live="polite">
			<div
				class:error={readerState.status === 'error'}
				class:loading={readerState.status === 'loading'}
				class="reader-status"
			>
				{#if readerState.status === 'loading'}
					<span class="spin"><RefreshCw size={15} /></span>
				{:else}
					<FileText size={15} />
				{/if}
				<span>{readerState.message || 'Ready'}</span>
			</div>

			{#if activeDocument}
				<div class="article-meta">
					<span>{activeDocument.slug}</span>
					<span>{formatDate(activeDocument.publishedAt ?? activeDocument.updatedAt)}</span>
				</div>

				<RichTextPreview doc={activeDocumentJson} variant="article" />
			{:else}
				<div class="empty-reader">
					<FileText size={28} />
					<p>Publish a document from the editor to show it here.</p>
				</div>
			{/if}
		</article>
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background:
			linear-gradient(90deg, rgba(24, 102, 96, 0.08) 1px, transparent 1px),
			linear-gradient(rgba(34, 31, 26, 0.06) 1px, transparent 1px), #f2ead9;
		background-size: 40px 40px;
		color: #221f1a;
		font-family: 'Segoe UI', 'Aptos', sans-serif;
	}

	button,
	a {
		font: inherit;
	}

	.reader-shell {
		width: min(1180px, 100%);
		margin: 0 auto;
		padding: 30px;
	}

	.reader-topbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 18px;
		margin-bottom: 18px;
	}

	.eyebrow {
		margin: 0 0 5px;
		color: #0f6f69;
		font-size: 0.78rem;
		font-weight: 850;
		text-transform: uppercase;
		letter-spacing: 0;
	}

	h1 {
		max-width: 860px;
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(2rem, 5vw, 4.5rem);
		font-weight: 700;
		line-height: 0.98;
		letter-spacing: 0;
		overflow-wrap: anywhere;
	}

	.editor-link,
	.icon-command {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(34, 31, 26, 0.24);
		border-radius: 6px;
		background: #221f1a;
		color: #fff7d6;
		cursor: pointer;
		text-decoration: none;
	}

	.editor-link {
		gap: 7px;
		min-height: 38px;
		padding: 8px 12px;
		font-size: 0.82rem;
		font-weight: 820;
	}

	.editor-link:hover,
	.icon-command:hover {
		background: #0f6f69;
		transform: translateY(-1px);
	}

	.reader-grid {
		display: grid;
		grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
		gap: 18px;
		align-items: start;
	}

	.document-nav,
	.content-sheet {
		border: 1px solid #221f1a;
		background: #fffdf7;
		box-shadow: 0 14px 36px rgba(22, 21, 18, 0.12);
	}

	.document-nav {
		position: sticky;
		top: 18px;
	}

	.nav-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid rgba(34, 31, 26, 0.16);
		padding: 10px;
		background: #221f1a;
		color: #fff7d6;
	}

	.nav-title,
	.reader-status,
	.article-meta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.78rem;
		font-weight: 850;
		text-transform: uppercase;
		letter-spacing: 0;
	}

	.icon-command {
		width: 32px;
		height: 32px;
		padding: 0;
	}

	.icon-command:disabled {
		cursor: progress;
		opacity: 0.55;
		transform: none;
	}

	.document-list {
		display: grid;
		max-height: calc(100vh - 160px);
		overflow: auto;
	}

	.document-row {
		display: grid;
		gap: 5px;
		width: 100%;
		border: 0;
		border-bottom: 1px solid rgba(34, 31, 26, 0.12);
		background: transparent;
		color: #221f1a;
		padding: 12px;
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
		font-weight: 840;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.doc-meta {
		color: rgba(34, 31, 26, 0.56);
		font-size: 0.74rem;
		font-weight: 760;
	}

	.empty-state {
		margin: 0;
		padding: 14px;
		color: rgba(34, 31, 26, 0.62);
		font-size: 0.88rem;
		font-weight: 760;
	}

	.content-sheet {
		min-height: 520px;
		padding: 24px;
	}

	.reader-status {
		margin-bottom: 14px;
		color: rgba(34, 31, 26, 0.58);
	}

	.reader-status.error {
		color: #8f2f1d;
	}

	.reader-status.loading {
		color: #0f6f69;
	}

	.article-meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px 14px;
		margin-bottom: 24px;
		border-bottom: 1px solid rgba(34, 31, 26, 0.14);
		padding-bottom: 12px;
		color: rgba(34, 31, 26, 0.54);
	}

	.empty-reader {
		display: grid;
		place-items: center;
		gap: 12px;
		min-height: 340px;
		color: rgba(34, 31, 26, 0.58);
		text-align: center;
	}

	.empty-reader p {
		margin: 0;
		font-weight: 760;
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

	@media (max-width: 820px) {
		.reader-shell {
			padding: 18px;
		}

		.reader-topbar {
			display: grid;
			align-items: start;
		}

		.reader-grid {
			grid-template-columns: 1fr;
		}

		.document-nav {
			position: static;
		}

		.document-list {
			max-height: 280px;
		}
	}
</style>
