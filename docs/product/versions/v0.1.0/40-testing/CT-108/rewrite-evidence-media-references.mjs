import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../../../../..');
const governedRoot = join(repositoryRoot, 'docs/product/versions/v0.1.0');
const manifestPath = join(repositoryRoot, '.control-tower/evidence/CT-108/pre-rename.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const textPattern = /\.(?:json|md|mjs|txt)$/u;

function walk(root) {
  const paths = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) paths.push(...walk(path));
    else paths.push(path);
  }
  return paths;
}

const replacements = manifest.affected.flatMap(({ path }) => {
  const oldName = basename(path);
  return [
    [path, path.replace(/\.png$/u, '.jpg')],
    [oldName, oldName.replace(/\.png$/u, '.jpg')]
  ];
});

const changed = [];
for (const path of walk(governedRoot).filter((candidate) => textPattern.test(candidate))) {
  const before = readFileSync(path, 'utf8');
  let after = before;
  for (const [oldValue, newValue] of replacements) after = after.replaceAll(oldValue, newValue);
  if (after !== before) {
    writeFileSync(path, after);
    changed.push(path.slice(repositoryRoot.length + 1));
  }
}

console.log(JSON.stringify({ changed_count: changed.length, changed }, null, 2));
