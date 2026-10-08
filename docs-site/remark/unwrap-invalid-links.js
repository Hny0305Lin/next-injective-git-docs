/**
 * Local remark plugin: unwrap markdown/autolink nodes whose URL cannot be
 * parsed at all (e.g. GFM autolinks that swallow trailing CJK text:
 * `http://localhost:5173。不要…`). Such nodes make Docusaurus' link
 * transformer throw during build. We cannot edit the source files (they are
 * evidence-bearing records), so we degrade the link to plain text instead.
 *
 * Valid URLs (absolute or relative) are left untouched — unresolved relative
 * links keep their existing warn-level handling.
 */
const { IS_VALID_URL } = require('./is-valid-url');

function unwrapInvalidLinks() {
  function walk(node) {
    if (!node.children || !Array.isArray(node.children)) return;
    node.children = node.children.flatMap((child) => {
      walk(child);
      if (child.type === 'link' && !IS_VALID_URL(child.url)) {
        // Keep the inner text, drop the anchor.
        return child.children;
      }
      return [child];
    });
  }
  return (root) => walk(root);
}

module.exports = unwrapInvalidLinks;
