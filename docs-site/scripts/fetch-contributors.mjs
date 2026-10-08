#!/usr/bin/env node
/**
 * fetch-contributors.mjs — build-time GitHub contributors cache.
 *
 * Pulls https://api.github.com/repos/{owner}/{repo}/contributors and writes
 * src/generated/contributors.json. This file is generated output:
 *   - NEVER edit src/generated/contributors.json by hand.
 *   - The browser never calls the GitHub API; it only reads this cache.
 *
 * Rate limits: unauthenticated requests are limited per IP. Optionally set
 * GITHUB_TOKEN (CI secret or local env var) to raise the limit. The token is
 * read from the environment only and is never written anywhere.
 *
 * Failure policy (per project rules): a failed fetch falls back to the last
 * committed cache; if no cache exists, an empty manifest is written so the
 * site builds and the homepage section hides itself. This script exits 0 in
 * both fallback cases so CI can never go red over a missing secret.
 *
 * Usage (Windows PowerShell and bash compatible):
 *   npm run fetch:contributors
 *   GITHUB_TOKEN=ghp_xxx npm run fetch:contributors   (bash)
 *   $env:GITHUB_TOKEN='ghp_xxx'; npm run fetch:contributors  (PowerShell)
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_OWNER = 'Hny0305Lin';
const DEFAULT_REPO = 'next-injective-git';
// Allow overrides for forks/tests: --repo owner/name, or IGIT_CONTRIBUTORS_REPO.
const argRepo = process.argv.find((a) => a.startsWith('--repo='));
const envRepo = process.env.IGIT_CONTRIBUTORS_REPO;
const repoArg = argRepo ? argRepo.slice('--repo='.length) : envRepo;
const [owner, repo] = (repoArg && repoArg.includes('/')
  ? repoArg
  : `${DEFAULT_OWNER}/${DEFAULT_REPO}`
).split('/');

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '../src/generated/contributors.json');

const nowIso = () => new Date().toISOString();

async function writeManifest(manifest) {
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function readCache() {
  try {
    const raw = await readFile(outFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.contributors)) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function fetchAllContributors() {
  const perPage = 100;
  const maxPages = 10; // safety bound (1000 contributors)
  const all = [];
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'next-injective-git-docs-site',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 204) break; // empty page: done
      const rateLimited = res.status === 403 || res.status === 429;
      throw new Error(
        `GitHub API ${res.status} ${res.statusText}${rateLimited ? ' (rate limited — set GITHUB_TOKEN)' : ''}`,
      );
    }
    const body = await res.json();
    if (!Array.isArray(body) || body.length === 0) break;
    all.push(...body);
    if (body.length < perPage) break;
  }
  return all;
}

function toContributor(entry) {
  return {
    login: entry.login,
    htmlUrl: entry.html_url,
    // Only avatars.githubusercontent.com is allowed as a remote image source.
    avatarUrl: entry.avatar_url,
    contributions: entry.contributions,
  };
}

async function main() {
  console.log(`[fetch-contributors] repo: ${owner}/${repo}`);
  try {
    const raw = await fetchAllContributors();
    const contributors = raw
      .filter((c) => c && typeof c.login === 'string' && c.type === 'User')
      .map(toContributor);
    await writeManifest({
      version: 1,
      repo: { owner, name: repo },
      fetchedAt: nowIso(),
      source: 'github-api',
      contributors,
    });
    console.log(
      `[fetch-contributors] OK — ${contributors.length} contributors written to ${path.relative(process.cwd(), outFile)}`,
    );
  } catch (err) {
    console.error(`[fetch-contributors] fetch failed: ${err.message}`);
    const cache = await readCache();
    if (cache && cache.source === 'github-api') {
      console.warn(
        `[fetch-contributors] keeping committed cache from ${cache.fetchedAt} (${cache.contributors.length} contributors).`,
      );
      return; // exit 0: build must pass on the cache
    }
    try {
      await writeManifest({
        version: 1,
        repo: { owner, name: repo },
        fetchedAt: nowIso(),
        source: 'unavailable-fallback',
        note: 'Fetch failed and no usable cache existed; contributors section will be hidden. Re-run npm run fetch:contributors when the API is reachable.',
        contributors: [],
      });
      console.warn(
        '[fetch-contributors] no usable cache — wrote empty manifest; the homepage section will be hidden.',
      );
    } catch (writeErr) {
      // Even the fallback write failed (e.g. read-only FS): report loudly but
      // never fail the build pipeline over contributor metadata.
      console.error(
        `[fetch-contributors] could not write fallback manifest: ${writeErr.message}`,
      );
    }
  }
}

main();
