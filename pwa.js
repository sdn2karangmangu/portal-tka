/* Pendaftaran service worker + tombol "Pasang di HP" */
(function () {
  'use strict';

  // 1. Service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (e) {
        console.warn('Service worker gagal didaftarkan:', e);
      });
    });
  }

  // 2. Sudah terpasang? Tidak perlu tampilkan apa-apa.
  var isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  if (isStandalone) return;

  var DISMISS_KEY = 'tka_pwa_dismissed_until';
  function dismissed() {
    try { return Date.now() < Number(localStorage.getItem(DISMISS_KEY) || 0); } catch (e) { return false; }
  }
  function dismissForDays(days) {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400000)); } catch (e) {}
  }

  var deferredPrompt = null;
  var banner = null;

  function buildBanner(html, withInstallBtn) {
    if (banner || dismissed()) return;
    banner = document.createElement('div');
    banner.setAttribute('role', 'dialog');
    banner.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;z-index:60;max-width:460px;margin:0 auto;' +
      'background:#fff;border:2px solid #93c5fd;border-radius:20px;padding:12px 14px;' +
      'box-shadow:0 10px 30px rgba(15,23,42,.25);font-family:Nunito,system-ui,sans-serif;' +
      'display:flex;align-items:center;gap:10px;';
    banner.innerHTML =
      '<img src="icons/icon-192.png" alt="" width="44" height="44" style="border-radius:12px;flex:none">' +
      '<div style="flex:1;min-width:0;font-size:12.5px;line-height:1.35;color:#0f172a">' + html + '</div>' +
      (withInstallBtn
        ? '<button id="pwaInstallBtn" style="flex:none;background:#1d4ed8;color:#fff;border:0;border-radius:12px;' +
          'padding:9px 14px;font-weight:800;font-size:12.5px;cursor:pointer">Pasang</button>'
        : '') +
      '<button id="pwaCloseBtn" aria-label="Tutup" style="flex:none;background:transparent;border:0;' +
      'color:#64748b;font-size:20px;line-height:1;cursor:pointer;padding:4px 6px">&times;</button>';
    document.body.appendChild(banner);

    banner.querySelector('#pwaCloseBtn').onclick = function () {
      dismissForDays(7);
      removeBanner();
    };
    var btn = banner.querySelector('#pwaInstallBtn');
    if (btn) {
      btn.onclick = function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
          removeBanner();
        });
      };
    }
  }

  function removeBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  // 3. Android / Chrome / Edge: tombol pasang bawaan browser
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    buildBanner('<strong>Pasang Portal TKA di HP</strong><br>Buka lebih cepat langsung dari layar utama.', true);
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    removeBanner();
    dismissForDays(3650);
  });

  // 4. iPhone / iPad (Safari): tidak ada prompt otomatis, tampilkan petunjuk
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome|android/i.test(ua);
  if (isIOS && isSafari) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        buildBanner(
          '<strong>Pasang di iPhone:</strong> ketuk tombol <strong>Bagikan</strong> ' +
          '(kotak dengan panah ke atas), lalu pilih <strong>Tambah ke Layar Utama</strong>.',
          false
        );
      }, 2500);
    });
  }
})();
