import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(m?js)$/.test(path)) execFileSync(process.execPath, ['--check', path]);
    else if (path.endsWith('.json')) JSON.parse(await readFile(path, 'utf8'));
  }
}
for (const dir of ['extension', 'scripts', 'test']) await check(dir);
console.log('JavaScript syntax and JSON checks passed.');
