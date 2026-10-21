/**
 * Panel admin - pengaturan marketplace & reset password pengguna.
 */
(function () {
  'use strict';

  var form = document.getElementById('form-pengaturan');
  var errorHost = document.getElementById('pengaturan-error');

  function fillForm(settings) {
    form.querySelector('[name="app.name"]').value = settings['app.name'] || '';
    form.querySelector('[name="app.supportContact"]').value = settings['app.supportContact'] || '';
    form.querySelector('[name="app.heroTitle"]').value = settings['app.heroTitle'] || '';
    form.querySelector('[name="app.heroSubtitle"]').value = settings['app.heroSubtitle'] || '';
    form.querySelector('[name="app.featuredMinReviews"]').value = settings['app.featuredMinReviews'] || 3;
    form.querySelector('[name="app.featuredMinRating"]').value = settings['app.featuredMinRating'] || 4;
    form.querySelector('[name="app.allowRegistration"]').checked = settings['app.allowRegistration'] !== false;
  }

  function loadSystemInfo() {
    Promise.all([API.get('/uploads/status'), API.get('/health')])
      .then(function (results) {
        var upload = results[0];
        var health = results[1];
        document.getElementById('info-sistem').innerHTML =
          '<div class="table-wrap"><table class="table"><tbody>' +
          '<tr><th>Status server</th><td><span class="badge">' + UI.escapeHtml(health.data.status) + '</span></td></tr>' +
          '<tr><th>Database</th><td><span class="badge">' + UI.escapeHtml(health.data.database) + '</span></td></tr>' +
          '<tr><th>Penyimpanan gambar</th><td><span class="badge ' + (upload.data.ready ? '' : 'badge-warning') + '">' +
          UI.escapeHtml(upload.data.provider) + (upload.data.ready ? ' (siap)' : ' (belum siap)') + '</span></td></tr>' +
          '<tr><th>Uptime</th><td>' + UI.formatNumber(health.data.uptime) + ' detik</td></tr>' +
          '</tbody></table></div>';
      })
      .catch(function () {
        document.getElementById('info-sistem').innerHTML = '<p class="muted mb-0">Informasi sistem tidak tersedia.</p>';
      });
  }

  function searchUsers() {
    var q = document.getElementById('cari-pengguna').value.trim();
    var host = document.getElementById('hasil-cari');

    if (!q) {
      host.innerHTML = '<p class="muted small mb-0">Ketik nama atau nomor WhatsApp untuk mencari.</p>';
      return;
    }

    API.get('/admin/users', { q: q, limit: 5 })
      .then(function (data) {
        var items = data.items || [];
        if (!items.length) {
          host.innerHTML = '<p class="muted small mb-0">Pengguna tidak ditemukan.</p>';
          return;
        }
        host.innerHTML = items
          .map(function (u) {
            return '<div class="flex flex-between" style="padding:8px 0;border-bottom:1px solid var(--border)">' +
              '<div><strong class="small">' + UI.escapeHtml(u.name) + '</strong>' +
              '<div class="tiny muted">' + UI.escapeHtml(u.whatsapp) + '</div></div>' +
              (u.role === 'superadmin'
                ? '<span class="tiny muted">super admin</span>'
                : '<button class="btn btn-outline btn-sm" data-token="' + u._id + '">Buat kode reset</button>') +
              '</div>';
          })
          .join('');

        host.querySelectorAll('[data-token]').forEach(function (btn) {
          btn.addEventListener('click', function () { issueToken(btn.dataset.token); });
        });
      })
      .catch(function (err) {
        host.innerHTML = '<p class="muted small mb-0">' + UI.escapeHtml(err.message) + '</p>';
      });
  }

  function issueToken(userId) {
    API.post('/admin/users/' + userId + '/reset-token')
      .then(function (data) {
        UI.openModal({
          title: 'Kode reset password',
          body:
            '<div class="alert alert-warning"><span>Kode ini hanya tampil sekali. Segera kirim ke penjual lewat WhatsApp. ' +
            'Kode berlaku sampai ' + UI.formatDateTime(data.data.expiresAt) + '.</span></div>' +
            '<div class="text-center" style="font-size:1.6rem;font-weight:800;letter-spacing:2px;padding:var(--space-4);' +
            'background:var(--primary-lighter);border-radius:var(--radius);word-break:break-all" id="token-display">' +
            UI.escapeHtml(data.data.token) + '</div>' +
            '<p class="hint">Pengguna membuka halaman reset password dan memasukkan kode ini.</p>',
          footer: '<button class="btn btn-primary" data-close>Selesai</button>',
        });
      })
      .catch(function (err) { UI.toast(err.message, 'error'); });
  }

  function init() {
    API.get('/admin/settings')
      .then(function (data) { fillForm(data.settings); })
      .catch(function (err) { errorHost.innerHTML = UI.errorState(err.message); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorHost.innerHTML = '';

      var payload = {
        'app.name': form.querySelector('[name="app.name"]').value.trim(),
        'app.supportContact': form.querySelector('[name="app.supportContact"]').value.trim(),
        'app.heroTitle': form.querySelector('[name="app.heroTitle"]').value.trim(),
        'app.heroSubtitle': form.querySelector('[name="app.heroSubtitle"]').value.trim(),
        'app.featuredMinReviews': parseInt(form.querySelector('[name="app.featuredMinReviews"]').value, 10) || 0,
        'app.featuredMinRating': parseFloat(form.querySelector('[name="app.featuredMinRating"]').value) || 0,
        'app.allowRegistration': form.querySelector('[name="app.allowRegistration"]').checked,
      };

      API.patch('/admin/settings', payload)
        .then(function (data) {
          UI.toast(data.message || 'Pengaturan disimpan.', 'success');
          fillForm(data.settings);
        })
        .catch(function (err) {
          errorHost.innerHTML =
            '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
        });
    });

    document.getElementById('cari-pengguna').addEventListener('input', function () {
      clearTimeout(window.__cariTimer);
      window.__cariTimer = setTimeout(searchUsers, 350);
    });

    loadSystemInfo();
  }

  Admin.init('pengaturan').then(function (session) {
    if (session) init();
  });
})();
