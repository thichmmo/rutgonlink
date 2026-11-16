import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const globalSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const frameProtectedHeader = [{ key: 'X-Frame-Options', value: 'DENY' }]

const nextConfig: NextConfig = {
  // Build local rồi upload .next/standalone lên cPanel, không build trên hosting.
  output: 'standalone',
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    // Proxy clones multipart bodies; keep the 50MiB video limit plus form overhead intact.
    proxyClientMaxBodySize: '51mb',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: globalSecurityHeaders,
      },
      // Keep clickjacking protection on app/auth/API routes without sending X-Frame-Options: DENY on public /p7/* or short links.
      {
        source: '/(dashboard|admin|login|register|checkout|api)(/.*)?',
        headers: frameProtectedHeader,
      },
    ]
  },
};

export default nextConfig;
