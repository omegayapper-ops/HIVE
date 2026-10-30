/* Shows a small "Install app" banner when the browser says the app can be installed.
   Chrome / Edge / Samsung Internet: native install prompt. iPhone/iPad Safari: "Add to Home Screen" hint. */
(function () {
  'use strict';
  var KEY = 'lf_install_dismissed_at';
  var WEEK = 7 * 24 * 3600 * 1000;

  function installed() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.matchMedia('(display-mode: fullscreen)').matches ||
             window.matchMedia('(display-mode: minimal-ui)').matches ||
             window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function recentlyDismissed() {
    try { var t = +localStorage.getItem(KEY); return t && Date.now() - t < WEEK; } catch (e) { return false; }
  }
  function remember() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }

  if (installed() || recentlyDismissed()) return;

  var bar = null, timer = null;
  function hide() {
    if (timer) clearTimeout(timer);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
  }
  function show(text, actionLabel, onAction) {
    if (bar) return;
    bar = document.createElement('div');
    bar.setAttribute('role', 'dialog');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:2147483000;' +
      'top:calc(env(safe-area-inset-top,0px) + 10px);max-width:calc(100vw - 20px);box-sizing:border-box;' +
      'display:flex;align-items:center;gap:10px;padding:10px 12px 10px 14px;border-radius:14px;' +
      'background:#132a63;color:#fff;font:600 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.35)';
    var span = document.createElement('span');
    span.textContent = text;
    bar.appendChild(span);
    if (actionLabel) {
      var go = document.createElement('button');
      go.textContent = actionLabel;
      go.style.cssText = 'border:0;border-radius:10px;padding:8px 14px;background:#f59e0b;color:#1b1200;font:700 14px system-ui,sans-serif;white-space:nowrap';
      go.onclick = function () { onAction(); };
      bar.appendChild(go);
    }
    var x = document.createElement('button');
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '\u00d7';
    x.style.cssText = 'border:0;background:transparent;color:#cfe0ff;font-size:22px;line-height:1;padding:0 4px';
    x.onclick = function () { remember(); hide(); };
    bar.appendChild(x);
    document.body.appendChild(bar);
    timer = setTimeout(hide, 20000);
  }

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    show('Install Lost & Found as an app', 'Install', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) {
        if (c && c.outcome !== 'accepted') remember();
        deferred = null; hide();
      });
    });
  });
  window.addEventListener('appinstalled', function () { deferred = null; hide(); });

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome/i.test(ua);
  if (isIOS && isSafari) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        show('To install: tap Share, then \u201cAdd to Home Screen\u201d', null, null);
      }, 2500);
    });
  }
})();
