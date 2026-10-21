/**
 * Kerangka bersama dashboard super admin.
 */
(function () {
  'use strict';

  var MENU = [
    { key: 'ringkasan', href: '/admin/index.html', label: 'Ringkasan', icon: 'layout-dashboard' },
    { key: 'pengguna', href: '/admin/pengguna.html', label: 'Pengguna & Toko', icon: 'users' },
    { key: 'produk', href: '/admin/produk.html', label: 'Produk', icon: 'package' },
    { key: 'kategori', href: '/admin/kategori.html', label: 'Kategori', icon: 'layers' },
    { key: 'laporan', href: '/admin/laporan.html', label: 'Laporan & Ulasan', icon: 'flag' },
    { key: 'log', href: '/admin/log.html', label: 'Log Aktivitas', icon: 'file-text' },
    { key: 'pengaturan', href: '/admin/pengaturan.html', label: 'Pengaturan', icon: 'settings' },
  ];

  function renderShell(active, session) {
    var header = document.getElementById('app-header');
    if (header) UI.renderNavbar('admin', session);

    var side = document.getElementById('dash-side');
    if (side) {
      side.innerHTML =
        '<div class="dash-side-head">' +
        '<span class="stat-icon" style="background:var(--primary-light);color:var(--primary-dark)">' + UI.icon('shield-check') + '</span>' +
        '<div style="min-width:0">' +
        '<strong style="display:block">Panel Admin</strong>' +
        '<span class="tiny muted">' + UI.escapeHtml(session.user.name) + '</span>' +
        '</div></div>' +
        '<ul class="dash-nav">' +
        MENU.map(function (item) {
          return '<li><a href="' + item.href + '"' + (active === item.key ? ' class="active"' : '') + '>' +
            UI.icon(item.icon) + '<span>' + item.label + '</span>' +
            '<span class="nav-label hidden" data-badge="' + item.key + '"></span></a></li>';
        })
        .join('') +
        '</ul>';
    }
  }

  function initAdmin(active) {
    return UI.requireRole('superadmin').then(function (session) {
      if (!session) return null;
      renderShell(active, session);
      return session;
    });
  }

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

  window.Admin = {
    init: initAdmin,
    setBadge: setBadge,
    MENU: MENU,
  };
})();
