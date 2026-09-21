import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../../../../..');
const governedRoot = join(repositoryRoot, 'docs/product/versions/v0.1.0');
const rawRoot = join(repositoryRoot, '.control-tower/evidence/CT-104');
const privateRoot = join(repositoryRoot, '.control-tower/evidence/CT-108');
const trackedResult = join(scriptDirectory, 'evidence/media-rename-verification.json');
const privatePre = join(privateRoot, 'pre-rename.json');
const privatePost = join(privateRoot, 'post-rename.json');
const phase = process.argv[2];

function walk(root) {
  if (!existsSync(root)) return [];
  const paths = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) paths.push(...walk(path));
    else paths.push(path);
  }
  return paths;
}

function repositoryPath(path) {
  return relative(repositoryRoot, path).replaceAll('\\', '/');
}

function mime(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  return 'application/octet-stream';
}

function dimensions(buffer, mediaType) {
  if (mediaType === 'image/png') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (mediaType !== 'image/jpeg') return { width: null, height: null };
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > buffer.length) break;
    if (
      marker >= 0xc0 && marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length + 2;
  }
  return { width: null, height: null };
}

function inspect(path) {
  const buffer = readFileSync(path);
  const mediaType = mime(buffer);
  return {
    path: repositoryPath(path),
    media_type: mediaType,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    ...dimensions(buffer, mediaType)
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

const candidateFiles = [...walk(governedRoot), ...walk(rawRoot)];

if (phase === '--pre') {
  const pngFiles = candidateFiles.filter((path) => path.endsWith('.png')).map(inspect);
  const affected = pngFiles.filter((item) => item.media_type === 'image/jpeg');
  const genuinePng = pngFiles.filter((item) => item.media_type === 'image/png');
  const result = {
    schema_version: '1.0',
    issue: 'CT-108',
    phase: 'pre_rename',
    governed_roots: [repositoryPath(governedRoot), repositoryPath(rawRoot)],
    affected_count: affected.length,
    genuine_png_count: genuinePng.length,
    affected,
    genuine_png: genuinePng
  };
  writeJson(privatePre, result);
  console.log(JSON.stringify({ path: repositoryPath(privatePre), ...result }, null, 2));
} else if (phase === '--post') {
  if (!existsSync(privatePre)) throw new Error(`Missing pre-rename inventory: ${privatePre}`);
  const pre = JSON.parse(readFileSync(privatePre, 'utf8'));
  const comparisons = pre.affected.map((before) => {
    const newRelativePath = before.path.replace(/\.png$/u, '.jpg');
    const newPath = join(repositoryRoot, newRelativePath);
    if (!existsSync(newPath)) {
      return { before, after: null, byte_identical: false, error: 'renamed file missing' };
    }
    const after = inspect(newPath);
    return {
      before,
      after,
      byte_identical: before.bytes === after.bytes && before.sha256 === after.sha256
    };
  });
  const remainingJpegUnderPng = candidateFiles
    .filter((path) => path.endsWith('.png'))
    .map(inspect)
    .filter((item) => item.media_type === 'image/jpeg');
  const textFiles = walk(governedRoot).filter((path) => (
    path !== trackedResult && /\.(?:json|md|mjs|txt)$/u.test(path)
  ));
  const staleReferences = [];
  for (const path of textFiles) {
    const content = readFileSync(path, 'utf8');
    for (const before of pre.affected) {
      if (content.includes(before.path) || content.includes(before.path.split('/').at(-1))) {
        staleReferences.push({ document: repositoryPath(path), stale_path: before.path });
      }
    }
  }
  const genuinePng = [...walk(governedRoot), ...walk(rawRoot)]
    .filter((path) => path.endsWith('.png'))
    .map(inspect)
    .filter((item) => item.media_type === 'image/png');
  const result = {
    schema_version: '1.0',
    issue: 'CT-108',
    phase: 'post_rename',
    governed_roots: pre.governed_roots,
    acceptance: {
      renamed_count: comparisons.length,
      all_bytes_identical: comparisons.every((item) => item.byte_identical),
      jpeg_under_png_count: remainingJpegUnderPng.length,
      stale_reference_count: staleReferences.length,
      genuine_png_count: genuinePng.length,
      passed:
        comparisons.length === 69 &&
        comparisons.every((item) => item.byte_identical) &&
        remainingJpegUnderPng.length === 0 &&
        staleReferences.length === 0 &&
        genuinePng.length === pre.genuine_png_count
    },
    comparisons,
    remaining_jpeg_under_png: remainingJpegUnderPng,
    stale_references: staleReferences,
    genuine_png: genuinePng
  };
  writeJson(privatePost, result);
  writeJson(trackedResult, result);
  console.log(JSON.stringify({ path: repositoryPath(trackedResult), ...result.acceptance }, null, 2));
} else {
  throw new Error('Usage: node verify-evidence-media.mjs --pre|--post');
}
