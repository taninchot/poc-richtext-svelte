# SvelteKit + Bun + Tiptap PoC

โปรเจกต์นี้เป็น proof of concept สำหรับ rich text editor ด้วย SvelteKit, Bun, Svelte 5 runes, Tiptap 3, Drizzle และ Postgres

ตอนนี้แยกหน้าหลักออกเป็น 2 โหมดใหญ่ ๆ:

- `/` ใช้ดู content ที่บันทึกไว้
- `/editor` ใช้สร้างและแก้ไข content

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

## โครงสร้างสำคัญ

- `src/routes/+page.svelte` หน้า home สำหรับดู content
- `src/routes/editor/+page.svelte` หน้า editor สำหรับแก้ไข content
- `src/lib/tiptap/TiptapEditor.svelte` สร้าง Tiptap editor ฝั่ง client ด้วย `onMount`, toolbar, bubble menu และ image upload trigger
- `src/lib/tiptap/RichTextPreview.svelte` render preview จาก Tiptap JSON เป็น Svelte markup แบบไม่ inject raw HTML
- `src/lib/tiptap/editor-data.ts` เก็บ sample content, type ของ editor snapshot และ character limit
- `src/routes/api/documents/+server.ts` list/create documents ผ่าน Drizzle
- `src/routes/api/documents/[id]/+server.ts` read/update/delete document รายตัว
- `src/routes/api/uploads/+server.ts` upload image endpoint ทั้งแบบ proxy upload และ R2 presigned upload
- `src/routes/api/uploads/confirm/+server.ts` confirm R2 presigned upload ก่อนบันทึก metadata ลง database
- `src/lib/server/uploads/storage.ts` logic เลือก local/R2 storage และสร้าง trusted object URL
- `src/lib/server/uploads/validation.ts` validation กลางสำหรับชนิดไฟล์และขนาดรูป
- `src/hooks.server.ts` security headers และ Content Security Policy
- `src/lib/server/schema.ts` Drizzle schema สำหรับ `documents` และ `uploads`
- `drizzle/` generated migrations และ metadata ของ Drizzle

## Data Flow

1. Editor สร้าง `snapshot.json` จาก Tiptap JSON เป็น source of truth
2. API บันทึก document ลง Postgres ผ่าน Drizzle
3. หน้า home ดึง document list/content แล้ว render ผ่าน `RichTextPreview.svelte`
4. Preview ใช้ Tiptap JSON เป็นหลัก และหลีกเลี่ยงการ render untrusted HTML ตรง ๆ
5. `snapshot.html` ยังมีประโยชน์สำหรับ inspect/cache แต่ไม่ควรใช้เป็นแหล่ง render หลักถ้าข้อมูลมาจาก user

## Image Upload PoC

ปุ่มรูปภาพใน toolbar จะส่งไฟล์ไปที่ `POST /api/uploads` แล้ว insert URL ที่ได้กลับมาเข้า Tiptap document

นโยบายรูป:

- รับเฉพาะ `png`, `jpg`, `webp`, `gif`
- จำกัดไฟล์ละ 5MB
- MIME type ต้องเป็น `image/png`, `image/jpeg`, `image/webp` หรือ `image/gif`
- validation อยู่ที่ `src/lib/server/uploads/validation.ts`

### Local Upload

ถ้าไม่ได้ตั้งค่า R2 endpoint จะใช้ local upload:

- client ส่ง `multipart/form-data` ไปที่ `POST /api/uploads`
- server validate รูป
- server เขียนไฟล์ลง `static/uploads`
- server บันทึก metadata ลง `uploads`
- client เอา URL ที่ได้ไป insert ใน editor

### R2 Presigned Upload

ถ้าตั้งค่า R2 ครบ ระบบจะใช้ presigned upload:

1. client ส่ง metadata รูปไปที่ `POST /api/uploads`
2. server validate type/size แล้วออก presigned `PUT` URL
3. client upload ไฟล์ตรงขึ้น R2 ด้วย presigned URL
4. client เรียก `POST /api/uploads/confirm`
5. confirm endpoint validate `key`, `name`, `type`, `size`
6. server สร้าง trusted public URL จาก config ฝั่ง server เอง
7. server ค่อยบันทึก metadata ลง database
8. client insert URL ที่ confirm แล้วเข้า editor

เหตุผลที่ต้องมี confirm step: presigned URL แค่ให้ browser upload ขึ้น object storage ได้ แต่ไม่ควรบันทึก database ก่อน upload สำเร็จ เพราะจะเกิด row หลอกหรือ URL ที่ชี้ไป object ที่ไม่มีจริงได้ง่าย

## Security

โปรเจกต์นี้ยังเป็น PoC และยังไม่รวม auth/rate limit ตามขอบเขตตอนนี้ แต่มี hardening หลัก ๆ แล้วดังนี้

### 1. Render Rich Text จาก JSON ไม่ inject HTML ตรง ๆ

ไฟล์ `src/lib/tiptap/RichTextPreview.svelte` render จาก Tiptap JSON เป็น Svelte markup เอง แทนการใช้ `{@html snapshot.html}`

ประโยชน์:

- ลด risk XSS จาก HTML ที่ user สร้างหรือแก้เอง
- จำกัด attribute ที่อนุญาตเองได้ เช่น link/image
- ขยาย renderer ตาม Tiptap node/mark ที่รองรับได้แบบควบคุมได้

ข้อควรระวัง:

- ถ้าในอนาคตเพิ่ม node/mark ใหม่ ต้องเพิ่ม renderer พร้อม validation attribute ของ node/mark นั้นด้วย
- อย่าเอา `snapshot.html` จาก user มา render ด้วย `{@html ...}` โดยตรง ถ้ายังไม่ได้ sanitize

### 2. Content Security Policy

ตั้งค่าอยู่ใน `src/hooks.server.ts` ผ่าน header `Content-Security-Policy`

ค่า CSP ฝั่ง app เปิดเป็น default เพื่อให้ local/dev หรือ environment ที่ไม่ได้ผ่าน Cloudflare ยังมี baseline protection อยู่ ถ้า production ใช้ Cloudflare Transform Rule/Response Header เป็น source of truth ให้ตั้ง environment variable ใน kube เป็น:

```sh
ENABLE_APP_CSP=false
```

เหตุผลที่ควรปิด CSP ฝั่ง app เมื่อ Cloudflare เป็นคนตั้ง CSP: browser จะ enforce CSP ทุก header ที่ได้รับพร้อมกัน ถ้า Cloudflare ส่ง CSP ชุดหนึ่งและ app ส่งอีกชุดหนึ่ง policy จะถูกบังคับทั้งสองชุดพร้อมกัน ทำให้ debug ยากและอาจบล็อก resource ที่ Cloudflare policy อนุญาตไว้แล้ว

ค่าปัจจุบัน:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

ความหมายทีละ directive:

- `default-src 'self'`

  ค่า fallback สำหรับ resource หลายประเภท ถ้าไม่ได้ประกาศ directive เฉพาะไว้ หมายถึงโหลดจาก origin เดียวกับเว็บตัวเองเท่านั้น เช่นเว็บอยู่ที่ `https://example.com` ก็อนุญาต `https://example.com/...`

- `script-src 'self'`

  JavaScript โหลดได้จากเว็บตัวเองเท่านั้น ไม่อนุญาต script จาก domain อื่น และไม่ใส่ `'unsafe-inline'` สำหรับ script จึงช่วยลดผลกระทบจาก XSS แบบ inline script เช่น `<script>alert(1)</script>`

- `style-src 'self' 'unsafe-inline'`

  CSS โหลดจากเว็บตัวเองได้ และยังอนุญาต inline style อยู่ เหตุผลคือ Svelte/Tiptap และ style attribute บางส่วนใน rich text/editor อาจต้องพึ่ง inline style ใน PoC นี้

  จุดที่ควรรู้: `'unsafe-inline'` ใน style ไม่อันตรายเท่า script แต่ยังเป็น policy ที่หลวมกว่า ideal production ถ้าจะ tighten ต่อ อาจเปลี่ยนเป็น nonce/hash หรือปรับ renderer ไม่ให้ต้องใช้ inline style

- `img-src 'self' data: https:`

  รูปภาพโหลดได้จากเว็บตัวเอง, `data:` URL และ HTTPS URL ภายนอก ใช้รองรับรูป local, R2 public URL และรูป data URI บางกรณี

  จุดที่ควรรู้: `https:` ค่อนข้างกว้าง เพราะอนุญาตรูปจาก HTTPS domain ใดก็ได้ ถ้ารู้ R2 public domain แน่นอนแล้ว production ควรเปลี่ยนเป็น allowlist เฉพาะ domain นั้น

- `connect-src 'self' https:`

  จำกัดปลายทางของ `fetch`, XHR, EventSource, WebSocket บางแบบ ให้เรียก origin ตัวเองและ HTTPS endpoint ได้ ใช้รองรับ API ตัวเองและ presigned R2 upload

  จุดที่ควรรู้: เหมือน `img-src` คือ `https:` กว้างสำหรับ production ถ้ารู้ R2/API domain แน่นอนแล้วควร allowlist ให้แคบลง

- `font-src 'self' data:`

  font โหลดได้จากเว็บตัวเองและ `data:` URL เท่านั้น ลดโอกาสให้หน้าเว็บไปดึง font จากแหล่งภายนอกโดยไม่ตั้งใจ

- `object-src 'none'`

  ปิดการ embed plugin/object เก่า ๆ เช่น `<object>`, `<embed>`, `<applet>` ซึ่งมักไม่จำเป็นและเป็นพื้นผิวโจมตีเก่า

- `base-uri 'self'`

  จำกัด `<base href="...">` ให้ชี้ origin ตัวเองเท่านั้น ลดการโจมตีที่ inject `<base>` แล้วทำให้ relative URL ในหน้าเว็บ resolve ไป domain อื่น

- `frame-ancestors 'none'`

  ห้ามเว็บนี้ถูกฝังใน iframe จากทุกที่ ช่วยกัน clickjacking ระดับ CSP

### 3. Security Headers อื่น ๆ

ตั้งค่าใน `src/hooks.server.ts` เช่นกัน

headers กลุ่มนี้ยังคงส่งจาก app แม้ตั้ง `ENABLE_APP_CSP=false` เพราะไม่ชนกับ Cloudflare CSP โดยตรง และช่วยคุ้มครองกรณี request วิ่งเข้า kube/ingress โดยไม่ผ่าน Cloudflare

- `X-Content-Type-Options: nosniff`

  บอก browser ว่าอย่าเดา MIME type เอง ให้เชื่อตาม `Content-Type` เท่านั้น ช่วยลดกรณีไฟล์ที่ควรเป็น text/image ถูก browser ตีความเป็น script

- `X-Frame-Options: DENY`

  ห้ามเอาหน้าเว็บไปฝังใน iframe ช่วยกัน clickjacking เป็น header รุ่นเก่าที่ทำงานคู่กับ `frame-ancestors 'none'`

- `Referrer-Policy: strict-origin-when-cross-origin`

  เวลาเปิดลิงก์ข้าม origin จะส่ง referrer แค่ origin เช่น `https://example.com` ไม่ส่ง path/query เต็ม ลดการรั่วของ URL ที่อาจมีข้อมูลสำคัญ

- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

  ปิด browser capabilities ที่ PoC นี้ไม่ได้ใช้ ได้แก่ camera, microphone, geolocation และ payment API ลดพื้นที่ที่หน้าเว็บหรือ iframe ในอนาคตจะขอ permission เหล่านี้ได้

ถ้าต้องการตั้งทั้งหมดที่ Cloudflare ด้วย สามารถเพิ่ม static response headers เหล่านี้ได้:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

โดยรวมคือ Cloudflare ควรเป็น source of truth สำหรับ `Content-Security-Policy` ใน production ส่วน headers อื่นจะตั้งซ้ำทั้ง Cloudflare และ app ก็ได้ แต่ต้องระวังอย่าให้ค่าขัดกันเอง

### 4. Upload Validation

ทั้ง local upload และ R2 presigned upload ใช้ validation กลาง:

- ตรวจ MIME type ว่าเป็น image type ที่อนุญาต
- จำกัดขนาดไม่เกิน 5MB
- R2 confirm ตรวจว่า object key ลงท้ายด้วย extension ที่ match กับ MIME type
- R2 confirm สร้าง public URL จาก config ฝั่ง server ไม่เชื่อ URL ที่ client ส่งมา

สิ่งนี้ช่วยลดปัญหา:

- upload ไฟล์ชนิดที่ไม่ควรรับ
- client ส่ง URL ปลอมเข้ามาให้ server บันทึก
- database มี row ของ presigned upload ที่ยัง upload ไม่สำเร็จ
- object key หลุด prefix ที่กำหนดไว้

### 5. SQL Injection

query ฝั่ง database ใช้ Drizzle query builder เป็นหลัก ไม่ได้ต่อ SQL string จาก input โดยตรง จึงลด risk SQL injection ใน flow ปัจจุบัน

ข้อควรระวัง:

- ถ้าในอนาคตใช้ raw SQL ต้องใช้ parameter binding เสมอ
- อย่าสร้าง `where`, `order by`, หรือ raw fragment จาก string ที่ user ส่งมาตรง ๆ

## Security ที่ยังไม่ได้ทำใน PoC นี้

ตั้งใจยังไม่รวม:

- authentication/authorization
- rate limiting

สิ่งที่ควรเพิ่มถ้าจะขยับไป production:

- จำกัด CSP ให้แคบลงตาม domain จริง เช่น R2 public domain และ R2 upload endpoint
- ตรวจ object existence หลัง presigned upload ด้วย `HeadObject` ก่อน confirm ลง DB
- เพิ่ม antivirus/content scanning ถ้ารับไฟล์จาก user จริง
- เพิ่ม audit log สำหรับ upload/document mutation
- เพิ่ม CSRF strategy ถ้ามี cookie-based auth
- เพิ่ม permission model ว่าใครแก้/ลบ document ได้
- เพิ่ม migration/deployment policy สำหรับ secret rotation

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
