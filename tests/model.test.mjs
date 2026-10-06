import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = { URLSearchParams };
vm.runInNewContext(readFileSync(new URL('../model.js', import.meta.url), 'utf8'), ctx);
const { classifyCreate, unfollowUid, crossedTier, dayKey, message } = ctx.XDR;

const ok = id => JSON.stringify({ data: { create_tweet: { tweet_results: { result: { rest_id: id } } } } });
const req = variables => JSON.stringify({ variables, queryId: 'x' });

test('classifies post, reply, quote, long post and thread continuation', () => {
  assert.deepEqual({ ...classifyCreate(req({ tweet_text: 'hi' }), ok('1')) }, { kind: 'post', id: '1' });
  assert.equal(classifyCreate(req({ reply: { in_reply_to_tweet_id: '9' } }), ok('2')).kind, 'reply');
  assert.equal(classifyCreate(req({ attachment_url: 'https://x.com/a/status/123' }), ok('3')).kind, 'quote');
  assert.equal(classifyCreate(req({ reply: { in_reply_to_tweet_id: '9' }, attachment_url: 'https://x.com/a/status/1' }), ok('4')).kind, 'reply');
  assert.equal(classifyCreate(req({ reply: { in_reply_to_tweet_id: '1' } }), ok('5'), new Set(['1'])).kind, 'post');
  assert.equal(classifyCreate(req({ attachment_url: 'https://x.com/a/photo' }), ok('6')).kind, 'post');
  const note = JSON.stringify({ data: { notetweet_create: { tweet_results: { result: { rest_id: '7' } } } } });
  assert.equal(classifyCreate(req({}), note).id, '7');
  assert.equal(classifyCreate(JSON.stringify({ variables: JSON.stringify({ reply: { in_reply_to_tweet_id: '9' } }) }), ok('8')).kind, 'reply');
});

test('edits are ignored; replies to yourself (e.g. thread started on phone) count as posts', () => {
  assert.equal(classifyCreate(req({ edit_options: { previous_tweet_id: '1' } }), ok('9')), null);
  const selfReply = JSON.stringify({ data: { create_tweet: { tweet_results: { result: { rest_id: '10', legacy: { user_id_str: '5', in_reply_to_user_id_str: '5' } } } } } });
  const otherReply = JSON.stringify({ data: { create_tweet: { tweet_results: { result: { rest_id: '11', legacy: { user_id_str: '5', in_reply_to_user_id_str: '6' } } } } } });
  assert.equal(classifyCreate(req({ reply: { in_reply_to_tweet_id: '77' } }), selfReply).kind, 'post');
  assert.equal(classifyCreate(req({ reply: { in_reply_to_tweet_id: '77' } }), otherReply).kind, 'reply');
});

test('failed or malformed responses are not counted', () => {
  assert.equal(classifyCreate(req({}), JSON.stringify({ errors: [{ message: 'dup' }] })), null);
  assert.equal(classifyCreate(req({}), 'not json'), null);
  assert.equal(classifyCreate('', ''), null);
});

test('unfollow user id comes from the form body', () => {
  assert.equal(unfollowUid('include_profile_interstitial_type=1&user_id=12345'), '12345');
  assert.equal(unfollowUid(''), null);
});

test('milestones fire once per crossed tier, highest wins', () => {
  assert.equal(crossedTier(0, 1, 4), 25);
  assert.equal(crossedTier(1, 2, 4), 50);
  assert.equal(crossedTier(2, 3, 4), 75);
  assert.equal(crossedTier(3, 4, 4), 100);
  assert.equal(crossedTier(4, 5, 4), 0);
  assert.equal(crossedTier(0, 1, 1), 100);
  assert.equal(crossedTier(0, 1, 500), 0);
  assert.equal(crossedTier(124, 125, 500), 25);
  assert.equal(crossedTier(0, 1, 0), 0);
  for (const t of [25, 50, 75, 100]) assert.ok(ctx.XDR.MESSAGES[t].length >= 8);
  assert.equal(message(100, () => 0), ctx.XDR.FIRST_FULL);
  assert.match(message(25, () => 0.999), /\S/);
});

test('day key uses local calendar date', () => {
  assert.equal(dayKey(new Date(2026, 9, 6, 23, 59)), '2026-10-06');
  assert.equal(dayKey(new Date(2026, 9, 7, 0, 0)), '2026-10-07');
});
