/**
 * Dashboard admin - ringkasan marketplace.
 */
(function () {
  'use strict';

  var statGrid = document.getElementById('stat-grid');
  var chartCanvas = document.getElementById('chart-orders');
  var chart = null;

  function statCard(icon, iconClass, label, value, hint) {
    return (
      '<div class="stat-card">' +
      '<span class="stat-icon ' + (iconClass || '') + '">' + UI.icon(icon) + '</span>' +
      '<div class="stat-body"><span class="stat-label">' + UI.escapeHtml(label) + '</span>' +
      '<span class="stat-value">' + UI.escapeHtml(value) + '</span>' +
      (hint ? '<span class="stat-hint">' + UI.escapeHtml(hint) + '</span>' : '') +
      '</div></div>'
    );
  }

  function renderChart(monthly) {
    if (!chartCanvas || !monthly) return;
    Charts.load()
      .then(function (Chart) {
        if (chart) chart.destroy();
        chart = new Chart(chartCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: monthly.map(function (m) { return m.label; }),
            datasets: [
              {
                label: 'Jumlah pesanan',
                data: monthly.map(function (m) { return m.count; }),
                backgroundColor: Charts.COLORS.primary,
                borderRadius: 4,
                maxBarThickness: 30,
              },
            ],
          },
          options: Charts.baseOptions({
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: Charts.COLORS.muted, precision: 0 },
                grid: { color: Charts.COLORS.grid },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    return ctx.parsed.y + ' pesanan';
                  },
                },
              },
            },
          }),
        });
      })
      .catch(function () { /* grafik tambahan */ });
  }

  function renderTop(hostId, items, valueKey, formatter) {
    var host = document.getElementById(hostId);
    if (!items || !items.length) {
      host.innerHTML = '<p class="muted mb-0">Belum ada data.</p>';
      return;
    }
    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Nama</th><th class="num">Nilai</th></tr></thead><tbody>' +
      items
        .map(function (item) {
          return '<tr><td>' + UI.escapeHtml(item.name) + '</td>' +
            '<td class="num price">' + UI.escapeHtml(formatter(item[valueKey])) + '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';
  }

  function load() {
    statGrid.innerHTML = Array(4).join('<div class="stat-card"><div class="skeleton skeleton-box" style="height:60px"></div></div>');

    API.get('/admin/overview')
      .then(function (data) {
        statGrid.innerHTML = [
          statCard('users', '', 'Total pengguna', UI.formatNumber(data.users.total),
            UI.formatNumber(data.users.newToday) + ' daftar hari ini'),
          statCard('store', 'is-blue', 'Toko aktif', UI.formatNumber(data.stores.active),
            UI.formatNumber(data.stores.suspended) + ' dinonaktifkan'),
          statCard('package', 'is-orange', 'Produk aktif', UI.formatNumber(data.products.active),
            UI.formatNumber(data.products.hidden) + ' disembunyikan'),
          statCard('clipboard-list', '', 'Permintaan pesanan', UI.formatNumber(data.orders.total),
            UI.formatNumber(data.orders.pending) + ' menunggu konfirmasi'),
          statCard('package-check', 'is-blue', 'Pesanan selesai', UI.formatNumber(data.orders.completed),
            'Terhitung sebagai penjualan'),
          statCard('flag', 'is-red', 'Laporan terbuka', UI.formatNumber(data.moderation.openReports),
            'Menunggu ditinjau'),
          statCard('eye-off', 'is-grey', 'Ulasan disembunyikan', UI.formatNumber(data.moderation.hiddenReviews),
            'Moderasi admin'),
          statCard('shield-check', 'is-grey', 'Super admin', UI.formatNumber(data.users.superadmins),
            'Akun pengelola'),
        ].join('');

        renderChart(data.monthlyOrders);
        renderTop('top-stores', data.topStores, 'totalSold', function (v) { return v + ' terjual'; });
        renderTop('top-products', data.topProducts, 'soldCount', function (v) { return v + ' terjual'; });

        Admin.setBadge('laporan', data.moderation.openReports);
      })
      .catch(function (err) {
        statGrid.innerHTML = UI.errorState(err.message);
      });
  }

  Admin.init('ringkasan').then(function (session) {
    if (session) load();
  });
})();
