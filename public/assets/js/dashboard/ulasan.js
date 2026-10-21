/**
 * Dashboard penjual - daftar ulasan produk sendiri.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-ulasan');

  function renderStats(data) {
    var stats = data.stats || [];
    var published = { count: 0, avg: 0 };
    var hidden = { count: 0, avg: 0 };

    stats.forEach(function (s) {
      if (s._id === 'published') published = { count: s.count, avg: s.avg || 0 };
      if (s._id === 'hidden') hidden = { count: s.count, avg: s.avg || 0 };
    });

    document.getElementById('stat-grid').innerHTML = [
      ['star', 'is-orange', 'Rating rata-rata', (published.avg || 0).toFixed(1).replace('.0', '') + ' / 5', 'Dari ulasan yang tampil'],
      ['message-circle', '', 'Ulasan tampil', UI.formatNumber(published.count), 'Terbit di halaman produk'],
      ['eye-off', 'is-grey', 'Ulasan disembunyikan', UI.formatNumber(hidden.count), 'Disembunyikan admin'],
    ]
      .map(function (s) {
        return '<div class="stat-card"><span class="stat-icon ' + s[1] + '">' + UI.icon(s[0]) + '</span>' +
          '<div class="stat-body"><span class="stat-label">' + UI.escapeHtml(s[2]) + '</span>' +
          '<span class="stat-value">' + UI.escapeHtml(s[3]) + '</span>' +
          '<span class="stat-hint">' + UI.escapeHtml(s[4]) + '</span></div></div>';
      })
      .join('');
  }

  function render(data) {
    var items = data.items || [];
    document.getElementById('jumlah-ulasan').textContent = UI.formatNumber(data.pagination.total) + ' ulasan';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Belum ada ulasan', 'Ulasan muncul setelah pembeli menyelesaikan pesanan.', 'star');
      return;
    }

    host.innerHTML = items
      .map(function (r) {
        var product = r.productId || {};
        var badge = r.status === 'published'
          ? '<span class="badge">Tampil</span>'
          : r.status === 'hidden'
            ? '<span class="badge badge-danger">Disembunyikan</span>'
            : '<span class="badge badge-muted">Menunggu</span>';

        return '<article class="review-item">' +
          '<div class="review-head">' +
          '<span class="avatar">' + UI.escapeHtml((r.buyerId && r.buyerId.name ? r.buyerId.name : '?').charAt(0).toUpperCase()) + '</span>' +
          '<div><strong>' + UI.escapeHtml(r.buyerId && r.buyerId.name ? r.buyerId.name : 'Pembeli') + '</strong>' +
          '<div class="tiny muted">' + UI.formatDateTime(r.createdAt) + '</div></div>' +
          UI.stars(r.rating) +
          badge +
          '</div>' +
          '<p>' + UI.escapeHtml(r.comment) + '</p>' +
          '<div class="tiny muted">Produk: ' +
          (product.slug
            ? '<a href="/produk.html?slug=' + encodeURIComponent(product.slug) + '">' + UI.escapeHtml(product.name || '-') + '</a>'
            : UI.escapeHtml(product.name || '-')) +
          '</div>' +
          (r.moderation && r.moderation.reason
            ? '<div class="alert alert-warning mt-2"><span>Alasan disembunyikan: ' + UI.escapeHtml(r.moderation.reason) + '</span></div>'
            : '') +
          '</article>';
      })
      .join('');
  }

  function load() {
    host.innerHTML = UI.skeletonGrid(3, 'stack');

    API.get('/seller/reviews')
      .then(function (data) {
        renderStats(data);
        render(data);
      })
      .catch(function (err) {
        host.innerHTML = UI.errorState(err.message);
      });
  }

  Dashboard.init('ulasan').then(function (session) {
    if (session) load();
  });
})();
