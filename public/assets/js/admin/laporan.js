/**
 * Panel admin - laporan penyalahgunaan & moderasi ulasan.
 */
(function () {
  'use strict';

  var laporanHost = document.getElementById('daftar-laporan');
  var ulasanHost = document.getElementById('daftar-ulasan');

  function renderReports(data) {
    var items = data.items || [];

    if (!items.length) {
      laporanHost.innerHTML = UI.emptyState('Tidak ada laporan', 'Semua laporan sudah ditangani.', 'flag');
      return;
    }

    laporanHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Target</th><th>Alasan</th><th>Pelapor</th><th>Status</th><th>Tanggal</th><th></th></tr></thead><tbody>' +
      items
        .map(function (r) {
          var cls =
            r.status === 'open' ? 'badge badge-warning' :
            r.status === 'resolved' ? 'badge' : 'badge badge-muted';
          return '<tr>' +
            '<td class="small"><strong>' + UI.escapeHtml(r.targetType) + '</strong>' +
            '<div class="tiny muted">' + UI.escapeHtml(String(r.targetId).slice(-8)) + '</div></td>' +
            '<td class="small">' + UI.escapeHtml(r.reason) +
            (r.description ? '<div class="tiny muted">' + UI.escapeHtml(r.description) + '</div>' : '') + '</td>' +
            '<td class="small">' + UI.escapeHtml(r.reporterContact || '-') + '</td>' +
            '<td><span class="' + cls + '">' + UI.escapeHtml(r.status) + '</span></td>' +
            '<td class="small">' + UI.formatDate(r.createdAt) + '</td>' +
            '<td class="text-right">' +
            (r.status === 'open'
              ? '<button class="btn btn-outline btn-sm" data-tangani="' + r._id + '">Tangani</button>'
              : '<span class="tiny muted">' + UI.escapeHtml(r.resolutionNote || '-') + '</span>') +
            '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    laporanHost.querySelectorAll('[data-tangani]').forEach(function (btn) {
      btn.addEventListener('click', function () { openReportForm(btn.dataset.tangani); });
    });
  }

  function openReportForm(id) {
    var modal = UI.openModal({
      title: 'Tangani laporan',
      body:
        '<div id="laporan-error"></div>' +
        '<div class="field"><label class="label" for="status">Status laporan</label>' +
        '<select class="select" id="status">' +
        '<option value="reviewed">Ditinjau</option>' +
        '<option value="resolved">Selesai (tindakan sudah dilakukan)</option>' +
        '<option value="rejected">Ditolak (tidak melanggar aturan)</option>' +
        '</select></div>' +
        '<div class="field"><label class="label" for="catatan">Catatan_resolution</label>' +
        '<textarea class="textarea" id="catatan" placeholder="Contoh: Ulasan disembunyikan karena mengandung kata kasar."></textarea></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn btn-primary" id="simpan-laporan">Simpan</button>',
    });

    modal.element.querySelector('#simpan-laporan').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#laporan-error');
      var payload = {
        status: modal.element.querySelector('#status').value,
        resolutionNote: modal.element.querySelector('#catatan').value.trim(),
      };

      API.patch('/admin/reports/' + id, payload)
        .then(function (data) {
          modal.close();
          UI.toast(data.message || 'Laporan diperbarui.', 'success');
          loadReports();
        })
        .catch(function (err) {
          errorHost.innerHTML =
            '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
        });
    });
  }

  function renderReviews(data) {
    var items = data.items || [];

    if (!items.length) {
      ulasanHost.innerHTML = UI.emptyState('Tidak ada ulasan', 'Belum ada ulasan masuk.', 'star');
      return;
    }

    ulasanHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Ulasan</th><th>Produk</th><th>Status</th><th>Tanggal</th><th></th></tr></thead><tbody>' +
      items
        .map(function (r) {
          var product = r.productId || {};
          return '<tr>' +
            '<td style="max-width:340px"><div class="flex">' + UI.stars(r.rating) + '</div>' +
            '<div class="small mt-2">' + UI.escapeHtml(r.comment) + '</div>' +
            '<div class="tiny muted">' + UI.escapeHtml(r.buyerId && r.buyerId.name ? r.buyerId.name : 'Pembeli') + '</div></td>' +
            '<td class="small">' + UI.escapeHtml(product.name || '-') + '</td>' +
            '<td><span class="badge ' + (r.status === 'published' ? '' : 'badge-danger') + '">' +
            (r.status === 'published' ? 'Tampil' : 'Disembunyikan') + '</span>' +
            (r.moderation && r.moderation.reason ? '<div class="tiny muted">' + UI.escapeHtml(r.moderation.reason) + '</div>' : '') + '</td>' +
            '<td class="small">' + UI.formatDate(r.createdAt) + '</td>' +
            '<td class="text-right">' +
            (r.status === 'published'
              ? '<button class="btn btn-danger btn-sm" data-sembunyi="' + r._id + '">Sembunyikan</button>'
              : '<button class="btn btn-outline btn-sm" data-tampilkan="' + r._id + '">Tampilkan</button>') +
            '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    ulasanHost.querySelectorAll('[data-sembunyi]').forEach(function (btn) {
      btn.addEventListener('click', function () { moderate(btn.dataset.sembunyi, 'hide'); });
    });
    ulasanHost.querySelectorAll('[data-tampilkan]').forEach(function (btn) {
      btn.addEventListener('click', function () { moderate(btn.dataset.tampilkan, 'restore'); });
    });
  }

  function moderate(id, action) {
    var isHide = action === 'hide';

    var modal = UI.openModal({
      title: isHide ? 'Sembunyikan ulasan?' : 'Tampilkan ulasan kembali?',
      body:
        '<p class="muted small">Alasan wajib diisi dan dicatat pada log aktivitas.</p>' +
        '<div id="ulasan-error"></div>' +
        '<div class="field"><label class="label" for="alasan">Alasan <span class="req">*</span></label>' +
        '<textarea class="textarea" id="alasan" placeholder="' +
        (isHide ? 'Contoh: Mengandung kata kasar dan menyinggung orang lain.' : 'Contoh: Sudah diverifikasi, ulasan tidak melanggar aturan.') +
        '"></textarea></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn ' + (isHide ? 'btn-danger' : 'btn-primary') + '" id="simpan-ulasan">Simpan</button>',
    });

    modal.element.querySelector('#simpan-ulasan').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#ulasan-error');
      var reason = modal.element.querySelector('#alasan').value.trim();

      if (reason.length < 5) {
        errorHost.innerHTML =
          '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
          '<span>Alasan wajib diisi minimal 5 karakter.</span></div>';
        return;
      }

      API.patch('/admin/reviews/' + id, { action: action, reason: reason })
        .then(function (data) {
          modal.close();
          UI.toast(data.message || 'Ulasan diperbarui.', 'success');
          loadReviews();
        })
        .catch(function (err) {
          errorHost.innerHTML =
            '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
        });
    });
  }

  function loadReports() {
    API.get('/admin/reports', {
      status: document.getElementById('filter-status-laporan').value,
      limit: 50,
    })
      .then(renderReports)
      .catch(function (err) { laporanHost.innerHTML = UI.errorState(err.message); });
  }

  function loadReviews() {
    API.get('/admin/reviews', {
      status: document.getElementById('filter-status-ulasan').value,
      limit: 50,
    })
      .then(renderReviews)
      .catch(function (err) { ulasanHost.innerHTML = UI.errorState(err.message); });
  }

  function init() {
    document.getElementById('filter-status-laporan').addEventListener('change', loadReports);
    document.getElementById('filter-status-ulasan').addEventListener('change', loadReviews);
    loadReports();
    loadReviews();
  }

  Admin.init('laporan').then(function (session) {
    if (session) init();
  });
})();
