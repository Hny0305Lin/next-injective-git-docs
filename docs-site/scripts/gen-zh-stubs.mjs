#!/usr/bin/env node
/**
 * gen-zh-stubs.mjs — generate zh placeholder pages for untranslated docs.
 *
 * For every English doc in ../docs (excluding *-zh.md and AGENTS.md) that has
 * no zh translation file yet, write a stub under
 * i18n/zh/docusaurus-plugin-content-docs/current/<same-relative-path> that
 * explicitly says "Translation in progress" and links to the English page.
 *
 * Rules:
 *   - Existing files are NEVER overwritten (finish a translation by replacing
 *     the stub file; re-running this script then skips it).
 *   - Idempotent: safe to run any time, e.g. after adding a new English page.
 *
 * Usage: npm run gen:zh-stubs   (from docs-site/, PowerShell or bash)
 */

import { readdir, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(here, '../../docs');
const zhDir = path.resolve(
  here,
  '../i18n/zh/docusaurus-plugin-content-docs/current',
);

const EXCLUDE_FILES = new Set(['AGENTS.md']);

async function walk(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      files.push(...(await walk(path.join(dir, e.name), rel)));
    } else if (e.name.endsWith('.md')) {
      if (e.name.endsWith('-zh.md')) continue; // zh long-form served via locale
      if (EXCLUDE_FILES.has(e.name) && base === '') continue;
      files.push(rel);
    }
  }
  return files;
}

// Mirror Docusaurus' default number-prefix parsing for slugs: strip a leading
// `NNNN-` from the file segment only (e.g. adr/0001-x.md -> adr/x).
function docSlug(rel) {
  const parts = rel.replace(/\.md$/, '').split('/');
  const last = parts.length - 1;
  parts[last] = parts[last].replace(/^\d+-/, '');
  return parts.join('/');
}

function firstHeading(text, fallback) {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

async function main() {
  const relFiles = await walk(docsDir);
  let created = 0;
  let skipped = 0;
  for (const rel of relFiles.sort()) {
    const target = path.join(zhDir, rel);
    if (existsSync(target)) {
      skipped += 1;
      continue;
    }
    const source = await readFile(path.join(docsDir, rel), 'utf8');
    const title = firstHeading(source, rel);
    const enPath = `/docs/${docSlug(rel)}`;
    const stub = `# ${title}

> 🚧 **翻译进行中 · Translation in progress**
>
> 本页面尚未翻译为中文。请先阅读英文原版：
> [English version](${enPath})。
>
> 译文完成后将替换本占位页；双语页面必须一一对应，不允许静默缺失
> （流程见仓库根目录 \`AGENTS.md\` 与 \`docs/AGENTS.md\`）。
`;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, stub, 'utf8');
    created += 1;
    console.log(`[gen-zh-stubs] created stub: ${rel}`);
  }
  console.log(
    `[gen-zh-stubs] done — created ${created}, already translated (skipped) ${skipped}`,
  );
}

main();
