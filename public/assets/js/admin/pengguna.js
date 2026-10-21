/**
 * Panel admin - manajemen pengguna & toko.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-pengguna');

  function statusBadge(status) {
    var cls =
      status === 'active' ? 'badge' :
      status === 'suspended' ? 'badge badge-danger' : 'badge badge-warning';
    var label = status === 'active' ? 'Aktif' : status === 'suspended' ? 'Dinonaktifkan' : 'Menunggu';
    return '<span class="' + cls + '">' + label + '</span>';
  }

  function render(data) {
    var items = data.items || [];
    document.getElementById('jumlah-pengguna').textContent = UI.formatNumber(data.pagination.total) + ' pengguna';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Pengguna tidak ditemukan', 'Coba kata kunci atau filter yang lain.', 'users');
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Pengguna</th><th>Toko</th><th>WhatsApp</th><th>Status</th><th>Bergabung</th><th></th></tr></thead><tbody>' +
      items
        .map(function (u) {
          var store = u.storeId || {};
          return '<tr>' +
            '<td><div class="flex"><span class="avatar">' + UI.escapeHtml((u.name || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div><strong>' + UI.escapeHtml(u.name) + '</strong>' +
            '<div class="tiny muted">' + UI.escapeHtml(u.role === 'superadmin' ? 'Super admin' : 'Penjual') + '</div></div></div></td>' +
            '<td class="small">' + (store.name ? UI.escapeHtml(store.name) : '-') +
            (store.productCount !== undefined ? '<div class="tiny muted">' + store.productCount + ' produk</div>' : '') + '</td>' +
            '<td class="small">' + UI.escapeHtml(u.whatsapp) + '</td>' +
            '<td>' + statusBadge(u.status) + '</td>' +
            '<td class="small">' + UI.formatDate(u.createdAt) + '</td>' +
            '<td class="text-right" style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" data-detail="' + u._id + '">Detail</button> ' +
            (u.role === 'superadmin'
              ? '<span class="tiny muted">super admin</span>'
              : '<button class="btn btn-ghost btn-sm" data-toggle="' + u._id + '" data-status="' + u.status +
                '" style="color:' + (u.status === 'active' ? 'var(--danger)' : 'var(--primary)') + '">' +
                (u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan') + '</button>') +
            '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    host.querySelectorAll('[data-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () { openDetail(btn.dataset.detail); });
    });

    host.querySelectorAll('[data-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleStatus(btn.dataset.toggle, btn.dataset.status); });
    });
  }

  function toggleStatus(id, currentStatus) {
    var next = currentStatus === 'active' ? 'suspended' : 'active';
    var label = next === 'suspended' ? 'nonaktifkan' : 'aktifkan kembali';

    var modal = UI.openModal({
      title: (next === 'suspended' ? 'Nonaktifkan' : 'Aktifkan') + ' akun?',
      body:
        '<p class="muted small">Alasan wajib diisi dan akan dicatat pada log aktivitas.</p>' +
        '<div id="status-error"></div>' +
        '<div class="field"><label class="label" for="alasan">Alasan <span class="req">*</span></label>' +
        '<textarea class="textarea" id="alasan" placeholder="Contoh: Toko melanggar aturan marketplace (produk ilegal)."></textarea></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn ' + (next === 'suspended' ? 'btn-danger' : 'btn-primary') + '" id="simpan-status">Ya, ' + label + '</button>',
    });

    modal.element.querySelector('#simpan-status').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#status-error');
      var reason = modal.element.querySelector('#alasan').value.trim();

      if (reason.length < 5) {
        errorHost.innerHTML =
          '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
          '<span>Alasan wajib diisi minimal 5 karakter.</span></div>';
        return;
      }

      API.patch('/admin/users/' + id + '/status', { status: next, reason: reason })
        .then(function (data) {
          modal.close();
          UI.toast(data.message || 'Status diperbarui.', 'success');
          load();
        })
        .catch(function (err) {
          errorHost.innerHTML =
            '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
        });
    });
  }

  function openDetail(id) {
    var modal = UI.openModal({
      title: 'Detail pengguna',
      body: '<div class="skeleton skeleton-text" style="width:70%"></div><div class="skeleton skeleton-text"></div>',
    });

    API.get('/admin/users/' + id)
      .then(function (data) {
        var u = data.user;
        var store = u.storeId || {};
        modal.element.querySelector('.modal-body').innerHTML =
          '<div class="flex mb-4"><span class="avatar avatar-lg">' +
          UI.escapeHtml((u.name || '?').charAt(0).toUpperCase()) + '</span>' +
          '<div><strong>' + UI.escapeHtml(u.name) + '</strong>' +
          '<div class="tiny muted">' + UI.escapeHtml(u.role === 'superadmin' ? 'Super admin' : 'Penjual') + '</div></div></div>' +
          '<div class="table-wrap"><table class="table"><tbody>' +
          '<tr><th>WhatsApp</th><td>' + UI.escapeHtml(u.whatsapp) + '</td></tr>' +
          '<tr><th>Email</th><td>' + UI.escapeHtml(u.email || '-') + '</td></tr>' +
          '<tr><th>Toko</th><td>' + UI.escapeHtml(store.name || '-') + '</td></tr>' +
          '<tr><th>Status toko</th><td>' + UI.escapeHtml(store.status || '-') + '</td></tr>' +
          '<tr><th>Alasan status</th><td>' + UI.escapeHtml(u.statusReason || '-') + '</td></tr>' +
          '<tr><th>Produk</th><td>' + UI.formatNumber(data.stats.productCount) + '</td></tr>' +
          '<tr><th>Pesanan</th><td>' + UI.formatNumber(data.stats.orderCount) + '</td></tr>' +
          '<tr><th>Transaksi</th><td>' + UI.formatNumber(data.stats.transactionCount) + '</td></tr>' +
          '<tr><th>Bergabung</th><td>' + UI.formatDate(u.createdAt) + '</td></tr>' +
          '<tr><th>Login terakhir</th><td>' + UI.formatDateTime(u.lastLoginAt) + '</td></tr>' +
          '</tbody></table></div>' +
          '<div class="alert alert-info mt-4"><span>Password, hash password, dan token sesi tidak pernah ditampilkan di sini.</span></div>';
      })
      .catch(function (err) {
        modal.element.querySelector('.modal-body').innerHTML = UI.errorState(err.message);
      });
  }

  function load() {
    host.innerHTML = UI.skeletonGrid(3, 'stack');

    API.get('/admin/users', {
      q: document.getElementById('q').value.trim(),
      role: document.getElementById('filter-role').value,
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
    document.getElementById('filter-role').addEventListener('change', load);
    document.getElementById('filter-status').addEventListener('change', load);
    load();
  }

  Admin.init('pengguna').then(function (session) {
    if (session) init();
  });
})();
