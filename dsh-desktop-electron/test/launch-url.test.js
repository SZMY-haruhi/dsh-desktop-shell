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

test('redacts the launch token', () => {
  assert.equal(
    redactSecrets('dsh web: http://127.0.0.1:3080/?token=secret&x=1'),
    'dsh web: http://127.0.0.1:3080/?token=<redacted>&x=1',
  );
});
