<script lang="ts">
	import { Braces, FileCode, Gauge, Type } from 'lucide-svelte';
	import RichTextPreview from '$lib/tiptap/RichTextPreview.svelte';
	import TiptapEditor from '$lib/tiptap/TiptapEditor.svelte';
	import { createEmptySnapshot, type RichTextSnapshot } from '$lib/tiptap/editor-data';

	let snapshot = $state<RichTextSnapshot>(createEmptySnapshot());
	let outputMode = $state<'html' | 'json'>('html');
	let serializedJson = $derived(JSON.stringify(snapshot.json, null, 2));

	function updateSnapshot(nextSnapshot: RichTextSnapshot) {
		snapshot = nextSnapshot;
	}
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
			<h1>Richtext Lab</h1>
		</div>
		<div class="stack-tags" aria-label="Tech stack">
			<span>Bun</span>
			<span>SvelteKit</span>
			<span>Tiptap 3</span>
		</div>
	</header>

	<section class="lab-grid">
		<TiptapEditor onChange={updateSnapshot} />

		<aside class="inspector" aria-label="Editor output">
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

		h1 {
			font-size: 2rem;
		}
	}
</style>
