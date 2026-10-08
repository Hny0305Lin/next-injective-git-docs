/**
 * Local remark plugin: rewrite repo-relative markdown links that the docs
 * site cannot serve, so the published pages keep working links without
 * editing the (evidence-bearing) source files.
 *
 * Rules — applied only to relative links (absolute URLs/anchors untouched):
 *
 * 1. Link inside the mounted docs tree, target included on the site
 *    (e.g. `0002-x.md` from another ADR): untouched, Docusaurus handles it.
 * 2. Link to a Chinese long-form doc `docs/<name>-zh.md`: if the site has a
 *    zh translation for `<name>.md`, point to `/zh/docs/<slug>`; otherwise
 *    fall through to the GitHub rule.
 * 3. Everything else (files outside `docs/`, like `../evidence/...`,
 *    `../contracts/evm-v2/README.md`, `../CLAUDE.md`, hidden `.agents/...`,
 *    or docs files excluded from the site): point to the file/folder on
 *    GitHub (`blob`/`tree` at the `dev` branch, which tracks these paths).
 *
 * Must run in `beforeDefaultRemarkPlugins` so Docusaurus' own link
 * transformer sees only resolvable URLs afterwards.
 */
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/Hny0305Lin/next-injective-git';
const REPO_BRANCH = 'dev'; // branch that tracks evidence/, .agents/, archive/, …

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DOCS_ROOT = path.join(REPO_ROOT, 'docs');
const ZH_CURRENT_ROOT = path.join(
  __dirname,
  '..',
  'i18n',
  'zh',
  'docusaurus-plugin-content-docs',
  'current',
);

// Same convention as Docusaurus' default number-prefix parser: strip a
// leading `NNNN-` from the file segment only.
function docSlug(relPathInDocs) {
  const parts = relPathInDocs.replace(/\.md$/, '').split('/');
  parts[parts.length - 1] = parts[parts.length - 1].replace(/^\d+-/, '');
  return parts.join('/');
}

function isRelativeLink(url) {
  return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('#') && !url.startsWith('/');
}

function rewriteRepoRelativeLinks(options = {}) {
  // Absolute site URL: cross-locale links must be absolute because each
  // locale build only knows its own routes (a `/zh/...` link on an en page
  // would fail the en broken-links check).
  const siteUrl = (options.siteUrl || '').replace(/\/+$/, '');
  function rewrite(rawUrl, sourceDir) {
    const hashIndex = rawUrl.indexOf('#');
    const hash = hashIndex !== -1 ? rawUrl.slice(hashIndex) : '';
    const target = hashIndex !== -1 ? rawUrl.slice(0, hashIndex) : rawUrl;
    const searchIndex = target.indexOf('?');
    const clean = searchIndex !== -1 ? target.slice(0, searchIndex) : target;
    if (clean === '') return rawUrl; // pure "#anchor" link

    const abs = path.resolve(sourceDir, clean);
    const norm = (p) => p.replace(/\\/g, '/');

    // Case: link resolves inside the mounted docs (or its zh mirror).
    const insideDocs = norm(abs).startsWith(`${norm(DOCS_ROOT)}/`);
    const insideZh = norm(abs).startsWith(`${norm(ZH_CURRENT_ROOT)}/`);
    if (insideDocs || insideZh) {
      const baseDir = insideDocs ? DOCS_ROOT : ZH_CURRENT_ROOT;
      const relInDocs = path.relative(baseDir, abs);
      if (relInDocs.endsWith('-zh.md')) {
        // Chinese long-form doc: prefer its zh-locale page when it exists.
        const counterpart = relInDocs.replace(/-zh\.md$/, '.md');
        if (fs.existsSync(path.join(DOCS_ROOT, counterpart))) {
          return `${siteUrl}/zh/docs/${docSlug(counterpart)}${hash}`;
        }
      }
      const excludedFromSite =
        relInDocs === 'AGENTS.md' || relInDocs.endsWith('-zh.md');
      if (!excludedFromSite && fs.existsSync(abs)) {
        return rawUrl; // regular in-docs link: let Docusaurus resolve it
      }
      // else: fall through to the GitHub rule (missing/excluded target)
    }

    // Case: repo path not served by the site → GitHub permalink.
    const repoRel = norm(path.relative(REPO_ROOT, abs));
    if (repoRel.startsWith('..')) return rawUrl; // outside repo: give up
    let kind = 'blob';
    try {
      kind = fs.statSync(abs).isDirectory() ? 'tree' : 'blob';
    } catch {
      kind = path.extname(abs) === '' ? 'tree' : 'blob';
    }
    return `${REPO_URL}/${kind}/${REPO_BRANCH}/${repoRel}${hash}`;
  }

  function walk(node, sourceDir) {
    if (!node.children || !Array.isArray(node.children)) return;
    for (const child of node.children) {
      walk(child, sourceDir);
      if (
        (child.type === 'link' || child.type === 'image') &&
        typeof child.url === 'string' &&
        isRelativeLink(child.url)
      ) {
        child.url = rewrite(child.url, sourceDir);
      }
    }
  }

  return (tree, file) => {
    const sourceDir = file?.path ? path.dirname(file.path) : process.cwd();
    walk(tree, sourceDir);
  };
}

module.exports = rewriteRepoRelativeLinks;
