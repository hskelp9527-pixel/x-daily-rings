// Floating rings panel + "who doesn't follow back" highlighter. Isolated world, document_idle.
(() => {
  const { KINDS, LABELS, FIRST_FULL, dayKey, classifyCreate, profileTweets, followLimited, unfollowUid, crossedTier, message, emptyDay } = globalThis.XDR;
  // Ring gradients [start, end], Apple activity-ring style.
  const COLORS = { post: ['#64d2ff', '#0a84ff'], reply: ['#a6f4a4', '#30d158'], quote: ['#ff9fb5', '#ff2d55'] };
  const ICONS = { post: '📝', reply: '↩️', quote: '🔁' };
  const DEFAULT_GOALS = { post: 3, reply: 20, quote: 5 };
  const R = 27, C = 2 * Math.PI * R;
  const hhmm = d => d.toTimeString().slice(0, 5);
  // ponytail: X doesn't publish its follow cooldown; 30 min is a rule of thumb, so it's user-set (⏱ in the header).
  const DEFAULT_COOLDOWN_MIN = 30;
  const api = globalThis.browser ?? globalThis.chrome;
  const S = { goals: DEFAULT_GOALS, days: {}, ownIds: [], following: {}, panel: null, followLimitUntil: 0, followCooldownMin: DEFAULT_COOLDOWN_MIN,
    scanEpoch: 0, scanPaused: false, scanDay: '' };
  const myHandle = () => {
    const handle = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href')?.split('/')[1]?.toLowerCase();
    return /^[a-z0-9_]{1,15}$/.test(handle ?? '') ? handle : null;
  };
  let activeAccount = null, generation = 0, legacyBackup = null, legacyBoundTo = null;
  // Capture both account and generation before any async work; delayed responses never affect another account.
  async function mutate(op, owner = activeAccount, gen = generation) {
    if (!owner || owner !== myHandle() || owner !== activeAccount || gen !== generation) return null;
    const result = await api.runtime.sendMessage({ channel: 'xdr-state', account: owner, op });
    if (!result || result.error) throw new Error(result?.error ?? '扩展后台不可用');
    if (owner !== activeAccount || owner !== myHandle() || gen !== generation) return null;
    if ((result.state.revision ?? 0) >= (S.revision ?? 0)) Object.assign(S, result.state);
    legacyBackup = result.legacyBackup; legacyBoundTo = result.legacyBoundTo;
    place(); render();
    return result;
  }
  const cooldownMs = () => S.followCooldownMin * 60 * 1000;
  const today = () => ({ ...emptyDay(), ...S.days[dayKey()] });

  // ---------- page-side styles for the highlighter ----------
  const pageStyle = document.createElement('style');
  pageStyle.textContent = '[data-xdr-no="1"]{background:rgba(255,45,85,.09)!important;box-shadow:inset 4px 0 0 #ff2d55!important}';
  document.head.append(pageStyle);

  // ---------- panel ----------
  const host = document.createElement('div');
  host.id = 'x-daily-rings';
  host.style.cssText = 'position:fixed;z-index:2147483000;left:0;top:0';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial;--ink:#1d1d1f;--sub:rgba(60,60,67,.62);--glass:rgba(255,255,255,.58);--edge:rgba(255,255,255,.75);--well:rgba(118,118,128,.10);--shadow:0 12px 40px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.06)}
    :host(.dark){--ink:#f5f5f7;--sub:rgba(235,235,245,.6);--glass:rgba(40,40,44,.55);--edge:rgba(255,255,255,.14);--well:rgba(118,118,128,.24);--shadow:0 12px 40px rgba(0,0,0,.5)}
    *{box-sizing:border-box}
    .card{width:256px;font:13px/1.35 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Segoe UI","Microsoft YaHei",sans-serif;color:var(--ink);
      background:linear-gradient(160deg,rgba(255,255,255,.22),rgba(255,255,255,0) 45%),var(--glass);
      -webkit-backdrop-filter:blur(28px) saturate(180%);backdrop-filter:blur(28px) saturate(180%);
      border:1px solid var(--edge);border-radius:24px;box-shadow:var(--shadow),inset 0 1px 0 rgba(255,255,255,.55);overflow:hidden}
    .num,.stats b,.mini,form input{font-family:ui-rounded,"SF Pro Rounded",-apple-system,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
    header{display:flex;align-items:center;gap:6px;padding:12px 12px 4px 16px;cursor:grab;user-select:none;touch-action:none}
    header b{font-size:14px;font-weight:600;letter-spacing:.2px}
    header .date{flex:1;color:var(--sub);font-size:12px}
    button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
    .icon{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:var(--sub);font-size:14px;transition:background .15s}
    .icon:hover{background:var(--well);color:var(--ink)}
    .rings{display:flex;justify-content:space-between;padding:8px 14px 12px}
    .ring{width:70px;text-align:center}
    .dial{position:relative;width:70px;height:70px}
    .dial svg{display:block}
    .dial .num{position:absolute;inset:0;display:grid;place-items:center;font-size:20px;font-weight:700;letter-spacing:-.3px}
    .ring .name{margin-top:6px;font-size:12px;font-weight:600;white-space:nowrap}
    .ring .goal{font-size:11px;color:var(--sub);white-space:nowrap}
    .ring.full .dial{animation:pop .6s cubic-bezier(.3,1.6,.5,1)}
    @keyframes pop{50%{transform:scale(1.1)}}
    form{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 14px 12px}
    form[hidden]{display:none}
    form label{display:grid;gap:3px;font-size:11px;color:var(--sub);white-space:nowrap}
    form input{width:100%;font-size:13px;font-weight:600;color:var(--ink);background:var(--well);border:0;border-radius:9px;padding:6px 8px;outline:none}
    form input:focus{box-shadow:0 0 0 2px rgba(10,132,255,.5)}
    form button{grid-column:1/-1;padding:7px;border-radius:12px;background:#0a84ff;color:#fff;font-weight:600}
    form button:hover{background:#0077ed}
    form.cool{grid-template-columns:1fr}
    .limit{margin:0 10px 8px;padding:7px 12px;border-radius:14px;background:rgba(255,159,10,.16);font-size:12px;font-weight:600}
    .limit[hidden]{display:none}
    .stats{display:grid;grid-template-columns:repeat(3,1fr) auto;align-items:center;gap:4px;margin:0 10px 10px;padding:8px 6px 8px 12px;border-radius:16px;background:var(--well)}
    .stats div{display:grid;white-space:nowrap}
    .stats b{font-size:15px;font-weight:700}
    .stats span{font-size:10.5px;color:var(--sub)}
    .stats .no b{color:#ff2d55}
    .export{padding:5px 10px;border-radius:10px;font-size:12px;font-weight:600;color:#0a84ff;white-space:nowrap}
    .export:hover{background:rgba(10,132,255,.12)}
    .reset-scan{color:#0a84ff;flex:none}.reset-scan.paused{background:rgba(10,132,255,.12)}
    @media(max-width:600px){.card{max-width:calc(100vw - 16px);border-radius:18px}.icon{width:26px;height:32px}.toast{max-width:calc(100vw - 16px)}}
    .mini{display:none;padding:2px 16px 12px;font-size:14px;font-weight:600;white-space:nowrap}
    .collapsed .rings,.collapsed form,.collapsed .stats{display:none}.collapsed .mini{display:block}
    .toast{position:absolute;bottom:calc(100% + 10px);left:0;width:256px;padding:10px 14px;border-radius:18px;color:#fff;font:13px/1.45 -apple-system,"PingFang SC","Segoe UI",sans-serif;
      background:rgba(28,28,30,.72);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);
      border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transform:translateY(8px) scale(.98);transition:.3s cubic-bezier(.2,.9,.3,1);pointer-events:none}
    .toast.show{opacity:1;transform:none}
    .toast.below{bottom:auto;top:calc(100% + 10px)}
    .plus{position:absolute;z-index:1;font:700 16px/1 ui-rounded,"SF Pro Rounded",-apple-system,"Segoe UI",sans-serif;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.18);animation:rise 1.5s cubic-bezier(.2,.9,.3,1) forwards}
    @keyframes rise{0%{opacity:0;transform:translate(-50%,8px) scale(.5)}18%{opacity:1;transform:translate(-50%,-6px) scale(1.2)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px) scale(1)}}
    .confetti{position:fixed;top:-12px;width:8px;height:12px;border-radius:2px;animation:fall linear forwards;pointer-events:none}
    @keyframes fall{to{transform:translateY(105vh) rotate(720deg)}}
  </style>
  <div class="toast"></div>
  <div class="card">
    <header><b>今日输出</b><span class="date"></span><button class="icon reset-scan" title="重置今日扫描" aria-label="重置今日扫描">↻</button><button class="icon cool-btn" title="关注限速等待时长">⏱︎</button><button class="icon gear" title="设置目标">⚙︎</button><button class="icon fold" title="收起 / 展开">–</button></header>
    <div class="rings"></div>
    <form hidden>${KINDS.map(k => `<label>${LABELS[k]}目标<input name="${k}" type="number" min="1" step="1"></label>`).join('')}<button>保存目标</button></form>
    <form class="cool" hidden><label>关注限速等待（分钟）<input name="min" type="number" min="1" max="1440" step="1"></label><button>保存</button></form>
    <div class="mini"></div>
    <div class="limit" hidden></div>
    <div class="stats">
      <div class="scan"><b>0</b><span>已扫描</span></div>
      <div class="no"><b>0</b><span>没回关</span></div>
      <div class="unf"><b>0</b><span>今日取关</span></div>
      <button class="export" title="导出全部数据为 JSON">导出</button>
    </div>
  </div>`;
  const $ = s => root.querySelector(s);
  const card = $('.card'), form = $('form'), coolForm = $('form.cool');

  function render() {
    const day = today();
    $('.date').textContent = dayKey().slice(5);
    $('.rings').innerHTML = KINDS.map(k => {
      const goal = S.goals[k], n = day[k], p = Math.min(1, n / goal), [c1, c2] = COLORS[k];
      return `<div class="ring${p >= 1 ? ' full' : ''}"><div class="dial"><svg width="70" height="70" viewBox="0 0 70 70">
        <defs><linearGradient id="g-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
        <circle cx="35" cy="35" r="${R}" fill="none" stroke="${c2}" stroke-opacity=".16" stroke-width="7"/>
        <circle cx="35" cy="35" r="${R}" fill="none" stroke="url(#g-${k})" stroke-width="7" stroke-linecap="round" opacity="${n ? 1 : 0}"
          stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 35 35)"
          style="transition:stroke-dashoffset .6s cubic-bezier(.2,.9,.3,1);filter:drop-shadow(0 0 3px ${c2}88)"/></svg>
        <span class="num">${n}</span></div>
        <div class="name">${LABELS[k]}</div><div class="goal">${n} / ${goal}</div></div>`;
    }).join('');
    $('.mini').textContent = KINDS.map(k => `${ICONS[k]} ${day[k]}`).join('   ');
    // Today's scan only (d = day last seen). Unfollowed people stay in both tallies (marked gone); only their highlight goes away.
    const scanned = Object.values(S.following).filter(u => u.d === dayKey());
    $('.scan b').textContent = scanned.length;
    $('.no b').textContent = scanned.filter(u => !u.f).length;
    $('.unf b').textContent = day.unfollow;
    const scanLabel = S.scanPaused ? '重新扫描' : '重置今日扫描';
    $('.reset-scan').title = scanLabel;
    $('.reset-scan').setAttribute('aria-label', scanLabel);
    $('.reset-scan').classList.toggle('paused', S.scanPaused);
    $('.card').title = activeAccount ? `@${activeAccount}` : '等待识别登录账号';
    card.classList.toggle('collapsed', !!S.panel?.collapsed);
    $('.fold').textContent = S.panel?.collapsed ? '+' : '–';
    // X's real cooldown is often longer than the wait set here, so the banner stays until a follow goes through.
    const until = S.followLimitUntil, now = Date.now();
    if (until && now > until + 4 * cooldownMs()) mutate({ type: 'settings', followLimitUntil: 0 }).catch(() => {});
    if (until && now >= until && notifiedUntil !== until) {
      notifiedUntil = until;
      toast(`✅ 已过 ${S.followCooldownMin} 分钟，可以再试试关注了。`, 15000);
    }
    $('.limit').hidden = !until;
    $('.limit').textContent = now < until ? `⏳ 关注被限速，约 ${hhmm(new Date(until))} 解除` : '⏳ 限速应已解除，关注一下试试；成功后这条会消失';
    theme();
    refreshHighlights();
    place();
  }

  // Body is transparent while X boots; reading that as black made the card flash dark on every reload.
  function theme() {
    const [r, g, b, a = 1] = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
    if (a > 0.5) host.classList.toggle('dark', r + g + b < 384);
  }

  function place() {
    const p = S.panel ?? {};
    const v = visualViewport, width = v?.width ?? innerWidth, height = v?.height ?? innerHeight;
    const ox = v?.offsetLeft ?? 0, oy = v?.offsetTop ?? 0;
    const bottom = width <= 600 ? 76 : 8; // keep X's mobile bottom navigation reachable
    card.style.maxHeight = Math.max(80, height - bottom - 16) + 'px'; card.style.overflowY = 'auto';
    const x = p.x ?? ox + width - host.offsetWidth - 12, y = p.y ?? oy + height - host.offsetHeight - bottom - 12;
    host.style.left = Math.max(ox + 8, Math.min(x, ox + width - host.offsetWidth - 8)) + 'px';
    host.style.top = Math.max(oy + 8, Math.min(y, oy + height - host.offsetHeight - bottom)) + 'px';
  }

  let toastTimer, cheerUntil = 0, notifiedUntil = 0;
  // minor = profile-scan status notes; they never cover a cheer still on screen.
  function toast(text, ms = 3000, minor = false) {
    const t = $('.toast');
    if (minor && Date.now() < cheerUntil) return;
    t.textContent = text;
    t.classList.toggle('below', host.getBoundingClientRect().top < t.offsetHeight + 20); // card dragged to the top
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function confetti() {
    const colors = Object.values(COLORS).flat().concat('#ffd60a', '#bf5af2');
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-duration:${1.6 + Math.random() * 1.2}s;animation-delay:${Math.random() * .4}s`;
      root.append(c);
      setTimeout(() => c.remove(), 3400);
    }
  }

  // "+N" rising out of a ring, like the toast says.
  function plus(kind, n) {
    const dial = root.querySelectorAll('.dial')[KINDS.indexOf(kind)];
    if (!dial || card.classList.contains('collapsed')) return;
    const d = dial.getBoundingClientRect(), h = host.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'plus';
    el.textContent = `+${n}`;
    el.style.cssText = `left:${d.left - h.left + d.width / 2 + 24}px;top:${d.top - h.top + 8}px;color:${COLORS[kind][1]}`;
    root.append(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ---------- events from hook.js ----------
  const record = async (items, fromProfile, owner = activeAccount, gen = generation) => {
    const result = await mutate({ type: 'record', items: items.map(({ id, kind, at = new Date() }) => ({ id, kind, time: hhmm(new Date(at)) })) }, owner, gen);
    if (!result) return;
    const { before, after: day } = result;
    let cheer = null;
    for (const kind of KINDS) {
      const tier = crossedTier(before[kind], day[kind], S.goals[kind]);
      if (tier) cheer = { kind, tier, line: tier === 100 && !before.full ? FIRST_FULL : message(tier) };
    }
    const added = KINDS.filter(k => day[k] > before[k]);
    // Profile visit with nothing new still says so, otherwise it looks like the scan never ran.
    if (!added.length) return fromProfile && items.length && toast(`✅ 主页核对完：今天 ${items.length} 条都已记录`, 3000, true);
    added.forEach((k, i) => setTimeout(() => plus(k, day[k] - before[k]), 120 + i * 150)); // after the re-render
    if (cheer) {
      toast(`${ICONS[cheer.kind]} ${LABELS[cheer.kind]} ${cheer.tier}%：${cheer.line}`, 15000);
      cheerUntil = Date.now() + 15000;
      if (cheer.tier === 100) confetti();
    } else if (fromProfile) {
      toast(`📥 从主页补录：${added.map(k => `${LABELS[k]} +${day[k] - before[k]}`).join('，')}`);
    }
  };

  let profileToastPath = '';
  document.addEventListener('xdr:net', async e => {
    try {
      const { url, body, text, status, account } = JSON.parse(e.detail);
      const owner = activeAccount, gen = generation;
      if (!owner || account?.toLowerCase() !== owner || owner !== myHandle()) return;
      const ok = status >= 200 && status < 300;
      if (url.includes('/friendships/create.json')) {
        if (followLimited(status, text)) {
          await mutate({ type: 'settings', followLimitUntil: Date.now() + cooldownMs() }, owner, gen);
          toast(`⏳ 关注被 X 限速了，${S.followCooldownMin} 分钟后提醒你。`, 6000);
        } else if (ok && !JSON.parse(text)?.errors?.length) await mutate({ type: 'follow', uid: unfollowUid(body) }, owner, gen);
        return;
      }
      if (!ok) return;
      // Profile timelines: UserRepliesTimeline / UserOriginalsTimeline (2026), UserTweets[AndReplies] (older).
      if (/\/(UserTweets\w*|User\w*Timeline)$/.test(url.split('?')[0])) {
        const items = profileTweets(text, myHandle(), dayKey());
        console.info('[X Daily Rings]', url.split('?')[0].split('/').pop(), { me: myHandle(), tweets: (text.match(/"full_text"/g) ?? []).length, today: items.length });
        const own = location.pathname.toLowerCase().startsWith(`/${myHandle()?.toLowerCase()}`);
        if (own && !items.length && profileToastPath !== location.pathname) toast('🔍 主页扫描：收到时间线，但没认出今天的内容', 3000, true); // first page only
        profileToastPath = location.pathname;
        const cached = profileCache?.owner === owner && profileCache.key === dayKey() ? profileCache.items : [];
        profileCache = { owner, key: dayKey(), items: [...new Map([...cached, ...items].map(item => [item.id, item])).values()] };
        return await record(items, true, owner, gen);
      }
      if (url.includes('/friendships/destroy.json')) {
        let response; try { response = JSON.parse(text); } catch { return; }
        if (response?.errors?.length) return;
        return await mutate({ type: 'unfollow', uid: unfollowUid(body) }, owner, gen);
      }
      const r = classifyCreate(body, text, new Set(S.ownIds));
      if (r) await record([r], false, owner, gen);
    } catch { /* extension reloaded or unexpected payload: never break X */ }
  });
  let profileCache = null;

  // ---------- "who doesn't follow back" on your own Following page ----------
  let scanTimer = 0, resetting = false;
  function refreshHighlights() {
    const ownFollowing = activeAccount && activeAccount === myHandle() && location.pathname.toLowerCase() === `/${activeAccount}/following` && !S.scanPaused;
    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      const handle = cell.querySelector('a[href^="/"]')?.getAttribute('href')?.split('/')[1]?.toLowerCase();
      const following = !!cell.querySelector('[data-testid$="-unfollow"]');
      cell.dataset.xdrNo = ownFollowing && following && !cell.querySelector('[data-testid="userFollowIndicator"]') && !S.following[handle]?.gone ? '1' : '0';
    }
  }
  async function scan() {
    scanTimer = 0;
    theme();
    const me = myHandle();
    if (!me || me !== activeAccount || resetting || S.scanPaused || location.pathname.toLowerCase() !== `/${me}/following`) return;
    const rows = [], epoch = S.scanEpoch, gen = generation;
    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      const handle = cell.querySelector('a[href^="/"]')?.getAttribute('href').split('/')[1];
      const btn = cell.querySelector('[data-testid$="-unfollow"],[data-testid$="-follow"]');
      if (!handle || !btn) continue;
      const [uid, state] = btn.dataset.testid.split('-');
      const followsYou = !!cell.querySelector('[data-testid="userFollowIndicator"]');
      rows.push({ handle, uid, f: followsYou, following: state === 'unfollow' });
    }
    if (rows.length) await mutate({ type: 'scan', rows, epoch, day: dayKey() }, me, gen).catch(() => {});
  }
  new MutationObserver(() => { ensureAccount(); scanTimer ||= setTimeout(scan, 300); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-testid', 'href'] });

  // ---------- controls ----------
  $('.fold').onclick = () => mutate({ type: 'settings', panel: { collapsed: !S.panel?.collapsed } }).catch(reportError);
  $('.gear').onclick = () => {
    form.hidden = !form.hidden;
    for (const k of KINDS) form.elements[k].value = S.goals[k];
  };
  form.onsubmit = e => {
    e.preventDefault();
    const goals = Object.fromEntries(KINDS.map(k => [k, Math.max(1, Math.round(+form.elements[k].value) || S.goals[k])]));
    form.hidden = true;
    mutate({ type: 'settings', goals }).catch(reportError);
  };
  $('.cool-btn').onclick = () => {
    coolForm.hidden = !coolForm.hidden;
    coolForm.elements.min.value = S.followCooldownMin;
  };
  coolForm.onsubmit = e => {
    e.preventDefault();
    const min = Math.min(1440, Math.max(1, Math.round(+coolForm.elements.min.value) || S.followCooldownMin));
    coolForm.hidden = true;
    mutate({ type: 'settings', followCooldownMin: min }).catch(reportError);
  };
  $('.export').onclick = () => {
    const people = Object.entries(S.following);
    const data = {
      exportedAt: new Date().toISOString(),
      account: activeAccount, legacyBoundTo, legacyBackup,
      goals: S.goals,
      days: S.days,
      notFollowingBack: people.filter(([, u]) => !u.f && !u.gone).map(([h]) => '@' + h),
      unfollowed: people.filter(([, u]) => u.gone).map(([h]) => '@' + h)
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `x-daily-rings-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('.reset-scan').onclick = async () => {
    const button = $('.reset-scan'), resume = S.scanPaused;
    button.disabled = true;
    resetting = true;
    clearTimeout(scanTimer); scanTimer = 0;
    // Freeze this tab immediately. Other tabs use the persisted epoch and background queue.
    S.scanPaused = true;
    try {
      await mutate({ type: resume ? 'resume' : 'reset' });
      if (resume) { resetting = false; await scan(); toast('已重新扫描当前加载的名单；继续滚动可补充'); }
      else {
        document.querySelectorAll('[data-xdr-no]').forEach(el => delete el.dataset.xdrNo);
        toast('今日扫描已清零并暂停；点“重新扫描”后继续');
      }
    } catch (error) { reportError(error); await mutate({ type: 'read' }).catch(() => {}); }
    finally { resetting = false; button.disabled = false; }
  };
  $('header').addEventListener('pointerdown', e => {
    if (e.target.closest('button') || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    const header = $('header'); header.setPointerCapture(e.pointerId);
    const sx = e.clientX - host.offsetLeft, sy = e.clientY - host.offsetTop;
    const original = S.panel;
    const move = m => { S.panel = { ...S.panel, x: m.clientX - sx, y: m.clientY - sy }; place(); };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
      if (header.hasPointerCapture(e.pointerId)) header.releasePointerCapture(e.pointerId);
      mutate({ type: 'settings', panel: { x: host.offsetLeft, y: host.offsetTop } }).catch(reportError);
    };
    const cancel = () => { S.panel = original; place(); up(); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
  });

  // ---------- boot ----------
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const state = changes.accounts?.newValue?.[activeAccount];
    if (!state || activeAccount !== myHandle()) return;
    if ((state.revision ?? 0) < (S.revision ?? 0)) return;
    Object.assign(S, state);
    if (S.scanPaused) document.querySelectorAll('[data-xdr-no]').forEach(el => delete el.dataset.xdrNo);
    place();
    render();
  });
  function reportError() { toast('保存未完成，请刷新 X 页面后重试；原有记录仍保留', 5000); }
  let loadingAccount = null;
  async function ensureAccount() {
    const next = myHandle();
    if (next === activeAccount || next === loadingAccount) return;
    generation++; const gen = generation; activeAccount = next; loadingAccount = next;
    profileCache = null; profileToastPath = ''; notifiedUntil = 0;
    Object.assign(S, { goals: DEFAULT_GOALS, days: {}, ownIds: [], following: {}, panel: null, followLimitUntil: 0, followCooldownMin: DEFAULT_COOLDOWN_MIN, scanEpoch: 0, scanPaused: false, scanDay: '', revision: 0 });
    document.querySelectorAll('[data-xdr-no]').forEach(el => delete el.dataset.xdrNo);
    render();
    if (!next) { loadingAccount = null; return; }
    try {
      const loaded = await mutate({ type: 'read' }, next, gen);
      if (!loaded) return;
      // Drain only after storage is ready. hook.js captures the account at request initiation.
      document.dispatchEvent(new Event('xdr:ready'));
      await scan();
    } catch { if (generation === gen) { activeAccount = null; reportError(); } }
    finally { if (loadingAccount === next) loadingAccount = null; }
  }
  document.body.append(host); render(); ensureAccount();
  setInterval(() => { ensureAccount(); mutate({ type: 'read' }).catch(() => {}); }, 30000);
  addEventListener('resize', place);
  visualViewport?.addEventListener('resize', place);
  visualViewport?.addEventListener('scroll', place);
})();
