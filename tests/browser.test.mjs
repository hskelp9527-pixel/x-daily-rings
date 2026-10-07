// Loads the real extension into a throwaway Edge/Chromium profile against a mock X page.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const extension = fileURLToPath(new URL('..', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'x-daily-rings-test-'));
const output = resolve(extension, 'artifacts');
await mkdir(output, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const cell = (handle, uid, followsYou) => `<div data-testid="UserCell" style="padding:12px;border-bottom:1px solid #eee">
  <a href="/${handle}">${handle}</a> <span>@${handle}</span>${followsYou ? ' <span data-testid="userFollowIndicator">关注了你</span>' : ''}
  <button data-testid="${uid}-unfollow">正在关注</button></div>`;
const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>mock X</title></head>
<body style="background-color:rgb(255,255,255);font:15px system-ui;margin:0;padding:20px 40px">
<a data-testid="AppTabBar_Profile_Link" href="/me">个人资料</a><h2>正在关注</h2>
${cell('alice', '111', true)}${cell('bob', '222', false)}${cell('carol', '333', false)}</body></html>`;

let nextId = 100;
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.BROWSER_PATH || (existsSync(edge) ? edge : chromium.executablePath()),
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1100, height: 760 }
  });
  await context.route('https://x.com/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: page }));
  await context.route('https://x.com/i/api/**', route => {
    const body = route.request().postData() ?? '';
    const json = body.includes('FAIL') ? { errors: [{ message: 'duplicate' }] } : { data: { create_tweet: { tweet_results: { result: { rest_id: String(nextId++) } } } } };
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(json) });
  });
  await context.route('https://x.com/i/api/1.1/friendships/create.json', route =>
    route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ errors: [{ code: 161, message: 'You are unable to follow more people at this time.' }] }) }));
  const now = new Date().toUTCString();
  const tw = (id, legacy) => ({ tweet_results: { result: { __typename: 'Tweet', rest_id: id, core: { user_results: { result: { core: { screen_name: 'me' } } } },
    legacy: { full_text: 't', created_at: now, user_id_str: '5', ...legacy } } } });
  await context.route('https://x.com/i/api/graphql/abc/UserTweetsAndReplies?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { entries: [
    tw('100', {}), tw('500', { in_reply_to_status_id_str: '9', in_reply_to_user_id_str: '6' }), tw('501', { is_quote_status: true })
  ] } }) }));

  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', e => errors.push(e.message));
  await tab.goto('https://x.com/me/following');
  const panel = tab.locator('#x-daily-rings');
  await panel.locator('.card').waitFor();
  const goal = i => panel.locator('.ring .goal').nth(i).textContent();
  const stats = () => tab.evaluate(() => [...document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.stats b')].map(b => b.textContent).join(','));

  // follow-back highlighter
  await tab.waitForFunction(() => document.querySelectorAll('[data-xdr-no="1"]').length === 2);
  assert.equal(await tab.locator('[data-testid="UserCell"]').nth(0).getAttribute('data-xdr-no'), '0');
  await tab.waitForFunction(() => [...document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.stats b')].map(b => b.textContent).join(',') === '3,2,0');

  // goals
  await panel.locator('.gear').click();
  await panel.locator('input[name=post]').fill('1');
  await panel.locator('input[name=reply]').fill('2');
  await panel.locator('input[name=quote]').fill('4');
  await panel.locator('form button').click();
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.goal').textContent === '0 / 1');
  assert.equal(await panel.locator('form').isVisible(), false, 'settings close after saving');

  // publish via X's own requests: fetch post, XHR reply, fetch quote, thread continuation, failed post
  const createFetch = variables => tab.evaluate(async v => {
    const r = await fetch('/i/api/graphql/abc/CreateTweet', { method: 'POST', body: JSON.stringify({ variables: v }) });
    return (await r.json()).data?.create_tweet.tweet_results.result.rest_id ?? null;
  }, variables);
  const firstId = await createFetch({ tweet_text: 'hello' });
  assert.equal(firstId, '100', 'page still receives the original response');
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.goal').textContent === '1 / 1');
  await panel.locator('.toast.show').waitFor();
  assert.match(await panel.locator('.toast').textContent(), /发帖 100%：今天的任务已达标/);
  assert.ok(await panel.locator('.confetti').count() > 0, 'confetti on full ring');

  await tab.evaluate(() => new Promise(done => {
    const x = new XMLHttpRequest();
    x.open('POST', '/i/api/graphql/abc/CreateTweet');
    x.onload = done;
    x.send(JSON.stringify({ variables: { reply: { in_reply_to_tweet_id: '999' } } }));
  }));
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.goal')[1].textContent === '1 / 2');
  assert.match(await panel.locator('.toast').textContent(), /回复 50%/);

  await createFetch({ attachment_url: 'https://x.com/someone/status/42' });
  await createFetch({ reply: { in_reply_to_tweet_id: firstId } });
  await createFetch({ tweet_text: 'FAIL' });
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.goal')[2].textContent === '1 / 4');
  await tab.waitForTimeout(400);
  assert.equal(await goal(0), '2 / 1', 'thread continuation counts as a post; failed post ignored');
  assert.equal(await goal(1), '1 / 2');

  // profile Replies tab: tweets from the phone get added, the one already counted (100) does not
  await tab.evaluate(() => fetch('/i/api/graphql/abc/UserTweetsAndReplies?variables=%7B%7D'));
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.goal')[2].textContent === '2 / 4');
  assert.equal(await goal(0), '2 / 1', 'already-counted tweet is not double counted');
  assert.equal(await goal(1), '2 / 2');
  await panel.locator('.plus').first().waitFor();
  // visiting again finds nothing new and says so
  await tab.evaluate(() => fetch('/i/api/graphql/abc/UserTweetsAndReplies?variables=%7B%7D'));
  await tab.waitForFunction(() => /主页核对完：今天 3 条都已记录/.test(document.querySelector('#x-daily-rings').shadowRoot.querySelector('.toast').textContent));
  assert.equal(await goal(2), '2 / 4');

  // a follow refused by X's rate limit shows the cooldown banner
  await tab.evaluate(() => fetch('/i/api/1.1/friendships/create.json', { method: 'POST', body: 'user_id=9' }));
  await panel.locator('.limit:not([hidden])').waitFor();
  assert.match(await panel.locator('.limit').textContent(), /关注被限速，约 \d\d:\d\d 解除/);

  // unfollow bob through X's own request; X then flips his button to "-follow"
  await tab.evaluate(() => new Promise(done => {
    document.querySelector('[data-testid="222-unfollow"]').dataset.testid = '222-follow';
    const x = new XMLHttpRequest();
    x.open('POST', 'https://x.com/i/api/1.1/friendships/destroy.json');
    x.onload = done;
    x.send('include_profile_interstitial_type=1&user_id=222');
  }));
  // unfollowed people stay counted: scanned 3, not-following-back 2, unfollowed today 1
  await tab.waitForFunction(() => [...document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.stats b')].map(b => b.textContent).join(',') === '3,2,1');
  await tab.waitForFunction(() => document.querySelectorAll('[data-testid="UserCell"]')[1].dataset.xdrNo === '0');
  await tab.screenshot({ path: join(output, 'following.png') });

  // drag, collapse, persistence across reload
  const box = await panel.locator('header').boundingBox();
  await tab.mouse.move(box.x + 30, box.y + 10);
  await tab.mouse.down();
  await tab.mouse.move(200, 150, { steps: 5 });
  await tab.mouse.up();
  await tab.waitForTimeout(3500);
  await panel.locator('.card').screenshot({ path: join(output, 'panel.png') });
  await tab.evaluate(() => { document.body.style.backgroundColor = 'rgb(0,0,0)'; });
  await panel.locator('.fold').click(); await panel.locator('.card.collapsed').waitFor();
  await panel.locator('.fold').click(); await tab.waitForTimeout(400);
  await panel.locator('.card').screenshot({ path: join(output, 'panel-dark.png') });
  await tab.evaluate(() => { document.body.style.backgroundColor = 'rgb(255,255,255)'; });
  await panel.locator('.fold').click();
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.card.collapsed'));
  assert.equal(await panel.locator('.mini').textContent(), '📝 2   ↩️ 2   🔁 2');
  await tab.reload();
  await panel.locator('.card.collapsed').waitFor();
  assert.equal(await panel.locator('.mini').textContent(), '📝 2   ↩️ 2   🔁 2');
  const pos = await panel.evaluate(el => [el.offsetLeft, el.offsetTop]);
  assert.ok(Math.abs(pos[0] - 170) < 15 && Math.abs(pos[1] - 140) < 15, `position kept: ${pos}`);

  assert.deepEqual(errors, []);
  console.log('Browser checks passed; screenshots in artifacts/');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
