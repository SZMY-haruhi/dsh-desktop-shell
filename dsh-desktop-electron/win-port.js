'use strict';

function endpointSet(host, port) {
  const portText = String(port);
  const set = new Set();
  if (host.includes(':')) set.add(`[${host}]:${portText}`);
  else set.add(`${host}:${portText}`);
  if (host === '127.0.0.1' || host === 'localhost') {
    set.add(`127.0.0.1:${portText}`);
    set.add(`[::1]:${portText}`);
    set.add(`localhost:${portText}`);
  }
  return set;
}

function listeningPids(netstatOutput, endpoints) {
  const pids = [];
  for (const raw of String(netstatOutput).split(/\r?\n/)) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [proto, local, , state, pid] = parts;
    if (proto.toUpperCase() !== 'TCP') continue;
    if (state.toUpperCase() !== 'LISTENING') continue;
    if (!endpoints.has(local)) continue;
    if (!/^\d+$/.test(pid)) continue;
    pids.push(pid);
  }
  return pids;
}

function pidIsInTree(pid, rootPid, parentOf) {
  const root = String(rootPid);
  let current = String(pid);
  const seen = new Set();
  while (current && /^\d+$/.test(current) && !seen.has(current)) {
    if (current === root) return true;
    seen.add(current);
    const parent = parentOf(current);
    if (parent == null) return false;
    const next = String(parent);
    if (!/^\d+$/.test(next) || next === '0' || next === current) return false;
    current = next;
  }
  return false;
}

function parentMapFromLines(text) {
  const map = new Map();
  for (const raw of String(text).split(/\r?\n/)) {
    const match = raw.trim().match(/^(\d+)\s+(\d+)$/);
    if (!match) continue;
    map.set(match[1], match[2]);
  }
  return map;
}

function ownedListeningPid(netstatOutput, { host, port, rootPid, parentOf }) {
  for (const pid of listeningPids(netstatOutput, endpointSet(host, port))) {
    if (pidIsInTree(pid, rootPid, parentOf)) return pid;
  }
  return null;
}

module.exports = { endpointSet, listeningPids, pidIsInTree, ownedListeningPid, parentMapFromLines };
