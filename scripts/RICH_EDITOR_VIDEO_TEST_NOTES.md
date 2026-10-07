# Rich editor video removal checks

`node scripts/test-rich-editor-video.cjs` mounts the actual RichEditor with JSDOM and verifies repeated embeds, per-video selection/removal, Delete key, post-selection insertion, uploaded sources, mixed wrappers, empty legacy frames, source-mode roundtrips, disabled controls and saved HTML without editor-only state. Media URL query strings and public `videoEmbedHtml` markup remain unchanged. JSDOM insertion uses a minimal Range-based `insertHTML` bridge; live desktop-browser selection/iframe interactions still need an integrated browser check.
