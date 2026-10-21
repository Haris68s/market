/**
 * Dashboard penjual - manajemen pesanan.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-pesanan');

  var STATUS_LABEL = {
    pending: 'Menunggu konfirmasi',
    confirmed: 'Dikonfirmasi',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };

  function badge(status) {
    var cls =
      status === 'completed' ? 'badge' :
      status === 'confirmed' ? 'badge badge-info' :
      status === 'cancelled' ? 'badge badge-danger' : 'badge badge-warning';
    return '<span class="' + cls + '">' + STATUS_LABEL[status] + '</span>';
  }

  function nextActions(order) {
    if (order.status === 'pending') {
      return (
        '<button class="btn btn-primary btn-sm" data-konfirmasi="' + order._id + '">Konfirmasi</button> ' +
        '<button class="btn btn-ghost btn-sm" data-batal="' + order._id + '" style="color:var(--danger)">Batalkan</button>'
      );
    }
    if (order.status === 'confirmed') {
      return (
        '<button class="btn btn-primary btn-sm" data-selesai="' + order._id + '">Tandai selesai</button> ' +
        '<button class="btn btn-outline btn-sm" data-pemasukan="' + order._id + '">Catat pemasukan</button> ' +
        '<button class="btn btn-ghost btn-sm" data-batal="' + order._id + '" style="color:var(--danger)">Batalkan</button>'
      );
    }
    if (order.status === 'completed') {
      return '<button class="btn btn-outline btn-sm" data-pemasukan="' + order._id + '">Catat pemasukan</button>';
    }
    return '<span class="tiny muted">Pesanan dibatalkan</span>';
  }

  function render(data) {
    var items = data.items || [];
    document.getElementById('jumlah-pesanan').textContent = UI.formatNumber(data.pagination.total) + ' pesanan';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Belum ada pesanan', 'Permintaan pesanan dari pembeli akan muncul di sini.', 'clipboard-list');
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Kode &amp; produk</th><th>Pembeli</th><th class="num">Qty</th><th class="num">Total</th>' +
      '<th>Tanggal</th><th>Status</th><th></th></tr></thead><tbody>' +
      items
        .map(function (o) {
          return '<tr>' +
            '<td><strong>' + UI.escapeHtml(o.orderCode) + '</strong>' +
            '<div class="tiny muted">' + UI.escapeHtml(o.productNameSnapshot) + '</div></td>' +
            '<td>' + UI.escapeHtml(o.buyerName || 'Tanpa nama') +
            (o.buyerContact ? '<div class="tiny muted">' + UI.escapeHtml(o.buyerContact) + '</div>' : '') + '</td>' +
            '<td class="num">' + o.qty + '</td>' +
            '<td class="num price">' + UI.formatRupiah(o.subtotal) + '</td>' +
            '<td class="small">' + UI.formatDate(o.createdAt) + '</td>' +
            '<td>' + badge(o.status) + '</td>' +
            '<td class="text-right" style="white-space:nowrap">' + nextActions(o) + '</td>' +
            '</tr>';
        })
        .join('') +
      '</tbody></table></div>';

    bindActions(items);
  }

  function bindActions(items) {
    function find(id) {
      return items.filter(function (o) { return o._id === id; })[0];
    }

    host.querySelectorAll('[data-konfirmasi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeStatus(btn.dataset.konfirmasi, 'confirmed');
      });
    });

    host.querySelectorAll('[data-selesai]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        changeStatus(btn.dataset.selesai, 'completed');
      });
    });

    host.querySelectorAll('[data-batal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var order = find(btn.dataset.batal);
        UI.confirmDialog({
          title: 'Batalkan pesanan?',
          message: 'Pesanan ' + order.orderCode + ' akan ditandai dibatalkan.',
          confirmText: 'Ya, batalkan',
        }).then(function (ok) {
          if (!ok) return;
          changeStatus(btn.dataset.batal, 'cancelled', 'Dibatalkan penjual');
        });
      });
    });

    host.querySelectorAll('[data-pemasukan]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openIncomeForm(find(btn.dataset.pemasukan));
      });
    });
  }

  function changeStatus(id, status, reason) {
    API.patch('/seller/orders/' + id + '/status', { status: status, reason: reason || '' })
      .then(function (data) {
        UI.toast(data.message || 'Status pesanan diperbarui.', 'success');
        load();
      })
      .catch(function (err) { UI.toast(err.message, 'error'); });
  }

  function openIncomeForm(order) {
    var modal = UI.openModal({
      title: 'Catat pemasukan pesanan',
      body:
        '<p class="muted small">Pencatatan ini berasal dari pesanan <strong>' + UI.escapeHtml(order.orderCode) +
        '</strong>. Sistem akan mencegah pencatatan ganda untuk pesanan yang sama.</p>' +
        '<div id="income-error"></div>' +
        '<div class="field"><label class="label" for="i-amount">Nominal (Rp)</label>' +
        '<input class="input" type="number" id="i-amount" min="1" step="100" value="' + order.subtotal + '">' +
        '<p class="hint">Default: qty &times; harga saat pesanan dibuat = ' + UI.formatRupiah(order.subtotal) + '</p></div>' +
        '<div class="field"><label class="label" for="i-category">Kategori</label>' +
        '<select class="select" id="i-category"><option value="penjualan">Penjualan</option></select></div>' +
        '<div class="field"><label class="label" for="i-desc">Deskripsi</label>' +
        '<input class="input" id="i-desc" value="' + UI.escapeHtml('Penjualan ' + order.productNameSnapshot) + '"></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn btn-primary" id="simpan-pemasukan">Catat pemasukan</button>',
    });

    modal.element.querySelector('#simpan-pemasukan').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#income-error');
      var payload = {
        amount: parseInt(modal.element.querySelector('#i-amount').value, 10),
        category: modal.element.querySelector('#i-category').value,
        description: modal.element.querySelector('#i-desc').value.trim(),
      };

      API.post('/seller/orders/' + order._id + '/record-income', payload)
        .then(function () {
          modal.close();
          UI.toast('Pemasukan tercatat.', 'success');
          load();
        })
        .catch(function (err) {
          errorHost.innerHTML =
            '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
        });
    });
  }

  function load() {
    host.innerHTML = UI.skeletonGrid(3, 'stack');

    API.get('/seller/orders', {
      status: document.getElementById('filter-status').value,
      limit: 50,
    })
      .then(render)
      .catch(function (err) {
        host.innerHTML = UI.errorState(err.message);
      });
  }

  function init() {
    document.getElementById('filter-status').addEventListener('change', load);
    load();
  }

  Dashboard.init('pesanan').then(function (session) {
    if (session) init();
  });
})();
