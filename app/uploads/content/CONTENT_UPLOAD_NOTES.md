# Uploaded content media

The dynamic route serves generated media files from the persistent `uploads/content` directory. Filenames are UUID-based and extension-allowlisted; path traversal and unknown extensions return `404`.

Verify with a generated upload URL and `curl -I` after an authenticated upload.
