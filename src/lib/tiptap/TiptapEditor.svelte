<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { StarterKit } from '@tiptap/starter-kit';
	import BubbleMenu from '@tiptap/extension-bubble-menu';
	import CharacterCount from '@tiptap/extension-character-count';
	import Highlight from '@tiptap/extension-highlight';
	import TiptapImage from '@tiptap/extension-image';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import TextAlign from '@tiptap/extension-text-align';
	import Typography from '@tiptap/extension-typography';
	import Underline from '@tiptap/extension-underline';
	import {
		AlignCenter,
		AlignLeft,
		AlignRight,
		Bold,
		Code,
		Eraser,
		Heading1,
		Heading2,
		Highlighter,
		ImagePlus,
		Italic,
		Link2,
		List,
		ListOrdered,
		LoaderCircle,
		Pilcrow,
		Quote,
		Redo2,
		SeparatorHorizontal,
		Strikethrough,
		Trash2,
		Underline as UnderlineIcon,
		Undo2,
		Unlink
	} from 'lucide-svelte';
	import { CHARACTER_LIMIT, SAMPLE_CONTENT, type RichTextSnapshot } from './editor-data';

	type Props = {
		initialContent?: string;
		onChange?: (snapshot: RichTextSnapshot) => void;
	};

	type UploadState = {
		status: 'idle' | 'uploading' | 'done' | 'error';
		message: string;
	};

	type UploadResponse = {
		url?: string;
		message?: string;
	};

	const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
	const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

	let { initialContent = SAMPLE_CONTENT, onChange }: Props = $props();

	let element = $state<HTMLDivElement>();
	let bubbleMenu = $state<HTMLDivElement>();
	let imageInput = $state<HTMLInputElement>();
	let editorState = $state<{ editor: Editor | null }>({ editor: null });
	let characters = $state(0);
	let words = $state(0);
	let uploadState = $state<UploadState>({ status: 'idle', message: '' });
	let characterPercent = $derived(Math.min((characters / CHARACTER_LIMIT) * 100, 100));
	let uploadLabel = $derived(
		uploadState.status === 'uploading' ? 'Uploading image' : 'Upload image'
	);

	function normalizeUrl(url: string) {
		if (/^https?:\/\//i.test(url) || url.startsWith('mailto:')) return url;
		return `https://${url}`;
	}

	function emitSnapshot(editor: Editor) {
		characters = editor.storage.characterCount.characters();
		words = editor.storage.characterCount.words();

		onChange?.({
			html: editor.getHTML(),
			json: editor.getJSON(),
			text: editor.getText({ blockSeparator: '\n' }),
			words,
			characters
		});
	}

	function setLink(editor: Editor) {
		const previousUrl = editor.getAttributes('link').href as string | undefined;
		const nextUrl = window.prompt('URL', previousUrl ?? 'https://');

		if (nextUrl === null) return;

		const href = nextUrl.trim();

		if (!href) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		editor
			.chain()
			.focus()
			.extendMarkRange('link')
			.setLink({ href: normalizeUrl(href) })
			.run();
	}

	function triggerImageUpload() {
		imageInput?.click();
	}

	function validateImageFile(file: File) {
		if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return 'Use PNG, JPG, WebP, or GIF.';
		if (file.size > IMAGE_MAX_BYTES) return 'Image must be 5MB or smaller.';
		return null;
	}

	async function uploadImageFile(file: File, editor: Editor) {
		const validationError = validateImageFile(file);

		if (validationError) {
			uploadState = { status: 'error', message: validationError };
			return;
		}

		const formData = new FormData();
		formData.set('image', file);
		uploadState = { status: 'uploading', message: `Uploading ${file.name}` };

		try {
			const response = await fetch('/api/uploads', {
				method: 'POST',
				body: formData
			});
			const result = (await response.json()) as UploadResponse;

			if (!response.ok || !result.url) {
				throw new Error(result.message ?? 'Upload failed.');
			}

			editor.chain().focus().setImage({ src: result.url, alt: file.name, title: file.name }).run();
			uploadState = { status: 'done', message: `Inserted ${file.name}` };
		} catch (error) {
			uploadState = {
				status: 'error',
				message: error instanceof Error ? error.message : 'Upload failed.'
			};
		}
	}

	async function handleImageInput(event: Event, editor: Editor) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];

		input.value = '';

		if (!file) return;
		await uploadImageFile(file, editor);
	}

	onMount(() => {
		if (!element || !bubbleMenu) return;

		const editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3]
					},
					link: false,
					underline: false
				}),
				BubbleMenu.configure({
					element: bubbleMenu
				}),
				CharacterCount.configure({
					limit: CHARACTER_LIMIT
				}),
				Highlight.configure({
					multicolor: true
				}),
				TiptapImage.configure({
					allowBase64: false,
					HTMLAttributes: {
						class: 'rich-image',
						decoding: 'async',
						loading: 'lazy'
					}
				}),
				Link.configure({
					autolink: true,
					defaultProtocol: 'https',
					linkOnPaste: true,
					openOnClick: false,
					HTMLAttributes: {
						rel: 'noopener noreferrer',
						target: '_blank'
					}
				}),
				Placeholder.configure({
					placeholder: ({ node }) =>
						node.type.name === 'heading' ? 'หัวข้อเอกสาร' : 'เริ่มเขียนข้อความ...'
				}),
				TextAlign.configure({
					types: ['heading', 'paragraph']
				}),
				Typography,
				Underline
			],
			content: initialContent,
			editorProps: {
				attributes: {
					'aria-label': 'Rich text editor',
					class: 'prose-editor'
				}
			},
			onCreate: ({ editor }) => {
				editorState = { editor };
				emitSnapshot(editor);
			},
			onTransaction: ({ editor }) => {
				editorState = { editor };
				emitSnapshot(editor);
			}
		});

		return () => {
			editor.destroy();
		};
	});
</script>

<section class="editor-shell" aria-label="Tiptap editor">
	<div class="bubble-menu" bind:this={bubbleMenu}>
		{#if editorState.editor}
			{@const editor = editorState.editor}
			<button
				type="button"
				class:active={editor.isActive('bold')}
				aria-label="Bold"
				aria-pressed={editor.isActive('bold')}
				title="Bold"
				onclick={() => editor.chain().focus().toggleBold().run()}
			>
				<Bold size={16} />
			</button>
			<button
				type="button"
				class:active={editor.isActive('italic')}
				aria-label="Italic"
				aria-pressed={editor.isActive('italic')}
				title="Italic"
				onclick={() => editor.chain().focus().toggleItalic().run()}
			>
				<Italic size={16} />
			</button>
			<button
				type="button"
				class:active={editor.isActive('highlight')}
				aria-label="Highlight"
				aria-pressed={editor.isActive('highlight')}
				title="Highlight"
				onclick={() => editor.chain().focus().toggleHighlight({ color: '#ffe08a' }).run()}
			>
				<Highlighter size={16} />
			</button>
			<button
				type="button"
				class:active={editor.isActive('link')}
				aria-label="Link"
				aria-pressed={editor.isActive('link')}
				title="Link"
				onclick={() => setLink(editor)}
			>
				<Link2 size={16} />
			</button>
		{/if}
	</div>

	{#if editorState.editor}
		{@const editor = editorState.editor}
		<div class="toolbar" aria-label="Editor toolbar">
			<div class="tool-group" aria-label="History">
				<button
					type="button"
					aria-label="Undo"
					title="Undo"
					onclick={() => editor.chain().focus().undo().run()}
				>
					<Undo2 size={16} />
				</button>
				<button
					type="button"
					aria-label="Redo"
					title="Redo"
					onclick={() => editor.chain().focus().redo().run()}
				>
					<Redo2 size={16} />
				</button>
			</div>

			<div class="tool-group" aria-label="Blocks">
				<button
					type="button"
					class:active={editor.isActive('heading', { level: 1 })}
					aria-label="Heading 1"
					aria-pressed={editor.isActive('heading', { level: 1 })}
					title="Heading 1"
					onclick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
				>
					<Heading1 size={17} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('heading', { level: 2 })}
					aria-label="Heading 2"
					aria-pressed={editor.isActive('heading', { level: 2 })}
					title="Heading 2"
					onclick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
				>
					<Heading2 size={17} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('paragraph')}
					aria-label="Paragraph"
					aria-pressed={editor.isActive('paragraph')}
					title="Paragraph"
					onclick={() => editor.chain().focus().setParagraph().run()}
				>
					<Pilcrow size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('blockquote')}
					aria-label="Quote"
					aria-pressed={editor.isActive('blockquote')}
					title="Quote"
					onclick={() => editor.chain().focus().toggleBlockquote().run()}
				>
					<Quote size={16} />
				</button>
			</div>

			<div class="tool-group" aria-label="Marks">
				<button
					type="button"
					class:active={editor.isActive('bold')}
					aria-label="Bold"
					aria-pressed={editor.isActive('bold')}
					title="Bold"
					onclick={() => editor.chain().focus().toggleBold().run()}
				>
					<Bold size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('italic')}
					aria-label="Italic"
					aria-pressed={editor.isActive('italic')}
					title="Italic"
					onclick={() => editor.chain().focus().toggleItalic().run()}
				>
					<Italic size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('underline')}
					aria-label="Underline"
					aria-pressed={editor.isActive('underline')}
					title="Underline"
					onclick={() => editor.chain().focus().toggleUnderline().run()}
				>
					<UnderlineIcon size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('strike')}
					aria-label="Strike"
					aria-pressed={editor.isActive('strike')}
					title="Strike"
					onclick={() => editor.chain().focus().toggleStrike().run()}
				>
					<Strikethrough size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('highlight')}
					aria-label="Highlight"
					aria-pressed={editor.isActive('highlight')}
					title="Highlight"
					onclick={() => editor.chain().focus().toggleHighlight({ color: '#ffe08a' }).run()}
				>
					<Highlighter size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('code')}
					aria-label="Inline code"
					aria-pressed={editor.isActive('code')}
					title="Inline code"
					onclick={() => editor.chain().focus().toggleCode().run()}
				>
					<Code size={16} />
				</button>
			</div>

			<div class="tool-group" aria-label="Lists">
				<button
					type="button"
					class:active={editor.isActive('bulletList')}
					aria-label="Bullet list"
					aria-pressed={editor.isActive('bulletList')}
					title="Bullet list"
					onclick={() => editor.chain().focus().toggleBulletList().run()}
				>
					<List size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive('orderedList')}
					aria-label="Ordered list"
					aria-pressed={editor.isActive('orderedList')}
					title="Ordered list"
					onclick={() => editor.chain().focus().toggleOrderedList().run()}
				>
					<ListOrdered size={16} />
				</button>
			</div>

			<div class="tool-group" aria-label="Alignment">
				<button
					type="button"
					class:active={editor.isActive({ textAlign: 'left' })}
					aria-label="Align left"
					aria-pressed={editor.isActive({ textAlign: 'left' })}
					title="Align left"
					onclick={() => editor.chain().focus().setTextAlign('left').run()}
				>
					<AlignLeft size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive({ textAlign: 'center' })}
					aria-label="Align center"
					aria-pressed={editor.isActive({ textAlign: 'center' })}
					title="Align center"
					onclick={() => editor.chain().focus().setTextAlign('center').run()}
				>
					<AlignCenter size={16} />
				</button>
				<button
					type="button"
					class:active={editor.isActive({ textAlign: 'right' })}
					aria-label="Align right"
					aria-pressed={editor.isActive({ textAlign: 'right' })}
					title="Align right"
					onclick={() => editor.chain().focus().setTextAlign('right').run()}
				>
					<AlignRight size={16} />
				</button>
			</div>

			<div class="tool-group" aria-label="Insert and clean">
				<input
					bind:this={imageInput}
					class="file-input"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onchange={(event) => handleImageInput(event, editor)}
				/>
				<button
					type="button"
					class:uploading={uploadState.status === 'uploading'}
					disabled={uploadState.status === 'uploading'}
					aria-label={uploadLabel}
					title={uploadLabel}
					onclick={triggerImageUpload}
				>
					{#if uploadState.status === 'uploading'}
						<span class="spin">
							<LoaderCircle size={16} />
						</span>
					{:else}
						<ImagePlus size={16} />
					{/if}
				</button>
				<button
					type="button"
					aria-label="Set link"
					title="Set link"
					onclick={() => setLink(editor)}
				>
					<Link2 size={16} />
				</button>
				<button
					type="button"
					aria-label="Remove link"
					title="Remove link"
					onclick={() => editor.chain().focus().unsetLink().run()}
				>
					<Unlink size={16} />
				</button>
				<button
					type="button"
					aria-label="Horizontal rule"
					title="Horizontal rule"
					onclick={() => editor.chain().focus().setHorizontalRule().run()}
				>
					<SeparatorHorizontal size={16} />
				</button>
				<button
					type="button"
					aria-label="Clear marks"
					title="Clear marks"
					onclick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
				>
					<Eraser size={16} />
				</button>
				<button
					type="button"
					aria-label="Reset sample"
					title="Reset sample"
					onclick={() => editor.commands.setContent(initialContent)}
				>
					<Trash2 size={16} />
				</button>
			</div>
		</div>
	{/if}

	<div class="paper-wrap">
		<div bind:this={element}></div>
	</div>

	<div class="editor-footer" aria-label="Document stats">
		<span>{words.toLocaleString()} words</span>
		<span>{characters.toLocaleString()} / {CHARACTER_LIMIT.toLocaleString()} chars</span>
		{#if uploadState.status !== 'idle'}
			<span class:error={uploadState.status === 'error'} aria-live="polite"
				>{uploadState.message}</span
			>
		{/if}
		<span class="meter" aria-hidden="true">
			<span style={`width: ${characterPercent}%`}></span>
		</span>
	</div>
</section>

<style>
	.editor-shell {
		border: 1px solid #221f1a;
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(246, 242, 229, 0.92)), #f7f1df;
		box-shadow: 0 18px 54px rgba(22, 21, 18, 0.14);
		min-width: 0;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		padding: 12px;
		border-bottom: 1px solid rgba(34, 31, 26, 0.2);
		background: rgba(255, 251, 240, 0.82);
		backdrop-filter: blur(18px);
		position: sticky;
		top: 0;
		z-index: 3;
	}

	.tool-group,
	.bubble-menu {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.tool-group {
		padding: 3px;
		border: 1px solid rgba(34, 31, 26, 0.18);
		background: rgba(255, 255, 255, 0.56);
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	button {
		display: inline-grid;
		place-items: center;
		width: 34px;
		height: 32px;
		border: 1px solid transparent;
		border-radius: 6px;
		background: transparent;
		color: #29251d;
		cursor: pointer;
		transition:
			background-color 140ms ease,
			border-color 140ms ease,
			transform 140ms ease,
			color 140ms ease;
	}

	button:hover {
		border-color: rgba(34, 31, 26, 0.28);
		background: #fff7d6;
		transform: translateY(-1px);
	}

	button.active {
		border-color: #221f1a;
		background: #221f1a;
		color: #fff7d6;
	}

	button:disabled {
		cursor: progress;
		opacity: 0.72;
		transform: none;
	}

	button.uploading {
		background: #edf8f4;
		color: #0f6f69;
	}

	.spin {
		animation: spin 900ms linear infinite;
	}

	.bubble-menu {
		padding: 5px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: #221f1a;
		box-shadow: 0 14px 34px rgba(15, 14, 12, 0.22);
	}

	.bubble-menu button {
		color: #fff7d6;
	}

	.bubble-menu button:hover,
	.bubble-menu button.active {
		border-color: #ffe08a;
		background: #ffe08a;
		color: #221f1a;
	}

	.paper-wrap {
		min-height: 520px;
		padding: 34px;
		background:
			linear-gradient(rgba(34, 31, 26, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(34, 31, 26, 0.035) 1px, transparent 1px), #fffdf7;
		background-size: 34px 34px;
	}

	:global(.prose-editor) {
		min-height: 440px;
		outline: none;
		color: #211d17;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1.03rem;
		line-height: 1.72;
	}

	:global(.prose-editor > * + *) {
		margin-top: 0.86em;
	}

	:global(.prose-editor h1),
	:global(.prose-editor h2),
	:global(.prose-editor h3) {
		font-family: 'Segoe UI', 'Aptos Display', sans-serif;
		font-weight: 760;
		line-height: 1.1;
		letter-spacing: 0;
	}

	:global(.prose-editor h1) {
		font-size: 2.4rem;
		margin: 0 0 0.5em;
	}

	:global(.prose-editor h2) {
		font-size: 1.55rem;
		margin-top: 1.25em;
	}

	:global(.prose-editor h3) {
		font-size: 1.18rem;
	}

	:global(.prose-editor p) {
		margin: 0;
	}

	:global(.prose-editor ul),
	:global(.prose-editor ol) {
		padding-left: 1.35rem;
	}

	:global(.prose-editor blockquote) {
		margin: 1.2rem 0;
		padding: 0.9rem 1rem;
		border-left: 4px solid #1f8a83;
		background: #edf8f4;
	}

	:global(.prose-editor code) {
		border: 1px solid rgba(34, 31, 26, 0.14);
		background: #f1ead8;
		padding: 0.08rem 0.34rem;
		font-family: 'Cascadia Code', Consolas, monospace;
		font-size: 0.92em;
	}

	:global(.prose-editor pre) {
		overflow: auto;
		padding: 1rem;
		background: #221f1a;
		color: #fff7d6;
	}

	:global(.prose-editor pre code) {
		border: 0;
		background: transparent;
		color: inherit;
		padding: 0;
	}

	:global(.prose-editor a) {
		color: #0f6f69;
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
	}

	:global(.prose-editor img) {
		display: block;
		width: auto;
		max-width: min(100%, 760px);
		max-height: 520px;
		height: auto;
		margin: 1.4rem auto;
		border: 1px solid rgba(34, 31, 26, 0.22);
		background: #f1ead8;
		box-shadow: 0 18px 42px rgba(22, 21, 18, 0.16);
	}

	:global(.prose-editor img.ProseMirror-selectednode) {
		outline: 3px solid #1f8a83;
		outline-offset: 4px;
	}

	:global(.prose-editor hr) {
		border: 0;
		border-top: 2px solid rgba(34, 31, 26, 0.18);
		margin: 1.8rem 0;
	}

	:global(.prose-editor mark) {
		background: #ffe08a;
		padding: 0 0.12rem;
	}

	:global(.prose-editor .is-empty::before) {
		content: attr(data-placeholder);
		float: left;
		height: 0;
		color: rgba(34, 31, 26, 0.42);
		pointer-events: none;
	}

	.editor-footer {
		display: grid;
		grid-template-columns: max-content max-content minmax(110px, 1fr);
		align-items: center;
		gap: 12px;
		padding: 11px 14px;
		border-top: 1px solid rgba(34, 31, 26, 0.16);
		background: #221f1a;
		color: #fff7d6;
		font-family: 'Segoe UI', 'Aptos', sans-serif;
		font-size: 0.83rem;
	}

	.meter {
		position: relative;
		display: block;
		height: 8px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.12);
	}

	.meter span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #1f8a83, #ffe08a);
	}

	.error {
		color: #ffb6a6;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 760px) {
		.toolbar {
			position: static;
			padding: 10px;
		}

		.paper-wrap {
			min-height: 430px;
			padding: 22px;
		}

		:global(.prose-editor h1) {
			font-size: 1.85rem;
		}

		.editor-footer {
			grid-template-columns: 1fr;
		}
	}
</style>
