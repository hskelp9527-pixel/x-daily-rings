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

  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', e => errors.push(e.message));
  await tab.goto('https://x.com/me/following');
  const panel = tab.locator('#x-daily-rings');
  await panel.locator('.card').waitFor();
  const lab = i => panel.locator('.ring .lab').nth(i).textContent();
  const footer = () => panel.locator('.follow').textContent();

  // follow-back highlighter
  await tab.waitForFunction(() => document.querySelectorAll('[data-xdr-no="1"]').length === 2);
  assert.equal(await tab.locator('[data-testid="UserCell"]').nth(0).getAttribute('data-xdr-no'), '0');
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.follow').textContent.startsWith('没回关 2 / 已扫 3'));

  // goals
  await panel.locator('.gear').click();
  await panel.locator('input[name=post]').fill('1');
  await panel.locator('input[name=reply]').fill('2');
  await panel.locator('input[name=quote]').fill('4');
  await panel.locator('form button').click();
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.lab').textContent === '发帖 0/1');
  assert.equal(await panel.locator('form').isVisible(), false, 'settings close after saving');

  // publish via X's own requests: fetch post, XHR reply, fetch quote, thread continuation, failed post
  const createFetch = variables => tab.evaluate(async v => {
    const r = await fetch('/i/api/graphql/abc/CreateTweet', { method: 'POST', body: JSON.stringify({ variables: v }) });
    return (await r.json()).data?.create_tweet.tweet_results.result.rest_id ?? null;
  }, variables);
  const firstId = await createFetch({ tweet_text: 'hello' });
  assert.equal(firstId, '100', 'page still receives the original response');
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.lab').textContent === '发帖 1/1');
  await panel.locator('.toast.show').waitFor();
  assert.match(await panel.locator('.toast').textContent(), /发帖 100%/);
  assert.ok(await panel.locator('.confetti').count() > 0, 'confetti on full ring');

  await tab.evaluate(() => new Promise(done => {
    const x = new XMLHttpRequest();
    x.open('POST', '/i/api/graphql/abc/CreateTweet');
    x.onload = done;
    x.send(JSON.stringify({ variables: { reply: { in_reply_to_tweet_id: '999' } } }));
  }));
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.lab')[1].textContent === '回复 1/2');
  assert.match(await panel.locator('.toast').textContent(), /回复 50%/);

  await createFetch({ attachment_url: 'https://x.com/someone/status/42' });
  await createFetch({ reply: { in_reply_to_tweet_id: firstId } });
  await createFetch({ tweet_text: 'FAIL' });
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelectorAll('.lab')[2].textContent === '引用 1/4');
  await tab.waitForTimeout(400);
  assert.equal(await lab(0), '发帖 2/1', 'thread continuation counts as a post; failed post ignored');
  assert.equal(await lab(1), '回复 1/2');

  // unfollow bob through X's own request; X then flips his button to "-follow"
  await tab.evaluate(() => new Promise(done => {
    document.querySelector('[data-testid="222-unfollow"]').dataset.testid = '222-follow';
    const x = new XMLHttpRequest();
    x.open('POST', 'https://x.com/i/api/1.1/friendships/destroy.json');
    x.onload = done;
    x.send('include_profile_interstitial_type=1&user_id=222');
  }));
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.follow').textContent === '没回关 1 / 已扫 2 · 今日取关 1');
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
  await panel.locator('.fold').click();
  await tab.waitForFunction(() => document.querySelector('#x-daily-rings').shadowRoot.querySelector('.card.collapsed'));
  assert.equal(await panel.locator('.mini').textContent(), '📝2  ↩️1  🔁1');
  await tab.reload();
  await panel.locator('.card.collapsed').waitFor();
  assert.equal(await panel.locator('.mini').textContent(), '📝2  ↩️1  🔁1');
  const pos = await panel.evaluate(el => [el.offsetLeft, el.offsetTop]);
  assert.ok(Math.abs(pos[0] - 170) < 15 && Math.abs(pos[1] - 140) < 15, `position kept: ${pos}`);

  assert.deepEqual(errors, []);
  console.log('Browser checks passed; screenshots in artifacts/');
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
