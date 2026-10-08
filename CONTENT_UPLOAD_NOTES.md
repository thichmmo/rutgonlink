# Upload request limit

Next Proxy matches content-upload requests and buffers their bodies before the API
reads multipart data. Its default 10MiB limit truncates otherwise permitted
10–50MiB videos, so `next.config.ts` allows 51MiB for the file plus multipart
headers. The API still limits images to 8MiB and videos to 50MiB; authentication,
host guards and persistent upload paths retain their existing behavior.

Verify with `node scripts/test-content-upload.cjs`: real multipart requests,
temporary filesystem writes and serving, authentication before parsing, exact
image/video size boundaries, and the installed Next body cloner at default and
configured limits. This does not verify hosting ingress limits or media playback.
