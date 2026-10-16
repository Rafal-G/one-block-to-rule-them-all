import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, normalizeSettings, compileRules, classify } from '../extension/core.js';

test('normalizes domains and rejects ambiguous or unsafe entries', () => {
  assert.equal(normalizeDomain(' https://Reddit.com/ '), 'reddit.com');
  assert.equal(normalizeDomain('EXAMPLE.com.'), 'example.com');
  assert.equal(normalizeDomain('bücher.de'), 'xn--bcher-kva.de');
  for (const bad of ['*.reddit.com', 'reddit.com/r/all', 'javascript:alert(1)', 'https://user:pass@example.com', 'example.com?x=1', 'example.com:8080', '-bad.com', 'hello world']) {
    assert.throws(() => normalizeDomain(bad), undefined, bad);
  }
  assert.deepEqual(normalizeSettings({ blocked: ['REDDIT.com', 'reddit.com'], cooldown: [] }).blocked, ['reddit.com']);
});

test('redirect rules match boundaries, subdomains, ports, and URL queries', () => {
  const [rule] = compileRules({ blocked: ['example.com'], cooldown: [] }, 'chrome-extension://test/gate.html');
  const regex = new RegExp(rule.condition.regexFilter);
  for (const url of ['https://example.com', 'https://example.com/?x=1', 'http://a.b.example.com:8080/path', 'https://example.com./a']) assert.ok(regex.test(url), url);
  for (const url of ['https://notexample.com/', 'https://example.com.evil.org/', 'https://evil.org/?example.com', 'ftp://example.com/']) assert.ok(!regex.test(url), url);
  assert.equal(rule.action.redirect.regexSubstitution, 'chrome-extension://test/gate.html#\\0');
});

test('always-blocked wins over overlapping cooldown domains', () => {
  const settings = { blocked: ['video.example.com'], cooldown: ['example.com'] };
  assert.equal(classify('https://video.example.com/watch', settings).mode, 'blocked');
  assert.equal(classify('https://example.com/', settings).mode, 'cooldown');
  assert.equal(classify('https://example.com.evil.org', settings).mode, 'allowed');
  assert.throws(() => classify('javascript:alert(1)', settings));
  const rules = compileRules(settings, 'chrome-extension://test/gate.html');
  assert.ok(rules[0].priority > 20 && rules[1].priority < 20);
});
