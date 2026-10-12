'use strict';

const RETRY_URL = 'https://dsh-shell.invalid/retry';

function parseNavigationUrl(url, origin) {
  try {
    return new URL(url);
  } catch {
    try {
      return new URL(url, `${origin}/`);
    } catch {
      return null;
    }
  }
}

function navigationDecision(url, origin) {
  const parsed = parseNavigationUrl(url, origin);
  if (!parsed) return 'deny';
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === origin) return 'allow';
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') return 'external';
  return 'deny';
}

function isRetryNavigation(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const expected = new URL(RETRY_URL);
  const path = parsed.pathname.replace(/\/$/, '') || '/';
  const expectedPath = expected.pathname.replace(/\/$/, '') || '/';
  return parsed.origin === expected.origin && path === expectedPath;
}

function sameOrigin(url, origin) {
  return navigationDecision(url, origin) === 'allow';
}

function isOpenableExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

module.exports = { RETRY_URL, navigationDecision, isRetryNavigation, sameOrigin, isOpenableExternal };
