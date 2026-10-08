#!/usr/bin/env node
/**
 * mirror-zh-authored.mjs — replace zh stubs whose English-side source file is
 * itself predominantly Chinese-authored with the full source content.
 *
 * Rationale: many docs in the main repo are written in Chinese (e.g. backlog,
 * storage-byos, infrastructure). For those, the faithful zh-locale page is the
 * content itself; showing a "Translation in progress" stub would be worse.
 *
 * Safety rules:
 *   - Only touches files that are CURRENTLY stubs (contain the marker below).
 *     Real translations and future manual edits are never overwritten.
 *   - Mirrors only when the source prose is >= THRESHOLD Chinese.
 *   - Idempotent; prints a report.
 *
 * Usage:  npm run mirror:zh           (from docs-site/)
 *         node scripts/mirror-zh-authored.mjs --dry   (report only)
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY = process.argv.includes('--dry');
const THRESHOLD = Number(process.env.MIRROR_ZH_THRESHOLD || '0.35');

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const docsDir = path.join(repoRoot, 'docs');
const zhDir = path.join(
  here,
  '../i18n/zh/docusaurus-plugin-content-docs/current',
);
const STUB_MARKER = '翻译进行中 · Translation in progress';

async function walk(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) files.push(...(await walk(path.join(dir, e.name), rel)));
    else if (e.name.endsWith('.md')) {
      if (e.name.endsWith('-zh.md')) continue;
      if (base === '' && e.name === 'AGENTS.md') continue;
      files.push(rel);
    }
  }
  return files;
}

// Ratio of CJK characters vs Latin letters in prose (code fences, inline
// code, and URLs excluded).
function cjkRatio(text) {
  const noFences = text.replace(/```[\s\S]*?```/g, ' ');
  const noInline = noFences.replace(/`[^`\n]*`/g, ' ');
  const noUrls = noInline.replace(/https?:\/\/\S+/g, ' ');
  const cjk = (noUrls.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const latin = (noUrls.match(/[A-Za-z]/g) || []).length;
  if (cjk + latin === 0) return 0;
  return cjk / (cjk + latin);
}

async function main() {
  const relFiles = (await walk(docsDir)).sort();
  let mirrored = 0;
  let kept = 0;
  const ratioReport = [];
  for (const rel of relFiles) {
    const zhFile = path.join(zhDir, rel);
    let zhContent;
    try {
      zhContent = await readFile(zhFile, 'utf8');
    } catch {
      continue; // no zh file at all — gen:zh-stubs territory
    }
    if (!zhContent.includes(STUB_MARKER)) {
      continue; // already a real translation (or a mirrored copy)
    }
    const src = await readFile(path.join(docsDir, rel), 'utf8');
    const ratio = cjkRatio(src);
    ratioReport.push(`${ratio.toFixed(2)}  ${rel}`);
    if (ratio >= THRESHOLD) {
      if (!DRY) {
        await writeFile(zhFile, src, 'utf8');
      }
      mirrored += 1;
      console.log(`${DRY ? '[dry] ' : ''}mirrored (ratio ${ratio.toFixed(2)}): ${rel}`);
    } else {
      kept += 1;
    }
  }
  console.log(
    `\n[mirror-zh] done — mirrored ${mirrored}, kept as stub ${kept}, threshold ${THRESHOLD}${DRY ? ' (dry run)' : ''}`,
  );
  console.log('[mirror-zh] ratios of kept-as-stub pages:');
  for (const line of ratioReport) {
    const r = Number(line.split(' ')[0]);
    if (r < THRESHOLD) console.log('  ' + line);
  }
}

main();
