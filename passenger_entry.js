'use strict';

// Phusion Passenger chạy file này; server thật do Next standalone build sinh ra.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';
// Linux thường đặt sẵn HOSTNAME là tên máy; standalone server phải bind mọi interface.
process.env.HOSTNAME = '0.0.0.0';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./.next/standalone/server.js');
