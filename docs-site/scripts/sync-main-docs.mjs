#!/usr/bin/env node
/**
 * sync-main-docs.mjs — mirror `docs/` from the MAIN repository into this
 * docs-site repository.
 *
 * This repo (next-injective-git-docs) hosts the Docusaurus site plus a
 * read-only mirror of the main repo's `docs/` folder. The main repository
 * (Hny0305Lin/next-injective-git) stays the single content source of truth:
 * NEVER hand-edit `docs/` here — run this script instead, then commit+push.
 *
 * Default main-repo location: the sibling checkout next to this repo
 * (…/next-injective-git/docs). Override with IGIT_MAIN_REPO (repo root) or
 * IGIT_MAIN_DOCS (docs folder directly). Works on PowerShell and bash.
 *
 * Usage (from docs-site/):  npm run sync:docs
 */

import { cp, readdir, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// here = <docs-repo>/docs-site/scripts → repo root is two levels up.
const docsRepoRoot = path.resolve(here, '..', '..');
const thisDocsDir = path.join(docsRepoRoot, 'docs');

const mainRepo = process.env.IGIT_MAIN_REPO
  ? path.resolve(process.env.IGIT_MAIN_REPO)
  : path.resolve(docsRepoRoot, '..', 'next-injective-git');
const mainDocs = process.env.IGIT_MAIN_DOCS
  ? path.resolve(process.env.IGIT_MAIN_DOCS)
  : path.join(mainRepo, 'docs');

async function countFiles(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += await countFiles(path.join(dir, e.name));
    else n += 1;
  }
  return n;
}

async function main() {
  console.log(`[sync-docs] main repo: ${mainRepo}`);
  if (!existsSync(mainDocs)) {
    console.error(
      `[sync-docs] main repo docs not found at ${mainDocs}. ` +
        'Set IGIT_MAIN_REPO / IGIT_MAIN_DOCS, or clone ' +
        'Hny0305Lin/next-injective-git next to this repo.',
    );
    process.exit(1);
  }
  await mkdir(docsRepoRoot, { recursive: true });
  await rm(thisDocsDir, { recursive: true, force: true });
  await cp(mainDocs, thisDocsDir, { recursive: true });
  const n = await countFiles(thisDocsDir);
  console.log(
    `[sync-docs] OK — mirrored ${n} files into ${path.relative(docsRepoRoot, thisDocsDir)}. ` +
      'Next: npm run build && commit && push (see MAINTENANCE-PROMPT.md).',
  );
}

main();
