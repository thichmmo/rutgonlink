'use strict';

// Phusion Passenger chạy file này; server thật do Next standalone build sinh ra.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path');
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';
// Linux thường đặt sẵn HOSTNAME là tên máy; standalone server phải bind mọi interface.
process.env.HOSTNAME = '0.0.0.0';
// Uploaded media lives beside the release, not inside the atomically swapped bundle.
process.env.CONTENT_UPLOAD_DIR = process.env.CONTENT_UPLOAD_DIR || path.resolve(__dirname, 'uploads/content');

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./.next/standalone/server.js');
