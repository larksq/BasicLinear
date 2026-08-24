'use strict';

const childProcess = require('node:child_process');
const dgram = require('node:dgram');
const dns = require('node:dns');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const moduleApi = require('node:module');
const net = require('node:net');
const tls = require('node:tls');

const auditPath = process.env.OPENLINEAR_NETWORK_AUDIT_PATH;
if (!auditPath) {
  throw new Error('OPENLINEAR_NETWORK_AUDIT_PATH is required by the clean-runtime guard.');
}

let attempts = 0;

function writeAudit(event) {
  fs.appendFileSync(auditPath, `${JSON.stringify({
    at: new Date().toISOString(),
    pid: process.pid,
    ...event,
  })}\n`, { encoding: 'utf8', mode: 0o600 });
}

function normalizeHost(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^\[|\]$/gu, '').toLowerCase();
}

function isLoopbackHost(value) {
  const host = normalizeHost(value);
  if (host === '' || host === 'localhost' || host === '::1') return true;
  if (net.isIP(host) === 4) return host.startsWith('127.');
  return false;
}

function denied(operation, target) {
  attempts += 1;
  writeAudit({ event: 'outbound_denied', operation, target: String(target).slice(0, 300) });
  const error = new Error(`Outbound operation denied by the clean-runtime guard: ${operation}.`);
  error.code = 'ERR_OPENLINEAR_OUTBOUND_DENIED';
  throw error;
}

function requestTarget(input, options) {
  if (input instanceof URL) return { host: input.hostname, target: input.origin };
  if (typeof input === 'string') {
    try {
      const url = new URL(input);
      return { host: url.hostname, target: url.origin };
    } catch {
      return { host: input, target: input };
    }
  }
  const value = input && typeof input === 'object' ? input : options;
  if (value?.socketPath) return { host: 'localhost', target: `socket:${value.socketPath}` };
  const host = value?.hostname ?? value?.host ?? 'localhost';
  const port = value?.port === undefined ? '' : `:${value.port}`;
  return { host, target: `${host}${port}` };
}

function connectTarget(args) {
  const first = args[0];
  if (first && typeof first === 'object') return requestTarget(first);
  if (typeof first === 'number') {
    const host = typeof args[1] === 'string' ? args[1] : 'localhost';
    return { host, target: `${host}:${first}` };
  }
  if (typeof first === 'string' && /^\d+$/u.test(first)) {
    const host = typeof args[1] === 'string' ? args[1] : 'localhost';
    return { host, target: `${host}:${first}` };
  }
  return { host: 'localhost', target: String(first ?? 'local') };
}

function guardRequest(api, name, operation) {
  const original = api[name];
  api[name] = function guardedRequest(input, options, ...rest) {
    const target = requestTarget(input, options);
    if (!isLoopbackHost(target.host)) denied(operation, target.target);
    return Reflect.apply(original, this, [input, options, ...rest]);
  };
}

function guardConnect(api, name, operation) {
  const original = api[name];
  api[name] = function guardedConnect(...args) {
    const target = connectTarget(args);
    if (!isLoopbackHost(target.host)) denied(operation, target.target);
    return Reflect.apply(original, this, args);
  };
}

guardRequest(http, 'request', 'http.request');
guardRequest(http, 'get', 'http.get');
guardRequest(https, 'request', 'https.request');
guardRequest(https, 'get', 'https.get');
guardConnect(net, 'connect', 'net.connect');
guardConnect(net, 'createConnection', 'net.createConnection');
guardConnect(tls, 'connect', 'tls.connect');

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = function guardedFetch(input, init) {
    const target = requestTarget(input);
    if (!isLoopbackHost(target.host)) {
      try {
        denied('fetch', target.target);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return Reflect.apply(originalFetch, this, [input, init]);
  };
}

for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCaa',
  'resolveCname', 'resolveMx', 'resolveNaptr', 'resolveNs', 'resolvePtr', 'resolveSoa',
  'resolveSrv', 'resolveTxt', 'reverse']) {
  const original = dns[name];
  if (typeof original !== 'function') continue;
  dns[name] = function guardedDns(hostname, ...args) {
    if (!isLoopbackHost(hostname)) denied(`dns.${name}`, hostname);
    return Reflect.apply(original, this, [hostname, ...args]);
  };
  if (dns.promises && typeof dns.promises[name] === 'function') {
    const promiseOriginal = dns.promises[name];
    dns.promises[name] = function guardedDnsPromise(hostname, ...args) {
      if (!isLoopbackHost(hostname)) {
        try {
          denied(`dns.promises.${name}`, hostname);
        } catch (error) {
          return Promise.reject(error);
        }
      }
      return Reflect.apply(promiseOriginal, this, [hostname, ...args]);
    };
  }
}

const originalCreateSocket = dgram.createSocket;
dgram.createSocket = function guardedCreateSocket(...args) {
  denied('dgram.createSocket', args[0]?.type ?? args[0] ?? 'udp');
  return Reflect.apply(originalCreateSocket, this, args);
};

for (const name of ['exec', 'execFile', 'fork', 'spawn']) {
  const original = childProcess[name];
  childProcess[name] = function guardedChildProcess(command, ...args) {
    denied(`child_process.${name}`, command);
    return Reflect.apply(original, this, [command, ...args]);
  };
}

moduleApi.syncBuiltinESMExports();
writeAudit({ event: 'guard_started', node: process.version });
process.once('exit', (code) => writeAudit({ event: 'guard_summary', attempts, exitCode: code }));
