'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RETRY_URL, navigationDecision, isRetryNavigation, sameOrigin, isOpenableExternal } = require('../navigation');

const origin = 'http://127.0.0.1:3080';

test('allows the launch origin and rejects prefix and userinfo lookalikes', () => {
  assert.equal(sameOrigin('http://127.0.0.1:3080/', origin), true);
  assert.equal(sameOrigin('http://127.0.0.1:3080/settings?x=1', origin), true);
  assert.equal(sameOrigin('http://127.0.0.1:30801/', origin), false);
  assert.equal(sameOrigin('http://127.0.0.1:3080@evil.com/', origin), false);
  assert.equal(sameOrigin('http://evil.com/', origin), false);
  assert.equal(sameOrigin('file:///etc/passwd', origin), false);
  assert.equal(sameOrigin('http://[', origin), false);
  assert.equal(sameOrigin('not a url', origin), true);
  assert.equal(navigationDecision('./', origin), 'allow');
  assert.equal(navigationDecision('http://127.0.0.1:30801/', origin), 'external');
  assert.equal(navigationDecision('file:///tmp/x', origin), 'deny');
});

test('external opens are http, https, or mailto', () => {
  assert.equal(isOpenableExternal('https://example.com/docs'), true);
  assert.equal(isOpenableExternal('http://127.0.0.1:3080/'), true);
  assert.equal(isOpenableExternal('mailto:dev@example.com'), true);
  assert.equal(isOpenableExternal('file:///etc/passwd'), false);
  assert.equal(isOpenableExternal('javascript:alert(1)'), false);
  assert.equal(isOpenableExternal('data:text/html,hi'), false);
  assert.equal(isRetryNavigation(RETRY_URL), true);
  assert.equal(isRetryNavigation(`${RETRY_URL}/`), true);
  assert.equal(isRetryNavigation('https://example.com/retry'), false);
});
