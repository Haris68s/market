/**
 * Panel admin - manajemen kategori.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-kategori');

  var ICONS = [
    'package', 'utensils', 'shirt', 'smartphone', 'book-open', 'wrench', 'palette', 'gift',
    'music', 'layers', 'shopping-bag', 'file-text', 'scissors', 'dumbbell', 'globe', 'home',
  ];

  function render(data) {
    var items = data.items || [];

    if (!items.length) {
      host.innerHTML = UI.emptyState('Belum ada kategori', 'Tambahkan kategori agar penjual bisa memilihnya.', 'layers');
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Kategori</th><th>Slug</th><th class="num">Urutan</th><th>Status</th><th></th></tr></thead><tbody>' +
      items
        .map(function (c) {
          return '<tr>' +
            '<td><div class="flex"><span class="category-icon" style="width:36px;height:36px">' +
            UI.icon(c.icon || 'package', 'icon-sm') + '</span><strong>' + UI.escapeHtml(c.name) + '</strong></div>' +
            '<div class="tiny muted">' + UI.escapeHtml(c.description || '') + '</div></td>' +
            '<td class="small muted">' + UI.escapeHtml(c.slug) + '</td>' +
            '<td class="num">' + c.order + '</td>' +
            '<td><span class="badge ' + (c.isActive ? '' : 'badge-muted') + '">' +
            (c.isActive ? 'Aktif' : 'Nonaktif') + '</span></td>' +
            '<td class="text-right" style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + c._id + '">' + UI.icon('edit-3', 'icon icon-sm') + '</button> ' +
            '<button class="btn btn-ghost btn-sm" data-hapus="' + c._id + '" style="color:var(--danger)">' +
            UI.icon('trash-2', 'icon icon-sm') + '</button></td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    host.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = items.filter(function (c) { return c._id === btn.dataset.edit; })[0];
        openForm(item);
      });
    });

    host.querySelectorAll('[data-hapus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        UI.confirmDialog({
          title: 'Hapus kategori?',
          message: 'Kategori yang masih dipakai produk tidak bisa dihapus. Nonaktifkan saja bila masih diperlukan.',
          confirmText: 'Ya, hapus',
        }).then(function (ok) {
          if (!ok) return;
          API.del('/admin/categories/' + btn.dataset.hapus)
            .then(function (data) {
              UI.toast(data.message || 'Kategori dihapus.', 'success');
              load();
            })
            .catch(function (err) { UI.toast(err.message, 'error'); });
        });
      });
    });
  }

  function openForm(category) {
    var isEdit = Boolean(category);
    var c = category || {};

    var iconOptions = ICONS.map(function (name) {
      return '<option value="' + name + '"' + (c.icon === name ? ' selected' : '') + '>' + name + '</option>';
    }).join('');

    var modal = UI.openModal({
      title: isEdit ? 'Ubah Kategori' : 'Tambah Kategori',
      body:
        '<div id="kategori-error"></div>' +
        '<div class="field"><label class="label" for="k-name">Nama kategori <span class="req">*</span></label>' +
        '<input class="input" id="k-name" value="' + UI.escapeHtml(c.name || '') + '"></div>' +
        '<div class="form-row">' +
        '<div class="field"><label class="label" for="k-icon">Ikon</label>' +
        '<select class="select" id="k-icon">' + iconOptions + '</select></div>' +
        '<div class="field"><label class="label" for="k-order">Urutan tampil</label>' +
        '<input class="input" type="number" id="k-order" min="0" value="' + (c.order || 0) + '"></div>' +
        '</div>' +
        '<div class="field"><label class="label" for="k-desc">Deskripsi</label>' +
        '<input class="input" id="k-desc" value="' + UI.escapeHtml(c.description || '') + '"></div>' +
        '<div class="field"><label class="checkbox">' +
        '<input type="checkbox" id="k-aktif"' + (c.isActive !== false ? ' checked' : '') + '>' +
        '<span>Aktifkan kategori ini</span></label></div>',
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn btn-primary" id="simpan-kategori">Simpan</button>',
    });

    modal.element.querySelector('#simpan-kategori').addEventListener('click', function () {
      var errorHost = modal.element.querySelector('#kategori-error');
      var payload = {
        name: modal.element.querySelector('#k-name').value.trim(),
        icon: modal.element.querySelector('#k-icon').value,
        order: parseInt(modal.element.querySelector('#k-order').value, 10) || 0,
        description: modal.element.querySelector('#k-desc').value.trim(),
        isActive: modal.element.querySelector('#k-aktif').checked,
      };

      if (!payload.name) {
        errorHost.innerHTML =
          '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
          '<span>Nama kategori wajib diisi.</span></div>';
        return;
      }

      var request = isEdit
        ? API.patch('/admin/categories/' + c._id, payload)
        : API.post('/admin/categories', payload);

      request
        .then(function (data) {
          modal.close();
          UI.toast(data.message || 'Kategori disimpan.', 'success');
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

    API.get('/admin/categories')
      .then(render)
      .catch(function (err) { host.innerHTML = UI.errorState(err.message); });
  }

  function init() {
    document.getElementById('btn-tambah-kategori').addEventListener('click', function () { openForm(); });
    load();
  }

  Admin.init('kategori').then(function (session) {
    if (session) init();
  });
})();
