import { cp, mkdir, rm } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await rm('dist/one-block', { recursive: true, force: true });
await cp('extension', 'dist/one-block', { recursive: true });
console.log('Load dist/one-block as an unpacked extension in Brave.');
