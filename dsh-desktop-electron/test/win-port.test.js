'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ownedListeningPid, endpointSet } = require('../win-port');

const sample = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    127.0.0.1:3080         0.0.0.0:0              LISTENING       50
  TCP    127.0.0.1:30801        0.0.0.0:0              LISTENING       50
  TCP    10.0.0.8:3080          0.0.0.0:0              LISTENING       50
  TCP    [::1]:3080             [::]:0                 LISTENING       77
`;

test('endpoint set is exact and does not include a longer port', () => {
  const set = endpointSet('127.0.0.1', 3080);
  assert.equal(set.has('127.0.0.1:3080'), true);
  assert.equal(set.has('127.0.0.1:30801'), false);
  assert.equal(set.has(':3080'), false);
});

test('fallback pid must be our process and the local address must match exactly', () => {
  const ours = ownedListeningPid(sample, {
    host: '127.0.0.1',
    port: 3080,
    rootPid: 10,
    parentOf: pid => (pid === '50' ? '10' : null),
  });
  assert.equal(ours, '50');

  const stranger = ownedListeningPid(sample, {
    host: '127.0.0.1',
    port: 3080,
    rootPid: 10,
    parentOf: () => null,
  });
  assert.equal(stranger, null);
});

test('can match an owned IPv6 loopback listener', () => {
  const pid = ownedListeningPid(sample, {
    host: '127.0.0.1',
    port: 3080,
    rootPid: 77,
    parentOf: () => null,
  });
  assert.equal(pid, '77');
});
