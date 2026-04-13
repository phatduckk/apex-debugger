(function () {
  var origFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (opts && opts.method === 'POST' && String(url).includes('/rest/layout')) {
      var headers = opts.headers || {};
      var isOurs = (typeof headers.get === 'function'
        ? headers.get('X-Apex-Ext-Restore')
        : headers['X-Apex-Ext-Restore']) === '1';
      if (document.documentElement.hasAttribute('data-apex-folder-mode') && !isOurs) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
    }
    return origFetch.apply(this, arguments);
  };

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._apexMethod = method;
    this._apexUrl = String(url);
    return origOpen.apply(this, arguments);
  };

  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    if (document.documentElement.hasAttribute('data-apex-folder-mode') &&
        this._apexMethod === 'POST' && this._apexUrl.includes('/rest/layout')) {
      return;
    }
    return origSend.apply(this, arguments);
  };
})();
