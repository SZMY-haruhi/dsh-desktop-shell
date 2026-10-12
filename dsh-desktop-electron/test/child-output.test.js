'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { waitForLaunch } = require('../child-output');

function fakeProc() {
  const proc = new EventEmitter();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.close = () => { proc.stdout.destroy(); proc.stderr.destroy(); };
  return proc;
}

test('reassembles a token URL split across chunks and CRLF', async () => {
  const proc = fakeProc();
  const pending = waitForLaunch(proc, 1000);
  proc.stdout.write('noise\r\n');
  proc.stdout.write('dsh web: http://127.0.0.1:3080/?tok');
  proc.stdout.write('en=abc\r\n');
  const result = await pending;
  proc.close();
  assert.equal(result.reason, 'url');
  assert.equal(result.url, 'http://127.0.0.1:3080/?token=abc');
});

test('reads an ANSI-colored readiness line', async () => {
  const proc = fakeProc();
  const pending = waitForLaunch(proc, 1000);
  proc.stderr.write('dsh web: \u001b[32mhttp://127.0.0.1:3080/?token=abc\u001b[0m\n');
  const result = await pending;
  proc.close();
  assert.equal(result.url, 'http://127.0.0.1:3080/?token=abc');
});

test('times out when no readiness line arrives', async () => {
  const proc = fakeProc();
  const result = await waitForLaunch(proc, 20);
  proc.close();
  assert.deepEqual(result, { url: null, reason: 'timeout' });
});

test('reports exit code and signal', async () => {
  const proc = fakeProc();
  const lines = [];
  const pending = waitForLaunch(proc, 1000, { onLine: line => lines.push(line) });
  proc.emit('exit', 2, 'SIGTERM');
  const result = await pending;
  assert.equal(result.reason, 'exit');
  assert.equal(result.code, 2);
  assert.equal(result.signal, 'SIGTERM');
  assert.match(lines.join('\n'), /code=2/);
  assert.match(lines.join('\n'), /signal=SIGTERM/);
  proc.close();
});

test('reports spawn errors', async () => {
  const proc = fakeProc();
  const lines = [];
  const pending = waitForLaunch(proc, 1000, { onLine: line => lines.push(line) });
  proc.emit('error', new Error('spawn ENOENT'));
  const result = await pending;
  assert.equal(result.reason, 'error');
  assert.match(result.error.message, /ENOENT/);
  assert.match(lines.join('\n'), /spawn ENOENT/);
  proc.close();
});
