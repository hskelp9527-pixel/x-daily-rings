// Runs in the page (MAIN world) at document_start. Sends no requests of its own:
// it only watches X's own publish / follow / unfollow / profile-timeline responses and forwards them to content.js.
(() => {
  const watched = url => /\/(CreateTweet|CreateNoteTweet|UserTweets\w*|User\w*Timeline)$|\/friendships\/(create|destroy)\.json$/.test(String(url).split('?')[0]);
  // Failed responses are forwarded too (with status): a refused follow is how rate limits show up.
  // Held until content.js (document_idle) is listening, so a timeline loaded right at page start isn't lost.
  let ready = false;
  const queue = [];
  const emit = (url, body, text, status) => {
    const fire = () => document.dispatchEvent(new CustomEvent('xdr:net', { detail: JSON.stringify({ url: String(url), body: typeof body === 'string' ? body : body instanceof URLSearchParams ? String(body) : '', text, status }) }));
    if (ready) fire(); else if (queue.length < 50) queue.push(fire);
  };
  document.addEventListener('xdr:ready', () => { ready = true; queue.splice(0).forEach(fire => fire()); }, { once: true });

  // Debug aid: X GraphQL / REST operations this page has called, e.g. `__xdrOps` in the console.
  const ops = window.__xdrOps = {};
  const seen = url => {
    const m = String(url).split('?')[0].match(/\/graphql\/[^/]+\/(\w+)$|\/1\.1\/([\w/]+)\.json$/);
    if (m) ops[m[1] ?? m[2]] = (ops[m[1] ?? m[2]] || 0) + 1;
  };

  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    seen(url);
    // Read a Request's body before fetch consumes it. Never let this throw into X's own request.
    let body = null;
    try {
      if (watched(url)) body = init?.body != null ? Promise.resolve(init.body) : input instanceof Request ? input.clone().text() : Promise.resolve('');
    } catch { body = null; }
    const promise = nativeFetch.apply(this, arguments);
    if (body) {
      promise.then(res => Promise.all([body, res.clone().text()]).then(([b, t]) => emit(url, b, t, res.status))).catch(() => {});
    }
    return promise;
  };

  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__xdrUrl = url;
    seen(url);
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (watched(this.__xdrUrl ?? '')) {
      this.addEventListener('load', () => {
        const text = this.responseType === 'json' ? JSON.stringify(this.response) : ['', 'text'].includes(this.responseType) ? this.responseText : '';
        emit(this.__xdrUrl, body, text, this.status);
      });
    }
    return send.apply(this, arguments);
  };
})();
