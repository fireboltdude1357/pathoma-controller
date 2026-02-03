import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

// Load .env.local manually (avoid adding dotenv dependency)
function loadEnv() {
  try {
    const envFile = readFileSync('.env.local', 'utf-8');
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    console.warn('Warning: Could not load .env.local');
  }
}

loadEnv();

// Build service worker (background script)
await esbuild.build({
  entryPoints: ['extension/background.ts'],
  bundle: true,
  outfile: 'extension/dist/background.js',
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  // External chrome API (global in extension context)
  external: [],
  define: {
    'process.env.CONVEX_URL': JSON.stringify(process.env.NEXT_PUBLIC_CONVEX_URL || '')
  }
});

// Build content script
await esbuild.build({
  entryPoints: ['extension/content.ts'],
  bundle: true,
  outfile: 'extension/dist/content.js',
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  // Content script doesn't need Convex URL (no Convex client)
  external: []
});

console.log('Extension built successfully');
