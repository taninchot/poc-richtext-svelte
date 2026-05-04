<script lang="ts">
	import type { JSONContent } from '@tiptap/core';

	type Props = {
		doc: JSONContent;
		variant?: 'panel' | 'article';
	};

	type JsonMark = NonNullable<JSONContent['marks']>[number];

	const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
	const HIGHLIGHT_COLOR = /^#[0-9a-f]{3,8}$/i;
	const IMAGE_SRC = /^(\/|https?:\/\/)/i;
	const LINK_HREF = /^(\/|https?:\/\/|mailto:)/i;

	let { doc, variant = 'panel' }: Props = $props();

	function nodes(node: JSONContent) {
		return node.content ?? [];
	}

	function textAlign(node: JSONContent) {
		const value = String(node.attrs?.textAlign ?? '');
		return ALIGNMENTS.has(value) ? `text-align: ${value}` : undefined;
	}

	function headingLevel(node: JSONContent) {
		const level = Number(node.attrs?.level ?? 1);
		return level === 1 || level === 2 || level === 3 ? level : 1;
	}

	function plainText(node: JSONContent): string {
		if (node.text) return node.text;
		return nodes(node).map(plainText).join('');
	}

	function stringAttr(node: JSONContent, name: string) {
		const value = node.attrs?.[name];
		return typeof value === 'string' ? value : undefined;
	}

	function safeImageSrc(node: JSONContent) {
		const src = stringAttr(node, 'src');
		return src && IMAGE_SRC.test(src) ? src : undefined;
	}

	function safeHref(mark: JsonMark) {
		const href = mark.attrs?.href;
		return typeof href === 'string' && LINK_HREF.test(href) ? href : undefined;
	}

	function highlightStyle(mark: JsonMark) {
		const color = mark.attrs?.color;
		return typeof color === 'string' && HIGHLIGHT_COLOR.test(color)
			? `background-color: ${color}`
			: undefined;
	}

	function openPreviewLink(href: string) {
		window.open(href, '_blank', 'noopener,noreferrer');
	}
</script>

{#snippet renderNodes(content: JSONContent[])}
	{#each content as node, index (index)}
		{@render renderNode(node)}
	{/each}
{/snippet}

{#snippet renderNode(node: JSONContent)}
	{#if node.type === 'doc'}
		{@render renderNodes(nodes(node))}
	{:else if node.type === 'paragraph'}
		<p style={textAlign(node)}>
			{@render renderNodes(nodes(node))}
		</p>
	{:else if node.type === 'heading'}
		{@const level = headingLevel(node)}
		{#if level === 1}
			<h1 style={textAlign(node)}>{@render renderNodes(nodes(node))}</h1>
		{:else if level === 2}
			<h2 style={textAlign(node)}>{@render renderNodes(nodes(node))}</h2>
		{:else}
			<h3 style={textAlign(node)}>{@render renderNodes(nodes(node))}</h3>
		{/if}
	{:else if node.type === 'text'}
		{@render renderText(node.text ?? '', node.marks ?? [])}
	{:else if node.type === 'bulletList'}
		<ul>
			{@render renderNodes(nodes(node))}
		</ul>
	{:else if node.type === 'orderedList'}
		<ol>
			{@render renderNodes(nodes(node))}
		</ol>
	{:else if node.type === 'listItem'}
		<li>
			{@render renderNodes(nodes(node))}
		</li>
	{:else if node.type === 'blockquote'}
		<blockquote>
			{@render renderNodes(nodes(node))}
		</blockquote>
	{:else if node.type === 'codeBlock'}
		<pre><code>{plainText(node)}</code></pre>
	{:else if node.type === 'horizontalRule'}
		<hr />
	{:else if node.type === 'hardBreak'}
		<br />
	{:else if node.type === 'image'}
		{@const src = safeImageSrc(node)}
		{#if src}
			<img {src} alt={stringAttr(node, 'alt') ?? ''} title={stringAttr(node, 'title')} />
		{/if}
	{:else}
		{@render renderNodes(nodes(node))}
	{/if}
{/snippet}

{#snippet renderText(text: string, marks: JsonMark[])}
	{#if marks.length === 0}
		{text}
	{:else}
		{@const mark = marks[0]}
		{@const remainingMarks = marks.slice(1)}
		{#if mark.type === 'bold'}
			<strong>{@render renderText(text, remainingMarks)}</strong>
		{:else if mark.type === 'italic'}
			<em>{@render renderText(text, remainingMarks)}</em>
		{:else if mark.type === 'underline'}
			<u>{@render renderText(text, remainingMarks)}</u>
		{:else if mark.type === 'strike'}
			<s>{@render renderText(text, remainingMarks)}</s>
		{:else if mark.type === 'code'}
			<code>{@render renderText(text, remainingMarks)}</code>
		{:else if mark.type === 'highlight'}
			<mark style={highlightStyle(mark)}>{@render renderText(text, remainingMarks)}</mark>
		{:else if mark.type === 'link'}
			{@const href = safeHref(mark)}
			{#if href}
				<button class="preview-link" type="button" onclick={() => openPreviewLink(href)}
					>{@render renderText(text, remainingMarks)}</button
				>
			{:else}
				{@render renderText(text, remainingMarks)}
			{/if}
		{:else}
			{@render renderText(text, remainingMarks)}
		{/if}
	{/if}
{/snippet}

<div class="preview-body" class:article={variant === 'article'}>
	{@render renderNode(doc)}
</div>

<style>
	.preview-body {
		height: 270px;
		overflow: auto;
		padding: 18px;
		color: #221f1a;
		background: #fffdf7;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 0.96rem;
		line-height: 1.65;
	}

	.preview-body.article {
		height: auto;
		min-height: 320px;
		overflow: visible;
		padding: 0;
		background: transparent;
		font-size: 1.05rem;
	}

	.preview-body :global(h1),
	.preview-body :global(h2),
	.preview-body :global(h3) {
		font-family: 'Segoe UI', 'Aptos Display', sans-serif;
		line-height: 1.12;
		letter-spacing: 0;
	}

	.preview-body :global(h1) {
		font-size: 1.45rem;
	}

	.preview-body :global(h2) {
		font-size: 1.16rem;
	}

	.preview-body :global(blockquote) {
		margin: 0.8rem 0;
		padding: 0.7rem 0.8rem;
		border-left: 4px solid #1f8a83;
		background: #edf8f4;
	}

	.preview-link {
		display: inline;
		border: 0;
		background: transparent;
		color: #0f6f69;
		cursor: pointer;
		font: inherit;
		padding: 0;
		color: #0f6f69;
		text-align: inherit;
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
		text-decoration-line: underline;
	}

	.preview-body :global(code) {
		border: 1px solid rgba(34, 31, 26, 0.14);
		background: #f1ead8;
		padding: 0.08rem 0.34rem;
		font-family: 'Cascadia Code', Consolas, monospace;
		font-size: 0.92em;
	}

	.preview-body :global(pre) {
		overflow: auto;
		padding: 0.9rem;
		background: #221f1a;
		color: #fff7d6;
	}

	.preview-body :global(pre code) {
		border: 0;
		background: transparent;
		color: inherit;
		padding: 0;
	}

	.preview-body :global(img) {
		display: block;
		width: auto;
		max-width: 100%;
		max-height: 360px;
		height: auto;
		margin: 18px auto;
		border: 1px solid rgba(34, 31, 26, 0.22);
		background: #f1ead8;
	}

	.preview-body :global(mark) {
		background: #ffe08a;
	}
</style>
