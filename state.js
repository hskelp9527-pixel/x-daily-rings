// Pure account-state operations. background.js is the sole writer in every browser/origin.
globalThis.XDRState = (() => {
  const defaults = () => ({ goals: { post: 3, reply: 20, quote: 5 }, days: {}, ownIds: [], following: {}, panel: null,
    followLimitUntil: 0, followCooldownMin: 30, scanEpoch: 0, scanPaused: false, scanDay: '', revision: 0 });
  const accountKey = value => /^[a-z0-9_]{1,15}$/i.test(value ?? '') ? value.toLowerCase() : null;
  function update(state, op, key) {
    const s = structuredClone({ ...defaults(), ...state });
    s.revision++;
    if (s.scanDay !== key) { s.scanDay = key; s.scanEpoch++; s.scanPaused = false; }
    const before = { ...XDR.emptyDay(), ...s.days[key] };
    const day = { ...before, log: [...before.log] };
    if (op.type === 'record') {
      const known = new Set([...s.ownIds, ...day.log.map(row => row[0])]);
      for (const item of op.items ?? []) {
        if (!XDR.KINDS.includes(item.kind) || !/^\d+$/.test(String(item.id)) || known.has(String(item.id))) continue;
        known.add(String(item.id)); s.ownIds.unshift(String(item.id));
        day[item.kind]++; day.log.push([String(item.id), item.kind, item.time ?? '']);
      }
      s.ownIds = s.ownIds.slice(0, 2000);
      if (XDR.KINDS.some(k => day[k] > before[k])) {
        day.full ||= XDR.KINDS.some(k => day[k] >= s.goals[k]);
        s.days[key] = day;
      }
    } else if (op.type === 'scan' && op.epoch === s.scanEpoch && !s.scanPaused && op.day === key) {
      for (const row of op.rows ?? []) {
        const handle = accountKey(row.handle);
        if (!handle || !/^\d+$/.test(row.uid)) continue;
        const old = Object.hasOwn(s.following, handle) ? s.following[handle] : null;
        if (row.following && !old?.gone) Object.defineProperty(s.following, handle, { value: { uid: row.uid, f: !!row.f, d: key }, enumerable: true, writable: true, configurable: true });
        else if (old && !row.following) old.gone = true;
      }
    } else if (op.type === 'reset') {
      s.scanEpoch++; s.scanPaused = true;
      // Keep historical/unfollow flags; only remove today's membership in the scan.
      for (const row of Object.values(s.following)) if (row.d === key) row.d = null;
    } else if (op.type === 'resume') {
      s.scanEpoch++; s.scanPaused = false;
    } else if (op.type === 'unfollow') {
      day.unfollowIds ??= [];
      if (/^\d+$/.test(op.uid) && !day.unfollowIds.includes(op.uid)) {
        day.unfollowIds.push(op.uid);
        day.unfollow++; s.days[key] = day;
        for (const row of Object.values(s.following)) if (row.uid === op.uid) row.gone = true;
      }
    } else if (op.type === 'follow') {
      s.followLimitUntil = 0;
      for (const row of Object.values(s.following)) if (row.uid === op.uid) delete row.gone;
    } else if (op.type === 'settings') {
      if (op.goals) for (const k of XDR.KINDS) {
        const n = Math.round(Number(op.goals[k]));
        if (Number.isFinite(n) && n >= 1 && n <= 1000000) s.goals[k] = n;
      }
      if (op.panel) s.panel = { ...s.panel, ...op.panel };
      if (op.followCooldownMin != null) s.followCooldownMin = Math.min(1440, Math.max(1, Math.round(op.followCooldownMin) || 30));
      if (op.followLimitUntil != null) s.followLimitUntil = Number(op.followLimitUntil) || 0;
    }
    return { state: s, before, after: { ...XDR.emptyDay(), ...s.days[key] } };
  }
  return { defaults, accountKey, update };
})();
