/**
 * Kerangka bersama dashboard penjual.
 *
 * Menggambar sidebar, menjaga agar hanya penjual yang bisa masuk,
 * dan menyediakan helper kecil untuk halaman-halaman dashboard.
 */
(function () {
  'use strict';

  var MENU = [
    { key: 'ringkasan', href: '/dashboard/index.html', label: 'Ringkasan', icon: 'layout-dashboard' },
    { key: 'produk', href: '/dashboard/produk.html', label: 'Produk', icon: 'package' },
    { key: 'pesanan', href: '/dashboard/pesanan.html', label: 'Pesanan', icon: 'clipboard-list' },
    { key: 'keuangan', href: '/dashboard/keuangan.html', label: 'Keuangan', icon: 'wallet' },
    { key: 'ulasan', href: '/dashboard/ulasan.html', label: 'Ulasan', icon: 'star' },
    { key: 'profil', href: '/dashboard/profil.html', label: 'Profil Toko', icon: 'store' },
  ];

  function renderShell(active, session) {
    var header = document.getElementById('app-header');
    if (header) UI.renderNavbar('dashboard', session);

    var side = document.getElementById('dash-side');
    if (side) {
      var store = session.store || {};
      side.innerHTML =
        '<div class="dash-side-head">' +
        '<span class="avatar avatar-lg">' + UI.escapeHtml((session.user.name || '?').charAt(0).toUpperCase()) + '</span>' +
        '<div style="min-width:0">' +
        '<strong style="display:block">' + UI.escapeHtml(store.name || session.user.name) + '</strong>' +
        '<span class="tiny muted">Toko saya</span>' +
        '</div></div>' +
        '<ul class="dash-nav">' +
        MENU.map(function (item) {
          return '<li><a href="' + item.href + '"' + (active === item.key ? ' class="active"' : '') + '>' +
            UI.icon(item.icon) + '<span>' + item.label + '</span>' +
            '<span class="nav-label hidden" data-badge="' + item.key + '"></span></a></li>';
        }).join('') +
        '</ul>' +
        '<div class="mt-5"><a class="btn btn-outline btn-sm btn-block" href="/" target="_blank">' +
        UI.icon('external-link', 'icon icon-sm') + ' Lihat halaman publik</a></div>';
    }
  }

  /** Inisialisasi halaman dashboard + guard penjaga role. */
  function initDashboard(active) {
    return UI.requireRole('seller').then(function (session) {
      if (!session) return null;
      renderShell(active, session);
      return session;
    });
  }

  /** Menyorot jumlah pesanan menunggu di sidebar. */
  function setBadge(key, count) {
    var badge = document.querySelector('[data-badge="' + key + '"]');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /** Formatter tanggal untuk input type="date". */
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.Dashboard = {
    init: initDashboard,
    setBadge: setBadge,
    todayISO: todayISO,
    MENU: MENU,
  };
})();
