// One extension-origin queue serializes x.com + twitter.com + all tabs, including Firefox.
if (typeof importScripts === 'function') importScripts('model.js', 'state.js');
const api = globalThis.browser ?? globalThis.chrome;
let pending = Promise.resolve();
api.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.channel !== 'xdr-state') return false;
  if (!/^https:\/\/(x\.com|twitter\.com)\//.test(sender.url ?? '')) return false;
  const account = XDRState.accountKey(msg.account);
  if (!account) { respond({ error: '无法识别当前 X 账号' }); return false; }
  const task = async () => {
    const saved = await api.storage.local.get(null);
    const accounts = Object.assign(Object.create(null), saved.accounts ?? {});
    let migration = null;
    if (!saved.schemaVersion) {
      const legacy = Object.fromEntries(Object.keys(XDRState.defaults()).filter(k => k in saved).map(k => [k, saved[k]]));
      if (Object.keys(legacy).length) {
        migration = { legacyBackup: legacy, legacyBoundTo: account };
        accounts[account] ??= { ...XDRState.defaults(), ...legacy };
      }
    }
    const result = XDRState.update(accounts[account], msg.op ?? { type: 'read' }, XDR.dayKey());
    accounts[account] = result.state;
    await api.storage.local.set({ schemaVersion: 3, accounts, ...migration });
    return { ...result, account, legacyBoundTo: migration?.legacyBoundTo ?? saved.legacyBoundTo,
      legacyBackup: migration?.legacyBackup ?? saved.legacyBackup };
  };
  const job = pending.then(task);
  pending = job.catch(() => {});
  job.then(respond, error => respond({ error: String(error.message ?? error) }));
  return true;
});
