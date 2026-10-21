/**
 * Panel admin - log aktivitas.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-log');

  function actionLabel(action) {
    var map = {
      'auth.register': 'Pendaftaran penjual',
      'auth.login': 'Login',
      'auth.logout': 'Logout',
      'auth.update_profile': 'Update profil',
      'auth.change_password': 'Ganti password',
      'auth.request_reset': 'Permintaan reset password',
      'auth.reset_password': 'Reset password',
      'order.create': 'Pesanan dibuat',
      'order.update_status': 'Status pesanan diubah',
      'order.record_income': 'Pemasukan pesanan dicatat',
      'product.create': 'Produk dibuat',
      'product.update': 'Produk diubah',
      'product.delete': 'Produk dihapus',
      'product.hide': 'Produk disembunyikan',
      'product.upload_image': 'Gambar produk diunggah',
      'product.delete_image': 'Gambar produk dihapus',
      'review.create': 'Ulasan dibuat',
      'report.create': 'Laporan dibuat',
      'transaction.create': 'Transaksi dicatat',
      'transaction.update': 'Transaksi diubah',
      'transaction.delete': 'Transaksi dihapus',
      'transaction.export': 'Transaksi diekspor',
      'store.update_profile': 'Profil toko diubah',
      'upload.image': 'Gambar diunggah',
      'admin.user_status': 'Status pengguna diubah',
      'admin.store_status': 'Status toko diubah',
      'admin.product_status': 'Status produk diubah',
      'admin.category_create': 'Kategori dibuat',
      'admin.category_update': 'Kategori diubah',
      'admin.category_delete': 'Kategori dihapus',
      'admin.review_moderation': 'Moderasi ulasan',
      'admin.report_resolved': 'Laporan ditangani',
      'admin.issue_reset_token': 'Token reset diterbitkan',
      'admin.update_settings': 'Pengaturan diubah',
    };
    return map[action] || action;
  }

  function render(data) {
    var items = data.items || [];
    document.getElementById('jumlah-log').textContent = UI.formatNumber(data.pagination.total) + ' aktivitas';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Belum ada aktivitas', 'Log akan terisi setelah ada aktivitas pengguna.', 'file-text');
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Waktu</th><th>Aktor</th><th>Aktivitas</th><th>Target</th><th>IP</th></tr></thead><tbody>' +
      items
        .map(function (log) {
          return '<tr>' +
            '<td class="small">' + UI.formatDateTime(log.createdAt) + '</td>' +
            '<td class="small">' + UI.escapeHtml(log.actorName || 'Tanpa nama') +
            '<div class="tiny muted">' + UI.escapeHtml(log.actorRole || 'visitor') + '</div></td>' +
            '<td class="small">' + UI.escapeHtml(actionLabel(log.action)) +
            '<div class="tiny muted">' + UI.escapeHtml(log.action) + '</div></td>' +
            '<td class="tiny muted">' + UI.escapeHtml(log.entityType || '-') +
            (log.entityId ? ' ' + UI.escapeHtml(String(log.entityId).slice(-8)) : '') + '</td>' +
            '<td class="tiny muted">' + UI.escapeHtml(log.ip || '-') + '</td>' +
            '</tr>';
        })
        .join('') +
      '</tbody></table></div>';
  }

  function load() {
    host.innerHTML = UI.skeletonGrid(3, 'stack');

    API.get('/admin/logs', { limit: 50 })
      .then(render)
      .catch(function (err) { host.innerHTML = UI.errorState(err.message); });
  }

  Admin.init('log').then(function (session) {
    if (session) load();
  });
})();
