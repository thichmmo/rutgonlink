# Content media upload API

`POST /api/content/upload` accepts an authenticated multipart `file` and stores image/video media under the persistent `uploads/content` directory. It returns a public `/uploads/content/<generated-name>` URL for the post editor. Images are limited to 8 MB and MP4/WebM/OGG videos to 50 MB.

Verify with `pnpm exec eslint app/api/content app/uploads/content lib/content-upload.ts` and an authenticated multipart smoke request. Uploads are served through the read-only route under `app/uploads/content`.
