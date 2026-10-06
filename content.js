// Floating rings panel + "who doesn't follow back" highlighter. Isolated world, document_idle.
(() => {
  const { KINDS, LABELS, FIRST_FULL, dayKey, classifyCreate, unfollowUid, crossedTier, message, emptyDay } = globalThis.XDR;
  // Ring gradients [start, end], Apple activity-ring style.
  const COLORS = { post: ['#64d2ff', '#0a84ff'], reply: ['#a6f4a4', '#30d158'], quote: ['#ff9fb5', '#ff2d55'] };
  const ICONS = { post: '📝', reply: '↩️', quote: '🔁' };
  const DEFAULT_GOALS = { post: 3, reply: 20, quote: 5 };
  const R = 27, C = 2 * Math.PI * R;
  const store = chrome.storage.local;
  const S = { goals: DEFAULT_GOALS, days: {}, ownIds: [], following: {}, panel: null };
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
    header{display:flex;align-items:center;gap:6px;padding:12px 12px 4px 16px;cursor:grab;user-select:none}
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
    .stats{display:grid;grid-template-columns:repeat(3,1fr) auto;align-items:center;gap:4px;margin:0 10px 10px;padding:8px 6px 8px 12px;border-radius:16px;background:var(--well)}
    .stats div{display:grid;white-space:nowrap}
    .stats b{font-size:15px;font-weight:700}
    .stats span{font-size:10.5px;color:var(--sub)}
    .stats .no b{color:#ff2d55}
    .export{padding:5px 10px;border-radius:10px;font-size:12px;font-weight:600;color:#0a84ff;white-space:nowrap}
    .export:hover{background:rgba(10,132,255,.12)}
    .mini{display:none;padding:2px 16px 12px;font-size:14px;font-weight:600;white-space:nowrap}
    .collapsed .rings,.collapsed form,.collapsed .stats{display:none}.collapsed .mini{display:block}
    .toast{position:absolute;bottom:calc(100% + 10px);left:0;width:256px;padding:10px 14px;border-radius:18px;color:#fff;font:13px/1.45 -apple-system,"PingFang SC","Segoe UI",sans-serif;
      background:rgba(28,28,30,.72);-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);
      border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.25);opacity:0;transform:translateY(8px) scale(.98);transition:.3s cubic-bezier(.2,.9,.3,1);pointer-events:none}
    .toast.show{opacity:1;transform:none}
    .confetti{position:fixed;top:-12px;width:8px;height:12px;border-radius:2px;animation:fall linear forwards;pointer-events:none}
    @keyframes fall{to{transform:translateY(105vh) rotate(720deg)}}
  </style>
  <div class="toast"></div>
  <div class="card">
    <header><b>今日输出</b><span class="date"></span><button class="icon gear" title="设置目标">⚙︎</button><button class="icon fold" title="收起 / 展开">–</button></header>
    <div class="rings"></div>
    <form hidden>${KINDS.map(k => `<label>${LABELS[k]}目标<input name="${k}" type="number" min="1" step="1"></label>`).join('')}<button>保存目标</button></form>
    <div class="mini"></div>
    <div class="stats">
      <div class="scan"><b>0</b><span>已扫描</span></div>
      <div class="no"><b>0</b><span>没回关</span></div>
      <div class="unf"><b>0</b><span>今日取关</span></div>
      <button class="export" title="导出全部数据为 JSON">导出</button>
    </div>
  </div>`;
  const $ = s => root.querySelector(s);
  const card = $('.card'), form = $('form');

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
    // Unfollowed people stay in both tallies (marked gone); only their highlight goes away.
    const scanned = Object.values(S.following);
    $('.scan b').textContent = scanned.length;
    $('.no b').textContent = scanned.filter(u => !u.f).length;
    $('.unf b').textContent = day.unfollow;
    card.classList.toggle('collapsed', !!S.panel?.collapsed);
    $('.fold').textContent = S.panel?.collapsed ? '+' : '–';
    theme();
  }

  // Body is transparent while X boots; reading that as black made the card flash dark on every reload.
  function theme() {
    const [r, g, b, a = 1] = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
    if (a > 0.5) host.classList.toggle('dark', r + g + b < 384);
  }

  function place() {
    const p = S.panel ?? {};
    const x = p.x ?? innerWidth - 280, y = p.y ?? innerHeight - 300;
    host.style.left = Math.max(0, Math.min(x, innerWidth - 260)) + 'px';
    host.style.top = Math.max(0, Math.min(y, innerHeight - 40)) + 'px';
  }

  let toastTimer;
  function toast(text) {
    const t = $('.toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
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

  // ---------- events from hook.js ----------
  document.addEventListener('xdr:net', async e => {
    try {
      const { url, body, text } = JSON.parse(e.detail);
      const { days = {}, ownIds = [], following = {} } = await store.get(['days', 'ownIds', 'following']);
      const key = dayKey(), day = { ...emptyDay(), ...days[key] };
      if (url.includes('/friendships/destroy.json')) {
        day.unfollow++;
        const uid = unfollowUid(body);
        for (const u of Object.values(following)) if (u.uid === uid) u.gone = true;
        await store.set({ days: { ...days, [key]: day }, following });
        return;
      }
      const r = classifyCreate(body, text, new Set(ownIds));
      if (!r) return;
      const prev = day[r.kind]++;
      const tier = crossedTier(prev, day[r.kind], S.goals[r.kind]);
      // The day's first closed ring always gets the signature line.
      const cheer = tier === 100 && !day.full ? FIRST_FULL : tier && message(tier);
      if (tier === 100) day.full = true;
      await store.set({ days: { ...days, [key]: day }, ownIds: r.id ? [String(r.id), ...ownIds].slice(0, 500) : ownIds });
      if (tier) {
        toast(`${ICONS[r.kind]} ${LABELS[r.kind]} ${tier}%：${cheer}`);
        if (tier === 100) confetti();
      }
    } catch { /* extension reloaded or unexpected payload: never break X */ }
  });

  // ---------- "who doesn't follow back" on your own Following page ----------
  let scanTimer = 0;
  function scan() {
    scanTimer = 0;
    theme();
    const me = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]')?.getAttribute('href')?.slice(1);
    if (!me || location.pathname.toLowerCase() !== `/${me.toLowerCase()}/following`) return;
    const next = { ...S.following };
    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      const handle = cell.querySelector('a[href^="/"]')?.getAttribute('href').split('/')[1];
      const btn = cell.querySelector('[data-testid$="-unfollow"],[data-testid$="-follow"]');
      if (!handle || !btn) continue;
      const [uid, state] = btn.dataset.testid.split('-');
      const followsYou = !!cell.querySelector('[data-testid="userFollowIndicator"]');
      if (state === 'unfollow') next[handle] = { uid, f: followsYou };
      else if (next[handle]) next[handle] = { ...next[handle], gone: true };
      cell.dataset.xdrNo = state === 'unfollow' && !followsYou ? '1' : '0';
    }
    if (JSON.stringify(next) !== JSON.stringify(S.following)) store.set({ following: next }).catch(() => {});
  }
  new MutationObserver(() => { scanTimer ||= setTimeout(scan, 300); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-testid'] });

  // ---------- controls ----------
  $('.fold').onclick = () => store.set({ panel: { ...S.panel, collapsed: !S.panel?.collapsed } });
  $('.gear').onclick = () => {
    form.hidden = !form.hidden;
    for (const k of KINDS) form.elements[k].value = S.goals[k];
  };
  form.onsubmit = e => {
    e.preventDefault();
    const goals = Object.fromEntries(KINDS.map(k => [k, Math.max(1, Math.round(+form.elements[k].value) || S.goals[k])]));
    form.hidden = true;
    store.set({ goals });
  };
  $('.export').onclick = () => {
    const people = Object.entries(S.following);
    const data = {
      exportedAt: new Date().toISOString(),
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
  $('header').addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const sx = e.clientX - host.offsetLeft, sy = e.clientY - host.offsetTop;
    const move = m => { host.style.left = m.clientX - sx + 'px'; host.style.top = m.clientY - sy + 'px'; };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      store.set({ panel: { ...S.panel, x: host.offsetLeft, y: host.offsetTop } });
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  });

  // ---------- boot ----------
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [k, { newValue }] of Object.entries(changes)) if (k in S) S[k] = newValue ?? (k === 'goals' ? DEFAULT_GOALS : S[k]);
    place();
    render();
  });
  store.get(Object.keys(S)).then(saved => {
    Object.assign(S, saved);
    document.body.append(host);
    place();
    render();
    setInterval(render, 30000); // midnight rollover
    addEventListener('resize', place);
  });
})();
