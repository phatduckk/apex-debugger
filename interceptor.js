(function () {
  function isLayoutSave(method, url) {
    var m = (method || '').toUpperCase();
    var s = String(url instanceof Request ? url.url : url);
    if (m !== 'POST' && m !== 'PUT') return false;
    return s.includes('/rest/layout') || /\/api\/apex\/[^/]+\/layout$/.test(s);
  }

  var origFetch = window.fetch;
  window.fetch = function (url, opts) {
    var method = opts ? opts.method : (url instanceof Request ? url.method : null);
    var reqUrl = url instanceof Request ? url.url : url;
    if (document.documentElement.hasAttribute('data-apex-folder-mode') &&
        isLayoutSave(method, reqUrl)) {
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return origFetch.apply(this, arguments);
  };

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._apexMethod = (method || '').toUpperCase();
    this._apexUrl = String(url);
    return origOpen.apply(this, arguments);
  };

  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (document.documentElement.hasAttribute('data-apex-folder-mode') &&
        isLayoutSave(this._apexMethod, this._apexUrl)) {
      return;
    }
    return origSend.apply(this, arguments);
  };
})();
