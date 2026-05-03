import type { JSONContent } from '@tiptap/core';

export const CHARACTER_LIMIT = 2800;

export type RichTextSnapshot = {
	html: string;
	json: JSONContent;
	text: string;
	words: number;
	characters: number;
};

export function createEmptySnapshot(): RichTextSnapshot {
	return {
		html: '',
		json: {
			type: 'doc',
			content: []
		},
		text: '',
		words: 0,
		characters: 0
	};
}

export const SAMPLE_CONTENT = `
	<h1>Release note: Rich text PoC</h1>
	<p><strong>SvelteKit</strong> + <strong>Bun</strong> + <strong>Tiptap</strong> พร้อมชุดคำสั่งพื้นฐานสำหรับเอกสารในแอปจริง</p>
	<h2>สิ่งที่ทดลอง</h2>
	<ul>
		<li>เก็บข้อมูลเป็น JSON document และแปลงเป็น HTML ได้ทันที</li>
		<li>รองรับ heading, list, quote, code, highlight, underline และ link</li>
		<li>มี character count สำหรับจำกัดความยาวก่อนบันทึก</li>
	</ul>
	<blockquote>
		<p>โครงนี้เหมาะเอาไปต่อกับ autosave, database persistence, upload image หรือ collaborative editing ในรอบถัดไป</p>
	</blockquote>
	<p>ลองเลือกข้อความบางส่วนเพื่อใช้ bubble menu หรือใช้ toolbar ด้านบนสำหรับปรับรูปแบบของบล็อก</p>
`;
