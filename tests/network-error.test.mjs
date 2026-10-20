import test from 'node:test';
import assert from 'node:assert/strict';
import { explainNetworkError } from '../server/network-error.mjs';

test('restricted outbound requests explain permissions without exposing request credentials', () => {
  const error = explainNetworkError({ message: 'fetch failed', cause: { code: 'EACCES', message: 'private transport details' } });
  assert.equal(error.status, 503); assert.equal(error.code, 'EACCES');
  assert.match(error.message, /联网权限/); assert.ok(!error.message.includes('private transport details'));
});
test('network errors distinguish DNS, timeout, and refused connections', () => {
  assert.match(explainNetworkError({ cause: { code: 'ENOTFOUND' } }).message, /域名/);
  assert.match(explainNetworkError({ cause: { code: 'ECONNREFUSED' } }).message, /拒绝连接/);
  assert.match(explainNetworkError({ name: 'TimeoutError' }).message, /超时/);
  assert.match(explainNetworkError({ cause: { code: 'CERT_HAS_EXPIRED' } }).message, /证书/);
});
