'use strict';

// Readiness line from @deepseek-ai/dsh-web-app (0.2.0-rc.2):
//   dsh web: http://127.0.0.1:3080/?token=<token>
//   dsh web: http://127.0.0.1:3080/?token=<token> (LAN: http://<ip>:<port>)
// The handoff notice ("dsh web: opening the default browser…") is not a URL.
const LAUNCH_URL_RE = /dsh web:\s+(https?:\/\/\S+)/;
const ANSI_RE = /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;

function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '');
}

function parseLaunchUrl(line) {
  const match = LAUNCH_URL_RE.exec(stripAnsi(line));
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
  return new URL(launchUrl).origin;
}

function redactSecrets(text) {
  return stripAnsi(String(text))
    .replace(/([?#&]token=)[^&#\s]+/gi, '$1<redacted>')
    .replace(/\b(Bearer\s+)\S+/gi, '$1<redacted>');
}

module.exports = { stripAnsi, parseLaunchUrl, originOf, redactSecrets };
