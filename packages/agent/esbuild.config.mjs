import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/agent.cjs',
  format: 'cjs',
  sourcemap: true,

  // These have native bindings and can't be bundled
  external: [
    'systeminformation',
    'dockerode',
  ],

  // Minify for smaller output
  minify: true,
});

console.log('Bundle complete: dist/agent.cjs');
