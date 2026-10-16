import test from 'node:test';
import assert from 'node:assert/strict';
import { COOLDOWN_MS } from '../extension/core.js';

function event() {
  const listeners = [];
  return { addListener(fn) { listeners.push(fn); }, listeners };
}
function storage() {
  const data = {};
  return { data, async get(key) { return { [key]: data[key] }; }, async set(value) { Object.assign(data, value); }, async remove(key) { delete data[key]; }, async clear() { for (const key of Object.keys(data)) delete data[key]; } };
}
const local = storage(), session = storage();
let dynamicRules = [], sessionRules = [];
const navigations = [];
const gate = 'chrome-extension://test/gate.html';
let currentUrl = `${gate}#https://reddit.com/r/books?sort=new`;
const onMessage = event(), committed = event(), removed = event();
let contextFrameId = 0;
const documentId = 'gate-document';
globalThis.chrome = {
  runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`, onMessage, onInstalled: event(), onStartup: event(),
    async getContexts(filter) {
      assert.deepEqual(filter, { contextTypes: ['TAB'], documentIds: [documentId] });
      return [{ tabId: 7, frameId: contextFrameId, documentUrl: currentUrl }];
    } },
  storage: { local, session },
  // Own extension URLs are not covered by the manifest's HTTP/HTTPS host grants.
  tabs: { async get() { return {}; }, async update(id, value) { navigations.push({ id, ...value }); }, onRemoved: removed },
  webNavigation: { onCommitted: committed },
  declarativeNetRequest: {
    async getDynamicRules() { return dynamicRules; },
    async updateDynamicRules({ removeRuleIds = [], addRules = [] }) { dynamicRules = [...dynamicRules.filter(rule => !removeRuleIds.includes(rule.id)), ...addRules]; },
    async getSessionRules() { return sessionRules; },
    async updateSessionRules({ removeRuleIds = [], addRules = [] }) { sessionRules = [...sessionRules.filter(rule => !removeRuleIds.includes(rule.id)), ...addRules]; },
  },
};
await import('../extension/background.js');
// Extension-page messages can omit tab and frameId entirely.
const sender = () => ({ id: 'test', url: currentUrl, documentId });
function message(value, from = sender()) { return new Promise(resolve => onMessage.listeners[0](value, from, resolve)); }
async function save(settings) { return message({ type: 'save', settings }, { id: 'test', url: 'chrome-extension://test/options.html' }); }

test('cooldown works without sender tab metadata or tabs.get URL, preserves deadline, and scopes approval', async () => {
  await save({ blocked: [], cooldown: ['reddit.com'] });
  const now = Date.now;
  let clock = 100_000;
  Date.now = () => clock;
  try {
    const start = await message({ type: 'start' });
    assert.equal(start.readyAt, clock + COOLDOWN_MS);
    assert.match((await message({ type: 'continue' })).error, /30 seconds/);
    clock += 10_000;
    assert.equal((await message({ type: 'start' })).readyAt, start.readyAt);
    clock = start.readyAt;
    assert.equal((await message({ type: 'continue' })).ok, true);
    assert.deepEqual(sessionRules[0].condition.tabIds, [7]);
    assert.equal(navigations.at(-1).url, 'https://reddit.com/r/books?sort=new');
    committed.listeners[0]({ tabId: 7, frameId: 0, url: 'https://elsewhere.com' });
    // A message waits behind navigation cleanup in the worker's queue.
    await message({ type: 'unknown' });
    assert.equal(sessionRules.length, 0);
    assert.equal(session.data['wait:7'], undefined);
  } finally { Date.now = now; }
});

test('settings changes revoke passes; blocked pages cannot continue', async () => {
  await save({ blocked: ['reddit.com'], cooldown: ['reddit.com'] });
  assert.equal((await message({ type: 'start' })).mode, 'blocked');
  assert.match((await message({ type: 'continue' })).error, /always blocked/);
  assert.equal(sessionRules.length, 0);
  const previous = structuredClone(dynamicRules);
  assert.ok((await save({ blocked: ['bad.com/path'], cooldown: [] })).error);
  assert.deepEqual(dynamicRules, previous);
});

test('rejects messages from websites, subframes, and stale pause pages', async () => {
  assert.ok((await message({ type: 'save', settings: { blocked: [], cooldown: [] } })).error);
  contextFrameId = 1;
  assert.ok((await message({ type: 'start' })).error);
  contextFrameId = 0;
  assert.ok((await message({ type: 'start' }, { ...sender(), documentId: undefined })).error);
  assert.ok((await message({ type: 'start' }, { ...sender(), id: 'other' })).error);
  assert.ok((await message({ type: 'start' }, { ...sender(), url: `${gate}#https://other.com` })).error);
});
