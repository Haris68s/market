/**
 * Dashboard penjual - halaman ringkasan.
 */
(function () {
  'use strict';

  var statGrid = document.getElementById('stat-grid');
  var recentOrders = document.getElementById('recent-orders');
  var lowStock = document.getElementById('low-stock');
  var chartCanvas = document.getElementById('chart-cashflow');
  var chart = null;

  var STATUS_LABEL = {
    pending: 'Menunggu konfirmasi',
    confirmed: 'Dikonfirmasi',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };

  function statCard(icon, iconClass, label, value, hint) {
    return (
      '<div class="stat-card">' +
      '<span class="stat-icon ' + (iconClass || '') + '">' + UI.icon(icon) + '</span>' +
      '<div class="stat-body">' +
      '<span class="stat-label">' + UI.escapeHtml(label) + '</span>' +
      '<span class="stat-value">' + UI.escapeHtml(value) + '</span>' +
      (hint ? '<span class="stat-hint">' + UI.escapeHtml(hint) + '</span>' : '') +
      '</div></div>'
    );
  }

  function renderStats(data) {
    statGrid.innerHTML = [
      statCard('package', '', 'Produk aktif', UI.formatNumber(data.products.active),
        UI.formatNumber(data.products.draft) + ' draft, ' + UI.formatNumber(data.products.out_of_stock) + ' habis'),
      statCard('clipboard-list', 'is-blue', 'Total pesanan', UI.formatNumber(data.orders.total),
        'Sepanjang waktu'),
      statCard('clock', 'is-orange', 'Menunggu konfirmasi', UI.formatNumber(data.orders.pending),
        'Perlu ditindaklanjuti'),
      statCard('package-check', '', 'Pesanan selesai', UI.formatNumber(data.orders.completed),
        'Sudah tercatat'),
      statCard('trending-up', '', 'Total pemasukan', UI.formatRupiah(data.finance.income),
        'Periode terpilih'),
      statCard('trending-down', 'is-red', 'Total pengeluaran', UI.formatRupiah(data.finance.expense),
        'Periode terpilih'),
      statCard('wallet', 'is-grey', 'Selisih arus kas', UI.formatRupiah(data.finance.net),
        'Belum tentu sama dengan laba'),
      statCard('star', 'is-orange', 'Rating toko',
        (Number(data.rating.average || 0).toFixed(1).replace('.0', '') || '0') + ' / 5',
        UI.formatNumber(data.rating.count) + ' ulasan'),
    ].join('');
  }

  function renderOrders(orders) {
    if (!orders || !orders.length) {
      recentOrders.innerHTML = UI.emptyState('Belum ada pesanan', 'Pesanan dari pembeli akan muncul di sini.', 'clipboard-list');
      return;
    }

    recentOrders.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Produk</th><th>Pembeli</th><th>Total</th><th>Status</th>' +
      '</tr></thead><tbody>' +
      orders
        .map(function (o) {
          var badgeClass =
            o.status === 'completed' ? 'badge' :
            o.status === 'confirmed' ? 'badge badge-info' :
            o.status === 'cancelled' ? 'badge badge-danger' : 'badge badge-warning';
          return '<tr>' +
            '<td><a href="/produk.html?slug=' + encodeURIComponent(o.productNameSnapshot) + '">' +
            UI.escapeHtml(o.productNameSnapshot) + '</a>' +
            '<div class="tiny muted">' + UI.escapeHtml(o.orderCode) + ' &middot; ' + UI.formatRelative(o.createdAt) + '</div></td>' +
            '<td>' + UI.escapeHtml(o.buyerName || 'Tanpa nama') + '</td>' +
            '<td class="num price">' + UI.formatRupiah(o.subtotal) + '</td>' +
            '<td><span class="' + badgeClass + '">' + STATUS_LABEL[o.status] + '</span></td>' +
            '</tr>';
        })
        .join('') +
      '</tbody></table></div>';
  }

  function renderLowStock(items) {
    if (!items || !items.length) {
      lowStock.innerHTML = '<p class="muted mb-0">Semua produk aktif punya stok di atas 3. Bagus!</p>';
      return;
    }
    lowStock.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Produk</th><th class="num">Sisa stok</th><th></th></tr></thead><tbody>' +
      items
        .map(function (p) {
          return '<tr><td>' + UI.escapeHtml(p.name) + '</td>' +
            '<td class="num"><span class="badge ' + (p.stock <= 0 ? 'badge-danger' : 'badge-warning') + '">' + p.stock + '</span></td>' +
            '<td class="text-right"><a class="btn btn-outline btn-sm" href="/dashboard/produk.html">Atur stok</a></td></tr>';
        })
        .join('') +
      '</tbody></table></div>';
  }

  function renderChart(cashFlow) {
    if (!chartCanvas) return;
    var labels = cashFlow.map(function (d) { return d.label; });
    var income = cashFlow.map(function (d) { return d.income; });
    var expense = cashFlow.map(function (d) { return d.expense; });

    Charts.load()
      .then(function (Chart) {
        if (chart) chart.destroy();
        chart = new Chart(chartCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Pemasukan',
                data: income,
                backgroundColor: Charts.COLORS.primary,
                borderRadius: 4,
                maxBarThickness: 22,
              },
              {
                label: 'Pengeluaran',
                data: expense,
                backgroundColor: Charts.COLORS.danger,
                borderRadius: 4,
                maxBarThickness: 22,
              },
            ],
          },
          options: Charts.baseOptions({
            scales: {
              x: { stacked: false },
              y: { stacked: false },
            },
          }),
        });
      })
      .catch(function (err) {
        document.getElementById('cashflow-note').textContent = err.message;
      });
  }

  function load() {
    var periode = document.getElementById('filter-periode').value;
    var params = { period: periode };
    if (periode === 'custom') {
      params.from = document.getElementById('filter-from').value;
      params.to = document.getElementById('filter-to').value;
      if (!params.from || !params.to) {
        UI.toast('Pilih tanggal awal dan akhir terlebih dahulu.', 'warning');
        return;
      }
    }

    statGrid.innerHTML = Array(4).join('<div class="stat-card"><div class="skeleton skeleton-box" style="height:60px"></div></div>');

    Promise.all([
      API.get('/seller/dashboard', params),
      API.get('/seller/transactions/summary', params),
    ])
      .then(function (results) {
        var data = results[0];
        var finance = results[1];

        renderStats(data);
        renderOrders(data.recentOrders);
        renderLowStock(data.lowStock);
        renderChart(finance.cashFlow);
        document.getElementById('cashflow-note').textContent = finance.note;

        Dashboard.setBadge('pesanan', data.orders.pending);
      })
      .catch(function (err) {
        statGrid.innerHTML = UI.errorState(err.message);
      });
  }

  function init() {
    var select = document.getElementById('filter-periode');
    select.addEventListener('change', function () {
      var custom = document.getElementById('custom-range');
      custom.classList.toggle('hidden', select.value !== 'custom');
      if (select.value === 'custom') {
        document.getElementById('filter-to').value = Dashboard.todayISO();
      } else {
        load();
      }
    });

    document.getElementById('filter-from').addEventListener('change', load);
    document.getElementById('filter-to').addEventListener('change', load);

    load();
  }

  Dashboard.init('ringkasan').then(function (session) {
    if (session) init();
  });
})();
