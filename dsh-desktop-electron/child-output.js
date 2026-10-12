'use strict';

const { parseLaunchUrl } = require('./launch-url');

function readLines(stream, onLine) {
  if (!stream) return;
  let buf = '';
  const emit = line => onLine(String(line).replace(/\r$/, ''));
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    buf += chunk;
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      emit(buf.slice(0, idx));
      buf = buf.slice(idx + 1);
    }
  });
  stream.on('end', () => { if (buf) emit(buf); });
}

function waitForLaunch(proc, timeoutMs, { onLine } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ url: null, reason: 'timeout' }), timeoutMs);
    const handle = line => {
      if (onLine) onLine(line);
      if (settled) return;
      const url = parseLaunchUrl(line);
      if (url) finish({ url, reason: 'url' });
    };
    readLines(proc.stdout, handle);
    readLines(proc.stderr, handle);
    proc.on('exit', (code, signal) => {
      const exitLine = `dsh exited code=${code ?? ''} signal=${signal ?? ''}`;
      if (onLine) onLine(exitLine);
      finish({ url: null, reason: 'exit', code, signal });
    });
    proc.on('error', error => {
      const message = error && error.message ? error.message : String(error);
      if (onLine) onLine(`dsh error ${message}`);
      finish({ url: null, reason: 'error', error });
    });
  });
}

module.exports = { readLines, waitForLaunch };
