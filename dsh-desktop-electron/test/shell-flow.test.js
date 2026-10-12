'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { recoveryAction, shouldHonorRetry, shouldReportUnexpectedExit } = require('../shell-flow');

test('reload before the first launch retries instead of staying on the loading page', () => {
  assert.equal(recoveryAction(false), 'retry-launch');
  assert.equal(recoveryAction(true), 'reload-app');
});

test('retry is honored only from the data error page', () => {
  assert.equal(shouldHonorRetry('error', 'data:text/html;charset=utf-8,hi'), true);
  assert.equal(shouldHonorRetry('loading', 'data:text/html;charset=utf-8,hi'), false);
  assert.equal(shouldHonorRetry('app', 'http://127.0.0.1:3080/'), false);
  assert.equal(shouldHonorRetry('error', 'http://127.0.0.1:3080/'), false);
});

test('an unexpected exit after launch is reported once the child is still current', () => {
  const base = { gen: 2, currentGen: 2, quitting: false, expectingExit: false, acceptedLaunch: true };
  assert.equal(shouldReportUnexpectedExit(base), true);
  assert.equal(shouldReportUnexpectedExit({ ...base, acceptedLaunch: false }), false);
  assert.equal(shouldReportUnexpectedExit({ ...base, expectingExit: true }), false);
  assert.equal(shouldReportUnexpectedExit({ ...base, quitting: true }), false);
  assert.equal(shouldReportUnexpectedExit({ ...base, currentGen: 3 }), false);
});
