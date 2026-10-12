'use strict';

// Readiness line from @deepseek-ai/dsh-web-app (0.2.0-rc.2):
//   dsh web: http://127.0.0.1:3080/?token=<token>
//   dsh web: http://127.0.0.1:3080/?token=<token> (LAN: http://<ip>:<port>)
// The handoff notice ("dsh web: opening the default browser…") is not a URL.
const LAUNCH_URL_RE = /dsh web:\s+(https?:\/\/\S+)/;

function parseLaunchUrl(line) {
  const match = LAUNCH_URL_RE.exec(String(line));
  if (!match) return null;
  let url;
  try {
    url = new URL(match[1]);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.searchParams.get('token')) return null;
  return url.toString();
}

function originOf(launchUrl) {
  const url = new URL(launchUrl);
  return `${url.protocol}//${url.host}`;
}

function redactSecrets(text) {
  return String(text).replace(/([?&]token=)[^&\s]+/g, '$1<redacted>');
}

module.exports = { parseLaunchUrl, originOf, redactSecrets };
