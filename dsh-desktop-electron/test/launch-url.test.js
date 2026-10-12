'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLaunchUrl, originOf, redactSecrets } = require('../launch-url');

test('parses the tokenized dsh web readiness line', () => {
  const line = 'dsh web: http://127.0.0.1:3080/?token=abc_DEF-123';
  assert.equal(parseLaunchUrl(line), 'http://127.0.0.1:3080/?token=abc_DEF-123');
  assert.equal(originOf(parseLaunchUrl(line)), 'http://127.0.0.1:3080');
});

test('keeps the local URL when a LAN suffix follows', () => {
  const line = 'dsh web: http://127.0.0.1:3080/?token=abc (LAN: http://10.0.0.5:3080)';
  assert.equal(parseLaunchUrl(line), 'http://127.0.0.1:3080/?token=abc');
});

test('ignores the browser-handoff notice and bare URLs', () => {
  assert.equal(parseLaunchUrl('dsh web: opening the default browser; pass --no-open to disable'), null);
  assert.equal(parseLaunchUrl('dsh web: http://127.0.0.1:3080/'), null);
  assert.equal(parseLaunchUrl('listening on 3080'), null);
});

test('strips ANSI around the readiness URL before reading the token', () => {
  const line = 'dsh web: \u001b[32mhttp://127.0.0.1:3080/?token=abc\u001b[0m';
  assert.equal(parseLaunchUrl(line), 'http://127.0.0.1:3080/?token=abc');
});

test('redacts query tokens, hash tokens, and bearer credentials', () => {
  assert.equal(
    redactSecrets('dsh web: http://127.0.0.1:3080/?token=secret&x=1'),
    'dsh web: http://127.0.0.1:3080/?token=<redacted>&x=1',
  );
  assert.equal(
    redactSecrets('see http://127.0.0.1:3080/#token=hashsecret'),
    'see http://127.0.0.1:3080/#token=<redacted>',
  );
  assert.equal(redactSecrets('Authorization: Bearer abc.def-ghi'), 'Authorization: Bearer <redacted>');
});
