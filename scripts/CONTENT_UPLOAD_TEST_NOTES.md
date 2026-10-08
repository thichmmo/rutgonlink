# Content-upload verification

`node scripts/test-content-upload.cjs` stubs only the authenticated user lookup;
multipart parsing, Next request/response objects, filesystem writes and media GET
are real. Temporary files are cleaned after the run, without posts or database
writes. Tests cover 8MiB image and 50MiB video boundaries, rejected requests that
must not write files, MIME/byte preservation, path traversal and missing files.

The script imports the actual Next config and exercises the installed Next Proxy
body cloner. It reproduces a truncated 12MiB upload at the default 10MiB limit and
checks complete parsing/saving at the configured limit, including a 50MiB video
with multipart overhead. Generated fixture bytes test transport and persistence;
they do not establish that a codec plays in a browser or that hosting accepts the
same body size.
