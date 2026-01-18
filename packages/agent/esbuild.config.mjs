import { build } from 'esbuild';
import { readFileSync } from 'fs';

const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

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

  // Inject version from root package.json
  define: {
    'process.env.AGENT_VERSION': JSON.stringify(rootPkg.version),
  },
});

console.log('Bundle complete: dist/agent.cjs');
