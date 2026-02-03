import * as esbuild from 'esbuild';

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

console.log('Extension built successfully');
