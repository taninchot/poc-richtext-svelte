# SvelteKit + Bun + Tiptap PoC

โปรเจกต์นี้เป็น playground สำหรับทดลอง rich text editor ด้วย SvelteKit, Bun และ Tiptap 3

## Run

```sh
bun install
bun run dev
```

เปิด `http://localhost:5173`

## Scripts

```sh
bun run check
bun run lint
bun run build
bun run test
```

## โครงที่สำคัญ

- `src/lib/tiptap/TiptapEditor.svelte` สร้าง Tiptap editor ฝั่ง client ด้วย `onMount`
- `src/lib/tiptap/RichTextPreview.svelte` render preview จาก Tiptap JSON เป็น Svelte markup
- `src/lib/tiptap/editor-data.ts` เก็บ sample content, type ของ snapshot และ character limit
- `src/routes/+page.svelte` รับ snapshot จาก editor แล้วแสดง HTML/JSON ที่พร้อมส่งไป persist
- `src/routes/api/uploads/+server.ts` รับ image upload แล้วบันทึกลง `static/uploads`

## Flow ที่ควรต่อในงานจริง

1. เก็บ `snapshot.json` เป็น source of truth ใน database
2. สร้าง HTML จาก JSON ตอน preview/render หรือเก็บ HTML แยกเป็น cache
3. sanitize HTML ก่อน render ถ้าข้อมูลมาจากผู้ใช้ที่ไม่ trusted
4. เพิ่ม extension ตาม domain เช่น image upload, table, mention, task list หรือ collaboration

## Image upload PoC

ปุ่มรูปภาพใน toolbar จะส่งไฟล์ไปที่ `POST /api/uploads` และ insert URL ที่ได้กลับมาเข้า Tiptap document ทันที

- รับเฉพาะ `png`, `jpg`, `webp`, `gif`
- จำกัดไฟล์ละ 5MB
- ไฟล์ที่ upload ระหว่าง dev จะอยู่ใน `static/uploads`
- งาน production ควรเปลี่ยน endpoint นี้ให้ส่งต่อไป object storage เช่น S3, R2 หรือ Supabase Storage

## แพ็กเกจ Tiptap ที่ใช้

- `@tiptap/core`
- `@tiptap/pm`
- `@tiptap/starter-kit`
- `@tiptap/extension-bubble-menu`
- `@tiptap/extension-character-count`
- `@tiptap/extension-highlight`
- `@tiptap/extension-image`
- `@tiptap/extension-link`
- `@tiptap/extension-placeholder`
- `@tiptap/extension-text-align`
- `@tiptap/extension-typography`
- `@tiptap/extension-underline`
