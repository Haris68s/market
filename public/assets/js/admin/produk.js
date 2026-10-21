/**
 * Panel admin - moderasi produk.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-produk');

  var STATUS_LABEL = {
    draft: 'Draft',
    active: 'Aktif',
    out_of_stock: 'Habis',
    hidden: 'Disembunyikan',
  };

  function render(data) {
    var items = data.items || [];
    document.getElementById('jumlah-produk').textContent = UI.formatNumber(data.pagination.total) + ' produk';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Produk tidak ditemukan', 'Coba kata kunci atau filter yang lain.', 'package');
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Produk</th><th>Toko</th><th class="num">Harga</th><th>Status</th><th>Alasan</th><th></th></tr></thead><tbody>' +
      items
        .map(function (p) {
          var store = p.storeId || {};
          var cls =
            p.status === 'active' ? 'badge' :
            p.status === 'draft' ? 'badge badge-muted' :
            p.status === 'hidden' ? 'badge badge-danger' : 'badge badge-warning';

          return '<tr>' +
            '<td><strong>' + UI.escapeHtml(p.name) + '</strong>' +
            '<div class="tiny muted">' + UI.escapeHtml(p.category) + '</div></td>' +
            '<td class="small">' + UI.escapeHtml(store.name || '-') + '</td>' +
            '<td class="num price">' + UI.formatRupiah(p.price) + '</td>' +
            '<td><span class="' + cls + '">' + STATUS_LABEL[p.status] + '</span></td>' +
            '<td class="tiny muted">' + UI.escapeHtml(p.hiddenReason || '-') + '</td>' +
            '<td class="text-right" style="white-space:nowrap">' +
            (p.status === 'hidden'
              ? '<button class="btn btn-outline btn-sm" data-show="' + p._id + '">Tampilkan</button>'
              : '<button class="btn btn-danger btn-sm" data-hide="' + p._id + '">Sembunyikan</button>') +
            '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    host.querySelectorAll('[data-hide]').forEach(function (btn) {
      btn.addEventListener('click', function () { setStatus(btn.dataset.hide, 'hidden'); });
    });
    host.querySelectorAll('[data-show]').forEach(function (btn) {
      btn.addEventListener('click', function () { setStatus(btn.dataset.show, 'active'); });
    });
  }

  function setStatus(id, status) {
    var isHide = status === 'hidden';

    var modal = UI.openModal({
      title: isHide ? 'Sembunyikan produk?' : 'Tampilkan produk kembali?',
      body:
        '<p class="muted small">Alasan wajib diisi dan tercatat pada log aktivitas.</p>' +
        '<div id="produk-error"></div>' +
        '<div class="field"><label class="label" for="alasan">Alasan <span class="req">*</span></label>' +
        '<textarea class="textarea" id="alasan" placeholder="' +
        (isHide ? 'Contoh: Foto produk tidak sesuai aturan marketplace.' : 'Contoh: Reviewer sudah memverifikasi ulang.') +
        '"></textarea></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn ' + (isHide ? 'btn-danger' : 'btn-primary') + '" id="simpan-produk">' +
        (isHide ? 'Sembunyikan' : 'Tampilkan') + '</button>',
    });

    modal.element.querySelector('#simpan-produk').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#produk-error');
      var reason = modal.element.querySelector('#alasan').value.trim();

      if (reason.length < 5) {
        errorHost.innerHTML =
          '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon-sm') +
          '<span>Alasan wajib diisi minimal 5 karakter.</span></div>';
        return;
      }

      API.patch('/admin/products/' + id + '/status', { status: status, reason: reason })
        .then(function (data) {
          modal.close();
          UI.toast(data.message || 'Status produk diperbarui.', 'success');
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

    API.get('/admin/products', {
      q: document.getElementById('q').value.trim(),
      status: document.getElementById('filter-status').value,
      limit: 50,
    })
      .then(render)
      .catch(function (err) { host.innerHTML = UI.errorState(err.message); });
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () { clearTimeout(timer); timer = setTimeout(fn, delay); };
  }

  function init() {
    document.getElementById('q').addEventListener('input', debounce(load, 350));
    document.getElementById('filter-status').addEventListener('change', load);
    load();
  }

  Admin.init('produk').then(function (session) {
    if (session) init();
  });
})();
