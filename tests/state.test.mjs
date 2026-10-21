import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ structuredClone, URLSearchParams });
for (const file of ['model.js', 'state.js']) vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
const { defaults, update, accountKey } = context.XDRState;
const today = '2026-10-21', yesterday = '2026-10-20';
const apply = (s, op, day = today) => update(s, op, day).state;
const row = (handle, uid, f = false) => ({ handle, uid, f, following: true });

test('reset pauses and rejects both already queued and late stale scans; resume keeps unfollow flags', () => {
  let s = apply(defaults(), { type: 'read' });
  const epoch = s.scanEpoch;
  s = apply(s, { type: 'scan', day: today, epoch, rows: [row('alice', '1'), row('bob', '2', true)] });
  s = apply(s, { type: 'record', items: [{ kind: 'post', id: '123' }] });
  s = apply(s, { type: 'unfollow', uid: '1' });
  s.following.history = { d: yesterday, uid: '3', f: true };
  const goals = JSON.stringify(s.goals), days = JSON.stringify(s.days);
  s = apply(s, { type: 'reset' });
  assert.equal(s.scanPaused, true);
  assert.equal(Object.values(s.following).filter(u => u.d === today).length, 0);
  assert.equal(s.following.alice.gone, true);
  assert.equal(s.following.history.d, yesterday);
  assert.equal(JSON.stringify(s.days), days); assert.equal(JSON.stringify(s.goals), goals);
  s = apply(s, { type: 'scan', day: today, epoch, rows: [row('carol', '4')] });
  assert.equal(s.following.carol, undefined);
  s = apply(s, { type: 'resume' });
  s = apply(s, { type: 'scan', day: today, epoch, rows: [row('carol', '4')] });
  assert.equal(s.following.carol, undefined, 'old epoch still rejected after resume');
  s = apply(s, { type: 'scan', day: today, epoch: s.scanEpoch, rows: [row('alice', '1'), row('bob', '2')] });
  assert.equal(s.following.alice.d, null, 'stale following cell cannot erase successful unfollow');
  assert.equal(s.following.bob.d, today);
  s = apply(s, { type: 'unfollow', uid: '1' });
  assert.equal(s.days[today].unfollow, 1, 'replayed success is deduplicated');
});

test('rollover invalidates yesterday callbacks and restarts scanning', () => {
  let s = apply(defaults(), { type: 'read' }, yesterday), epoch = s.scanEpoch;
  s = apply(s, { type: 'reset' }, yesterday);
  s = apply(s, { type: 'scan', day: yesterday, epoch, rows: [row('alice', '1')] });
  assert.equal(s.scanPaused, false); assert.equal(s.following.alice, undefined);
});

test('record de-duplicates against today log even beyond ownIds cap; account validation is strict', () => {
  let s = apply(defaults(), { type: 'record', items: [{ kind: 'reply', id: '10' }, { kind: 'reply', id: '10' }] });
  s.ownIds = [];
  s = apply(s, { type: 'record', items: [{ kind: 'reply', id: '10' }, { kind: 'bad', id: '11' }] });
  assert.equal(s.days[today].reply, 1);
  assert.equal(accountKey('Me_1'), 'me_1'); assert.equal(accountKey('../me'), null);
});

test('valid handles that match Object prototype names stay ordinary data', () => {
  let s = apply(defaults(), { type: 'read' });
  s = apply(s, { type: 'scan', epoch: s.scanEpoch, day: today, rows: [row('__proto__', '1'), row('constructor', '2')] });
  assert.ok(Object.hasOwn(s.following, '__proto__'));
  assert.equal(s.following.__proto__.uid, '1'); assert.equal(s.following.constructor.uid, '2');
  assert.equal(Object.prototype.uid, undefined);
});

test('background serializes parallel origins and binds legacy once with a retained backup', async () => {
  let listener, data = { days: { [today]: { post: 2 } }, following: { old: { uid: '7', d: yesterday } } };
  const api = {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { async get() { await new Promise(resolve => setTimeout(resolve, 1)); return structuredClone(data); },
      async set(value) { data = { ...data, ...structuredClone(value) }; } } }
  };
  const ctx = vm.createContext({ structuredClone, URLSearchParams, chrome: api });
  for (const file of ['model.js', 'state.js', 'background.js']) vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), ctx);
  const send = (account, op, url = 'https://x.com/me') => new Promise(resolve => listener({ channel: 'xdr-state', account, op }, { url }, resolve));
  await send('me', { type: 'read' });
  assert.equal(data.legacyBoundTo, 'me'); assert.equal(data.legacyBackup.days[today].post, 2);
  const results = await Promise.all([
    send('me', { type: 'record', items: [{ kind: 'post', id: '100' }] }),
    send('me', { type: 'record', items: [{ kind: 'reply', id: '101' }] }, 'https://twitter.com/me'),
    send('other', { type: 'record', items: [{ kind: 'quote', id: '200' }] })
  ]);
  const key = context.XDR.dayKey();
  assert.equal(data.accounts.me.days[key].reply, 1);
  assert.equal(data.accounts.me.ownIds.length, 2);
  assert.equal(data.accounts.other.days[key].quote, 1);
  assert.equal(data.accounts.other.following.old, undefined);
  assert.ok(results.every(result => !result.error));
});
