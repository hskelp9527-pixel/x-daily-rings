// Floating rings panel + "who doesn't follow back" highlighter. Isolated world, document_idle.
(() => {
  const { KINDS, LABELS, dayKey, classifyCreate, unfollowUid, crossedTier, message, emptyDay } = globalThis.XDR;
  const COLORS = { post: '#1d9bf0', reply: '#00ba7c', quote: '#f91880' };
  const ICONS = { post: '📝', reply: '↩️', quote: '🔁' };
  const DEFAULT_GOALS = { post: 3, reply: 20, quote: 5 };
  const R = 26, C = 2 * Math.PI * R;
  const store = chrome.storage.local;
  const S = { goals: DEFAULT_GOALS, days: {}, ownIds: [], following: {}, panel: null };
  const today = () => ({ ...emptyDay(), ...S.days[dayKey()] });

  // ---------- page-side styles for the highlighter ----------
  const pageStyle = document.createElement('style');
  pageStyle.textContent = '[data-xdr-no="1"]{background:rgba(249,24,128,.10)!important;box-shadow:inset 4px 0 0 #f91880!important}';
  document.head.append(pageStyle);

  // ---------- panel ----------
  const host = document.createElement('div');
  host.id = 'x-daily-rings';
  host.style.cssText = 'position:fixed;z-index:2147483000;left:0;top:0';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial}
    .card{width:236px;font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f1419;background:rgba(255,255,255,.96);border:1px solid #e1e8ed;border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.14);overflow:hidden}
    :host(.dark) .card{color:#e7e9ea;background:rgba(21,24,28,.96);border-color:#2f3336}
    header{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:grab;user-select:none}
    header b{font-size:13px}header .date{color:#8b98a5;font-size:12px;flex:1}
    button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;border-radius:8px;padding:2px 6px}
    button:hover{background:rgba(127,127,127,.15)}
    .rings{display:flex;justify-content:space-between;padding:0 10px 6px}
    .ring{text-align:center;width:68px}.ring svg{display:block;margin:auto}
    .ring .num{font:700 16px system-ui;fill:currentColor}.ring .lab{font-size:11px;color:#8b98a5}
    .ring.full svg{animation:pop .6s ease}
    @keyframes pop{50%{transform:scale(1.12)}}
    form{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 10px 8px}
    form label{font-size:11px;color:#8b98a5}form input{width:100%;box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid #8b98a5;border-radius:6px;padding:2px 4px}
    form[hidden]{display:none}
    form button,form button:hover{grid-column:1/-1;background:#1d9bf0;color:#fff;padding:4px}
    footer{display:flex;align-items:center;gap:6px;padding:6px 10px 8px;border-top:1px solid rgba(127,127,127,.2);font-size:12px;color:#8b98a5}
    footer span{flex:1}
    .mini{display:none;padding:0 10px 8px;font-weight:600}
    .collapsed .rings,.collapsed form,.collapsed footer{display:none}.collapsed .mini{display:block}
    .toast{position:absolute;bottom:calc(100% + 8px);left:0;width:236px;box-sizing:border-box;padding:8px 12px;border-radius:12px;background:#0f1419;color:#fff;font:13px/1.45 system-ui,sans-serif;opacity:0;transform:translateY(6px);transition:.25s;pointer-events:none}
    .toast.show{opacity:1;transform:none}
    .confetti{position:fixed;top:-12px;width:8px;height:12px;border-radius:2px;animation:fall linear forwards;pointer-events:none}
    @keyframes fall{to{transform:translateY(105vh) rotate(720deg)}}
  </style>
  <div class="toast"></div>
  <div class="card">
    <header><b>今日输出</b><span class="date"></span><button class="gear" title="设置目标">⚙</button><button class="fold" title="收起 / 展开">–</button></header>
    <div class="rings"></div>
    <form hidden>${KINDS.map(k => `<label>${LABELS[k]}目标<input name="${k}" type="number" min="1" step="1"></label>`).join('')}<button>保存目标</button></form>
    <div class="mini"></div>
    <footer><span class="follow"></span><button class="export" title="导出全部数据为 JSON">导出</button></footer>
  </div>`;
  const $ = s => root.querySelector(s);
  const card = $('.card'), form = $('form');

  function render() {
    const day = today();
    $('.date').textContent = dayKey().slice(5);
    $('.rings').innerHTML = KINDS.map(k => {
      const goal = S.goals[k], n = day[k], p = Math.min(1, n / goal);
      return `<div class="ring${p >= 1 ? ' full' : ''}"><svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="${R}" fill="none" stroke="${COLORS[k]}" stroke-opacity=".18" stroke-width="7"/>
        <circle cx="32" cy="32" r="${R}" fill="none" stroke="${COLORS[k]}" stroke-width="7" stroke-linecap="round"
          stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset .5s"/>
        <text class="num" x="32" y="38" text-anchor="middle">${n}</text></svg>
        <div class="lab">${LABELS[k]} ${n}/${goal}</div></div>`;
    }).join('');
    $('.mini').textContent = KINDS.map(k => `${ICONS[k]}${day[k]}`).join('  ');
    const scanned = Object.values(S.following), no = scanned.filter(u => !u.f).length;
    $('.follow').textContent = (scanned.length ? `没回关 ${no} / 已扫 ${scanned.length} · ` : '') + `今日取关 ${day.unfollow}`;
    card.classList.toggle('collapsed', !!S.panel?.collapsed);
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
    host.classList.toggle('dark', bg[0] + bg[1] + bg[2] < 384);
  }

  function place() {
    const p = S.panel ?? {};
    const x = p.x ?? innerWidth - 260, y = p.y ?? innerHeight - 290;
    host.style.left = Math.max(0, Math.min(x, innerWidth - 240)) + 'px';
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
    const colors = Object.values(COLORS).concat('#ffd400', '#7856ff');
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
        for (const [h, u] of Object.entries(following)) if (u.uid === uid) delete following[h];
        await store.set({ days: { ...days, [key]: day }, following });
        return;
      }
      const r = classifyCreate(body, text, new Set(ownIds));
      if (!r) return;
      const prev = day[r.kind]++;
      await store.set({ days: { ...days, [key]: day }, ownIds: r.id ? [String(r.id), ...ownIds].slice(0, 500) : ownIds });
      const tier = crossedTier(prev, day[r.kind], S.goals[r.kind]);
      if (tier) {
        toast(`${ICONS[r.kind]} ${LABELS[r.kind]} ${tier}%：${message(tier)}`);
        if (tier === 100) confetti();
      }
    } catch { /* extension reloaded or unexpected payload: never break X */ }
  });

  // ---------- "who doesn't follow back" on your own Following page ----------
  let scanTimer = 0;
  function scan() {
    scanTimer = 0;
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
      else delete next[handle];
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
    const data = {
      exportedAt: new Date().toISOString(),
      goals: S.goals,
      days: S.days,
      notFollowingBack: Object.entries(S.following).filter(([, u]) => !u.f).map(([h]) => '@' + h)
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
