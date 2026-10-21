/**
 * Dashboard penjual - keuangan (pemasukan, pengeluaran, grafik, ekspor CSV).
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-transaksi');
  var statGrid = document.getElementById('stat-grid');
  var chartCanvas = document.getElementById('chart-cashflow');
  var chart = null;

  var INCOME_CATEGORIES = [
    { slug: 'penjualan', label: 'Penjualan' },
    { slug: 'bonus', label: 'Bonus / THR' },
    { slug: 'lainnya', label: 'Lainnya' },
  ];

  var EXPENSE_CATEGORIES = [
    { slug: 'modal', label: 'Modal Barang' },
    { slug: 'kemasan', label: 'Kemasan' },
    { slug: 'transportasi', label: 'Transportasi' },
    { slug: 'operasional', label: 'Biaya Operasional' },
    { slug: 'peralatan', label: 'Peralatan' },
    { slug: 'lainnya', label: 'Lainnya' },
  ];

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

  function renderSummary(summary) {
    statGrid.innerHTML = [
      statCard('trending-up', '', 'Total pemasukan', UI.formatRupiah(summary.income),
        UI.formatNumber(summary.incomeCount) + ' transaksi'),
      statCard('trending-down', 'is-red', 'Total pengeluaran', UI.formatRupiah(summary.expense),
        UI.formatNumber(summary.expenseCount) + ' transaksi'),
      statCard('wallet', 'is-blue', 'Selisih arus kas', UI.formatRupiah(summary.net), 'Pemasukan - pengeluaran'),
      statCard('receipt', 'is-grey', 'Jumlah transaksi', UI.formatNumber(summary.transactionCount), 'Periode terpilih'),
    ].join('');

    var hostKategori = document.getElementById('kategori-ringkas');
    if (!summary.byCategory || !summary.byCategory.length) {
      hostKategori.innerHTML = '<p class="muted mb-0">Belum ada transaksi pada periode ini.</p>';
    } else {
      hostKategori.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Kategori</th><th>Jenis</th><th class="num">Jumlah</th><th class="num">Total</th></tr></thead><tbody>' +
        summary.byCategory
          .map(function (row) {
            return '<tr><td>' + UI.escapeHtml(row.category) + '</td>' +
              '<td><span class="badge ' + (row.type === 'income' ? '' : 'badge-danger') + '">' +
              (row.type === 'income' ? 'Pemasukan' : 'Pengeluaran') + '</span></td>' +
              '<td class="num">' + UI.formatNumber(row.count) + '</td>' +
              '<td class="num price">' + UI.formatRupiah(row.total) + '</td></tr>';
          })
          .join('') +
        '</tbody></table></div>';
    }

    renderChart(summary.cashFlow);
  }

  function renderChart(cashFlow) {
    if (!chartCanvas || !cashFlow) return;
    Charts.load()
      .then(function (Chart) {
        if (chart) chart.destroy();
        chart = new Chart(chartCanvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: cashFlow.map(function (d) { return d.label; }),
            datasets: [
              {
                label: 'Pemasukan',
                data: cashFlow.map(function (d) { return d.income; }),
                borderColor: Charts.COLORS.primary,
                backgroundColor: Charts.COLORS.primaryLight,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
              },
              {
                label: 'Pengeluaran',
                data: cashFlow.map(function (d) { return d.expense; }),
                borderColor: Charts.COLORS.danger,
                backgroundColor: Charts.COLORS.dangerLight,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
              },
            ],
          },
          options: Charts.baseOptions(),
        });
      })
      .catch(function () { /* grafik bersifat tambahan, abaikan bila gagal */ });
  }

  function renderList(data) {
    var items = data.items || [];
    document.getElementById('jumlah-transaksi').textContent = UI.formatNumber(data.pagination.total) + ' transaksi';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Belum ada transaksi', 'Catat pemasukan dan pengeluaranmu di sini.', 'receipt');
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Deskripsi</th><th class="num">Nominal</th><th></th></tr></thead><tbody>' +
      items
        .map(function (t) {
          var isIncome = t.type === 'income';
          return '<tr>' +
            '<td class="small">' + UI.formatDate(t.date) + '</td>' +
            '<td><span class="badge ' + (isIncome ? '' : 'badge-danger') + '">' +
            (isIncome ? 'Pemasukan' : 'Pengeluaran') + '</span></td>' +
            '<td class="small">' + UI.escapeHtml(t.category) + '</td>' +
            '<td class="small">' + UI.escapeHtml(t.description || '-') +
            (t.source === 'order' ? ' <span class="badge badge-info">dari pesanan</span>' : '') + '</td>' +
            '<td class="num price" style="color:' + (isIncome ? 'var(--primary-dark)' : 'var(--danger)') + '">' +
            (isIncome ? '+' : '-') + UI.formatRupiah(t.amount) + '</td>' +
            '<td class="text-right">' +
            (t.source === 'order'
              ? '<span class="tiny muted">otomatis</span>'
              : '<button class="btn btn-ghost btn-sm" data-edit="' + t._id + '">' + UI.icon('edit-3', 'icon-sm') + '</button> ' +
                '<button class="btn btn-ghost btn-sm" data-hapus="' + t._id + '" style="color:var(--danger)">' + UI.icon('trash-2', 'icon-sm') + '</button>') +
            '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    host.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = items.filter(function (t) { return t._id === btn.dataset.edit; })[0];
        openForm(item);
      });
    });

    host.querySelectorAll('[data-hapus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog({
          title: 'Hapus transaksi?',
          message: 'Transaksi ini tidak akan dihitung lagi di ringkasan.',
          confirmText: 'Ya, hapus',
        }).then(function (ok) {
          if (!ok) return;
          API.del('/seller/transactions/' + btn.dataset.hapus)
            .then(function () {
              UI.toast('Transaksi dihapus.', 'success');
              load();
            })
            .catch(function (err) { UI.toast(err.message, 'error'); });
        });
      });
    });
  }

  function openForm(transaction, type) {
    var isEdit = Boolean(transaction);
    var jenis = isEdit ? transaction.type : type;
    var categories = jenis === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    var options = categories
      .map(function (c) {
        return '<option value="' + c.slug + '"' + (transaction && transaction.category === c.slug ? ' selected' : '') + '>' +
          c.label + '</option>';
      })
      .join('');

    var modal = UI.openModal({
      title: isEdit ? 'Ubah Transaksi' : (jenis === 'income' ? 'Tambah Pemasukan' : 'Tambah Pengeluaran'),
      body:
        '<div id="trx-error"></div>' +
        '<div class="form-row">' +
        '<div class="field"><label class="label" for="t-amount">Nominal (Rp) <span class="req">*</span></label>' +
        '<input class="input" type="number" id="t-amount" min="1" step="100" value="' +
        (transaction ? transaction.amount : '') + '" placeholder="10000"></div>' +
        '<div class="field"><label class="label" for="t-category">Kategori <span class="req">*</span></label>' +
        '<select class="select" id="t-category">' + options + '</select></div>' +
        '</div>' +
        '<div class="field"><label class="label" for="t-desc">Deskripsi</label>' +
        '<input class="input" id="t-desc" value="' + UI.escapeHtml((transaction && transaction.description) || '') +
        '" placeholder="Contoh: Beli 50 cup plastik"></div>' +
        '<div class="field"><label class="label" for="t-date">Tanggal transaksi</label>' +
        '<input class="input" type="date" id="t-date" value="' +
        (transaction ? new Date(transaction.date).toISOString().slice(0, 10) : Dashboard.todayISO()) + '"></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn btn-primary" id="simpan-trx">Simpan</button>',
    });

    modal.element.querySelector('#simpan-trx').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#trx-error');
      var payload = {
        type: jenis,
        category: modal.element.querySelector('#t-category').value,
        amount: parseInt(modal.element.querySelector('#t-amount').value, 10),
        description: modal.element.querySelector('#t-desc').value.trim(),
        date: modal.element.querySelector('#t-date').value,
      };

      var request = isEdit
        ? API.patch('/seller/transactions/' + transaction._id, payload)
        : API.post('/seller/transactions', payload);

      request
        .then(function () {
          modal.close();
          UI.toast(isEdit ? 'Transaksi diperbarui.' : 'Transaksi tercatat.', 'success');
          load();
        })
        .catch(function (err) {
          errorHost.innerHTML =
            '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
        });
    });
  }

  function load() {
    host.innerHTML = UI.skeletonGrid(3, 'stack');

    var params = {
      type: document.getElementById('filter-jenis').value,
      category: document.getElementById('filter-kategori').value,
      from: document.getElementById('filter-dari').value,
      to: document.getElementById('filter-sampai').value,
      limit: 100,
    };

    Promise.all([
      API.get('/seller/transactions', params),
      API.get('/seller/transactions/summary', { period: 'all' }),
    ])
      .then(function (results) {
        renderList(results[0]);
        renderSummary(results[1]);
      })
      .catch(function (err) {
        host.innerHTML = UI.errorState(err.message);
      });
  }

  function init() {
    document.getElementById('btn-pemasukan').addEventListener('click', function () { openForm(null, 'income'); });
    document.getElementById('btn-pengeluaran').addEventListener('click', function () { openForm(null, 'expense'); });

    ['filter-jenis', 'filter-kategori', 'filter-dari', 'filter-sampai'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', load);
    });

    document.getElementById('btn-ekspor').addEventListener('click', function () {
      var params = new URLSearchParams({
        type: document.getElementById('filter-jenis').value,
        category: document.getElementById('filter-kategori').value,
        from: document.getElementById('filter-dari').value,
        to: document.getElementById('filter-sampai').value,
      });
      window.location.href = '/api/seller/transactions/export?' + params.toString();
    });

    // Isi dropdown kategori transaksi
    var select = document.getElementById('filter-kategori');
    INCOME_CATEGORIES.concat(EXPENSE_CATEGORIES).forEach(function (c) {
      var option = document.createElement('option');
      option.value = c.slug;
      option.textContent = c.label;
      select.appendChild(option);
    });

    load();
  }

  Dashboard.init('keuangan').then(function (session) {
    if (session) init();
  });
})();
