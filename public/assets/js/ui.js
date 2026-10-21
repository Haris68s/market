/**
 * UI — komponen yang dipakai bersama di semua halaman.
 *
 * Berisi: format angka/tanggal, ikon SVG, navbar, footer, toast, modal,
 * kartu produk, serta helper untuk loading/empty/error state.
 */
(function () {
  'use strict';

  /* ------------------------------ Format ------------------------------ */

  function formatRupiah(value) {
    var number = Number(value) || 0;
    return 'Rp' + number.toLocaleString('id-ID', { maximumFractionDigits: 0 });
  }

  function formatNumber(value) {
    return (Number(value) || 0).toLocaleString('id-ID');
  }

  function formatDate(value) {
    if (!value) return '-';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '-';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRelative(value) {
    if (!value) return '-';
    var d = new Date(value);
    if (isNaN(d.getTime())) return '-';
    var diff = Date.now() - d.getTime();
    var menit = Math.floor(diff / 60000);
    if (menit < 1) return 'Baru saja';
    if (menit < 60) return menit + ' menit lalu';
    var jam = Math.floor(menit / 60);
    if (jam < 24) return jam + ' jam lalu';
    var hari = Math.floor(jam / 24);
    if (hari < 30) return hari + ' hari lalu';
    return formatDate(value);
  }

  /* ------------------------------- Ikon ------------------------------- */

  /**
   * Buat markup ikon SVG.
   * Class dasar "icon" SELALU ditambahkan, class tambahan hanya melengkapi.
   * (Kalau class dasar diganti, aturan CSS seperti position:absolute ikut hilang.)
   */
  function icon(name, className) {
    var cls = 'icon' + (className ? ' ' + className : '');
    return (
      '<svg class="' + cls + '" aria-hidden="true" focusable="false">' +
      '<use href="/assets/icons/sprite.svg#' + name + '"></use></svg>'
    );
  }

  function stars(rating, count) {
    var value = Number(rating) || 0;
    var html = '<span class="stars" aria-hidden="true">';
    for (var i = 1; i <= 5; i += 1) {
      html +=
        '<svg class="icon icon-sm' + (i <= Math.round(value) ? '' : ' empty') + '">' +
        '<use href="/assets/icons/sprite.svg#star"></use></svg>';
    }
    html += '</span>';
    if (count !== undefined) {
      html += '<span class="rating-value">' + value.toFixed(1).replace('.0', '') + '</span>';
      html += '<span class="muted tiny">(' + formatNumber(count) + ')</span>';
    }
    return html;
  }

  /* ------------------------------ Toast ------------------------------- */

  function toast(message, type, duration) {
    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    var icons = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.innerHTML = icon(icons[type] || 'info', 'icon') + '<div>' + escapeHtml(message) + '</div>';
    container.appendChild(el);

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity 200ms';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, duration || 4000);
  }

  /* ------------------------------ Modal ------------------------------- */

  function openModal(options) {
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-label="' + escapeHtml(options.title || 'Dialog') + '">' +
      '<div class="modal-head"><h3>' + escapeHtml(options.title || '') + '</h3>' +
      '<button class="btn btn-ghost btn-icon" data-close aria-label="Tutup">' + icon('x') + '</button></div>' +
      '<div class="modal-body">' + (options.body || '') + '</div>' +
      (options.footer === false ? '' : '<div class="modal-foot">' + (options.footer || '') + '</div>') +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';

    function close() {
      document.body.style.overflow = '';
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', onKey);

    var firstInput = backdrop.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();

    if (options.onOpen) options.onOpen(backdrop, close);
    return { element: backdrop, close: close };
  }

  /** Konfirmasi sederhana (pengganti window.confirm yang lebih rapi). */
  function confirmDialog(options) {
    return new Promise(function (resolve) {
      var isDanger = options.danger !== false;
      var modal = openModal({
        title: options.title || 'Konfirmasi',
        body: '<p>' + escapeHtml(options.message || 'Lanjutkan?') + '</p>',
        footer:
          '<button class="btn btn-ghost" data-close>Batal</button>' +
          '<button class="btn ' + (isDanger ? 'btn-danger' : 'btn-primary') + '" data-confirm>' +
          escapeHtml(options.confirmText || 'Ya, lanjutkan') + '</button>',
      });

      modal.element.addEventListener('click', function (e) {
        if (e.target.closest('[data-confirm]')) {
          modal.close();
          resolve(true);
        } else if (e.target.closest('[data-close]') || e.target === modal.element) {
          resolve(false);
        }
      });
    });
  }

  /* ------------------------------ Escape ------------------------------ */

  function escapeHtml(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ------------------------- State components ------------------------- */

  function skeletonGrid(count, className) {
    var html = '<div class="' + (className || 'product-grid') + '">';
    for (var i = 0; i < count; i += 1) {
      html +=
        '<div class="product-card"><div class="skeleton skeleton-box" style="border-radius:0"></div>' +
        '<div class="product-body"><div class="skeleton skeleton-title"></div>' +
        '<div class="skeleton skeleton-text" style="width:40%"></div>' +
        '<div class="skeleton skeleton-text" style="width:60%;margin-bottom:0"></div></div></div>';
    }
    return html + '</div>';
  }

  function emptyState(title, message, iconName, actionHtml) {
    return (
      '<div class="state">' +
      icon(iconName || 'package', 'icon') +
      '<h3>' + escapeHtml(title) + '</h3>' +
      '<p>' + escapeHtml(message || '') + '</p>' +
      (actionHtml || '') +
      '</div>'
    );
  }

  function errorState(message, retryId) {
    return (
      '<div class="state">' +
      icon('alert-triangle', 'icon') +
      '<h3>Gagal memuat data</h3>' +
      '<p>' + escapeHtml(message || 'Terjadi kesalahan. Silakan coba lagi.') + '</p>' +
      (retryId
        ? '<button class="btn btn-outline" onclick="document.getElementById(\'' + retryId + '\').click()">Coba lagi</button>'
        : '') +
      '</div>'
    );
  }

  /* --------------------------- Kartu produk --------------------------- */

  function productCardHTML(product) {
    var image = product.images && product.images[0]
      ? product.images[0].url
      : '';
    var store = product.store || {};
    var stock = product.stock;

    var badge = '';
    if (product.status === 'out_of_stock' || stock === 0) {
      badge = '<span class="badge badge-danger">Habis</span>';
    } else if (product.ratingCount > 0) {
      badge = '<span class="badge">Tersedia</span>';
    }

    return (
      '<a class="product-card" href="/produk.html?slug=' + encodeURIComponent(product.slug) + '">' +
      '<div class="product-media">' +
      (image
        ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
        : '<div class="placeholder">' + icon('image') + '</div>') +
      '<div class="product-badges">' + badge + '</div>' +
      '</div>' +
      '<div class="product-body">' +
      '<h3 class="product-title">' + escapeHtml(product.name) + '</h3>' +
      (store.name
        ? '<div class="product-store">' + icon('store', 'icon-sm') + escapeHtml(store.name) + '</div>'
        : '') +
      '<div class="product-footer">' +
      '<span class="price">' + formatRupiah(product.price) + '</span>' +
      (product.ratingCount > 0
        ? '<span class="product-rating">' + stars(product.ratingAvg) + '<span>' + formatNumber(product.ratingCount) + '</span></span>'
        : '<span class="product-rating muted tiny">Belum ada ulasan</span>') +
      '</div>' +
      '</div>' +
      '</a>'
    );
  }

  function storeCardHTML(store) {
    return (
      '<a class="store-card" href="/toko.html?slug=' + encodeURIComponent(store.slug) + '">' +
      '<div class="flex">' +
      '<div class="avatar avatar-lg">' + escapeHtml((store.name || '?').charAt(0).toUpperCase()) + '</div>' +
      '<div><h3>' + escapeHtml(store.name) + '</h3>' +
      '<span class="tiny muted">' + escapeHtml(store.category || '') + '</span></div>' +
      '</div>' +
      '<p>' + escapeHtml(store.description || '') + '</p>' +
      '<div class="flex small muted flex-wrap">' +
      '<span>' + icon('star', 'icon-sm') + ' ' + (Number(store.ratingAvg || 0).toFixed(1)) + ' (' + formatNumber(store.ratingCount) + ')</span>' +
      '<span>' + icon('package', 'icon-sm') + ' ' + formatNumber(store.productCount) + ' produk</span>' +
      (store.location && store.location.city ? '<span>' + icon('map-pin', 'icon-sm') + ' ' + escapeHtml(store.location.city) + '</span>' : '') +
      '</div>' +
      '</a>'
    );
  }

  /* ------------------------- Navbar & footer -------------------------- */

  var sessionCache = null;

  function getSession() {
    if (sessionCache) return Promise.resolve(sessionCache);
    return API.get('/auth/me', null, { silent401: true })
      .then(function (data) {
        sessionCache = data;
        if (data && data.csrfToken) API.storeToken(data.csrfToken);
        return sessionCache;
      })
      .catch(function () {
        sessionCache = { user: null, store: null };
        return sessionCache;
      });
  }

  function renderNavbar(active, session) {
    var host = document.getElementById('app-header');
    if (!host) return;

    var links = [
      { key: 'beranda', href: '/', label: 'Beranda' },
      { key: 'katalog', href: '/katalog.html', label: 'Katalog' },
    ];

    var menu = links
      .map(function (l) {
        return '<a class="nav-link' + (active === l.key ? ' active' : '') + '" href="' + l.href + '">' + l.label + '</a>';
      })
      .join('');

    var actions = '';
    if (session && session.user) {
      var dashboardHref = session.user.role === 'superadmin' ? '/admin/index.html' : '/dashboard/index.html';
      var dashboardLabel = session.user.role === 'superadmin' ? 'Panel Admin' : 'Dashboard Toko';
      var initial = (session.user.name || '?').charAt(0).toUpperCase();
      actions =
        '<div class="user-menu">' +
        '<button class="user-chip" id="user-chip" aria-haspopup="true" aria-expanded="false">' +
        '<span class="avatar">' + escapeHtml(initial) + '</span>' +
        '<span class="user-name">' + escapeHtml(session.user.name) + '</span>' +
        icon('chevron-down', 'icon-sm') +
        '</button>' +
        '<div class="dropdown" id="user-dropdown" hidden>' +
        '<a href="' + dashboardHref + '">' + icon('layout-dashboard', 'icon-sm') + dashboardLabel + '</a>' +
        '<a href="/dashboard/profil.html">' + icon('store', 'icon-sm') + 'Profil Toko</a>' +
        '<div class="dropdown-sep"></div>' +
        '<button type="button" id="btn-logout">' + icon('log-out', 'icon-sm') + 'Keluar</button>' +
        '</div></div>';
    } else {
      actions =
        '<a class="btn btn-ghost btn-sm" href="/masuk.html">Masuk</a>' +
        '<a class="btn btn-primary btn-sm" href="/daftar.html">Buka Toko</a>';
    }

    host.innerHTML =
      '<header class="navbar"><div class="container navbar-inner">' +
      '<a class="brand" href="/">' +
      '<span class="brand-mark">' + icon('shopping-bag') + '</span>' +
      '<span class="brand-text">KantinSiswa<small>Marketplace Siswa</small></span>' +
      '</a>' +
      '<form class="navbar-search" id="nav-search" role="search">' +
      icon('search', 'icon-sm') +
      '<input class="input" type="search" id="nav-search-input" name="q" placeholder="Cari produk..." aria-label="Cari produk">' +
      '</form>' +
      '<nav class="nav-menu" id="nav-menu">' + menu + '</nav>' +
      '<div class="navbar-actions">' + actions +
      '<button class="nav-toggle" id="nav-toggle" aria-label="Buka menu">' + icon('menu') + '</button>' +
      '</div>' +
      '</div></header>';

    // Interaksi navbar
    var toggle = document.getElementById('nav-toggle');
    var menuEl = document.getElementById('nav-menu');
    toggle.addEventListener('click', function () {
      menuEl.classList.toggle('open');
    });

    var form = document.getElementById('nav-search');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = document.getElementById('nav-search-input').value.trim();
      window.location.href = '/katalog.html' + (q ? '?q=' + encodeURIComponent(q) : '');
    });

    // Isi nilai pencarian dari URL
    var params = new URLSearchParams(window.location.search);
    var currentQ = params.get('q');
    if (currentQ) document.getElementById('nav-search-input').value = currentQ;

    var chip = document.getElementById('user-chip');
    var dropdown = document.getElementById('user-dropdown');
    if (chip && dropdown) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.hidden = !dropdown.hidden;
        chip.setAttribute('aria-expanded', String(!dropdown.hidden));
      });
      document.addEventListener('click', function (e) {
        if (!dropdown.hidden && !dropdown.contains(e.target) && e.target !== chip) {
          dropdown.hidden = true;
          chip.setAttribute('aria-expanded', 'false');
        }
      });
    }

    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        API.post('/auth/logout').then(function () {
          // Session sudah dihapus, token CSRF lama tidak berlaku lagi.
          API.storeToken(null);
          window.location.href = '/';
        });
      });
    }
  }

  function renderFooter() {
    var host = document.getElementById('app-footer');
    if (!host) return;
    host.innerHTML =
      '<footer class="footer"><div class="container">' +
      '<div class="footer-grid">' +
      '<div>' +
      '<a class="brand" href="/"><span class="brand-mark">' + icon('shopping-bag') + '</span>' +
      '<span class="brand-text">KantinSiswa<small>Marketplace Siswa</small></span></a>' +
      '<p class="small muted mt-3">Marketplace produk &amp; jasa antar siswa SMK. Pesan lewat WhatsApp, kelola toko sendiri, dan bangun reputasi.</p>' +
      '</div>' +
      '<div><h4>Jelajahi</h4><ul>' +
      '<li><a href="/">Beranda</a></li>' +
      '<li><a href="/katalog.html">Katalog produk</a></li>' +
      '<li><a href="/daftar.html">Buka toko</a></li>' +
      '</ul></div>' +
      '<div><h4>Penjual</h4><ul>' +
      '<li><a href="/dashboard/index.html">Dashboard toko</a></li>' +
      '<li><a href="/dashboard/produk.html">Kelola produk</a></li>' +
      '<li><a href="/dashboard/keuangan.html">Catat keuangan</a></li>' +
      '</ul></div>' +
      '<div><h4>Bantuan</h4><ul>' +
      '<li><a href="mailto:support@kantinsiswa.local">support@kantinsiswa.local</a></li>' +
      '<li><a href="/lupa-password.html">Lupa password</a></li>' +
      '<li><a href="/404.html">Halaman tidak ditemukan</a></li>' +
      '</ul></div>' +
      '</div>' +
      '<div class="footer-bottom">' +
      '<span>&copy; ' + new Date().getFullYear() + ' KantinSiswa. Dibuat untuk kebutuhan sekolah.</span>' +
      '<span>Versi 1.0 &middot; Dibuat dengan Node.js, Express &amp; MongoDB</span>' +
      '</div>' +
      '</div></footer>';
  }

  /** Inisialisasi layout umum (navbar + footer) untuk halaman publik. */
  function initLayout(active) {
    return getSession().then(function (session) {
      renderNavbar(active, session);
      renderFooter();
      return session;
    });
  }

  /**
   * Guard untuk halaman dashboard: pastikan pengguna login & punya role yang benar.
   */
  function requireRole(role, redirect) {
    return getSession().then(function (session) {
      if (!session.user) {
        var next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = (redirect || '/masuk.html') + '?next=' + next;
        return null;
      }
      if (role && session.user.role !== role) {
        document.body.innerHTML =
          '<div class="error-page"><div>' +
          '<div class="error-code">403</div>' +
          '<h1>Akses ditolak</h1>' +
          '<p class="muted">Halaman ini hanya untuk ' + (role === 'superadmin' ? 'super admin' : 'penjual') + '.</p>' +
          '<a class="btn btn-primary" href="/">Kembali ke beranda</a>' +
          '</div></div>';
        return null;
      }
      return session;
    });
  }

  window.UI = {
    formatRupiah: formatRupiah,
    formatNumber: formatNumber,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatRelative: formatRelative,
    icon: icon,
    stars: stars,
    toast: toast,
    openModal: openModal,
    confirmDialog: confirmDialog,
    escapeHtml: escapeHtml,
    skeletonGrid: skeletonGrid,
    emptyState: emptyState,
    errorState: errorState,
    productCardHTML: productCardHTML,
    storeCardHTML: storeCardHTML,
    getSession: getSession,
    initLayout: initLayout,
    requireRole: requireRole,
    renderNavbar: renderNavbar,
    renderFooter: renderFooter,
  };
})();
