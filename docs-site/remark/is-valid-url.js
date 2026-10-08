/**
 * Shared URL validity check used by remark/rehype helpers.
 * A URL is "valid" if it parses as an absolute URL or as a relative reference
 * against a dummy base (protocol-relative, anchor, mailto, etc. all pass).
 */
function isValidUrl(raw) {
  const url = typeof raw === 'string' ? raw : '';
  if (url === '') return true; // empty hrefs are handled elsewhere
  try {
    // Absolute URLs (http, https, mailto, ipfs, …)
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch {
    // Try as a relative reference.
    try {
      // eslint-disable-next-line no-new
      new URL(url, 'http://docs-local.invalid/');
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { IS_VALID_URL: isValidUrl, isValidUrl };
