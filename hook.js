// Runs in the page (MAIN world) at document_start. Sends no requests of its own:
// it only watches X's own publish / unfollow responses and forwards them to content.js.
(() => {
  const watched = url => /\/(CreateTweet|CreateNoteTweet)$|\/friendships\/destroy\.json$/.test(String(url).split('?')[0]);
  const emit = (url, body, text) =>
    document.dispatchEvent(new CustomEvent('xdr:net', { detail: JSON.stringify({ url: String(url), body: typeof body === 'string' ? body : '', text }) }));

  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    const promise = nativeFetch.apply(this, arguments);
    if (watched(url)) {
      const body = init?.body != null ? Promise.resolve(init.body) : input instanceof Request ? input.clone().text() : Promise.resolve('');
      promise.then(res => res.ok && Promise.all([body, res.clone().text()]).then(([b, t]) => emit(url, b, t))).catch(() => {});
    }
    return promise;
  };

  const { open, send } = XMLHttpRequest.prototype;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__xdrUrl = url;
    return open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (watched(this.__xdrUrl ?? '')) {
      this.addEventListener('load', () => {
        if (this.status < 200 || this.status >= 300) return;
        const text = this.responseType === 'json' ? JSON.stringify(this.response) : ['', 'text'].includes(this.responseType) ? this.responseText : '';
        emit(this.__xdrUrl, body, text);
      });
    }
    return send.apply(this, arguments);
  };
})();
