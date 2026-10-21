/**
 * Dashboard penjual - manajemen produk.
 */
(function () {
  'use strict';

  var host = document.getElementById('daftar-produk');
  var topHost = document.getElementById('terlaris-produk');
  var categories = [];

  var STATUS_LABEL = {
    draft: 'Draft',
    active: 'Aktif',
    out_of_stock: 'Habis',
    hidden: 'Disembunyikan',
  };

  function statusBadge(status) {
    var cls =
      status === 'active' ? 'badge' :
      status === 'draft' ? 'badge badge-muted' :
      status === 'hidden' ? 'badge badge-danger' : 'badge badge-warning';
    return '<span class="' + cls + '">' + STATUS_LABEL[status] + '</span>';
  }

  function renderList(data) {
    var items = data.items || [];
    document.getElementById('jumlah-produk').textContent = UI.formatNumber(data.pagination.total) + ' produk';

    if (!items.length) {
      host.innerHTML = UI.emptyState('Belum ada produk', 'Tambahkan produk pertamamu agar pembeli bisa melihatnya.', 'package',
        '<button class="btn btn-primary" id="empty-tambah">Tambah produk</button>');
      var btn = document.getElementById('empty-tambah');
      if (btn) btn.addEventListener('click', function () { openForm(); });
      return;
    }

    host.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Produk</th><th>Kategori</th><th class="num">Harga</th><th class="num">Stok</th>' +
      '<th class="num">Terjual</th><th>Status</th><th></th></tr></thead><tbody>' +
      items
        .map(function (p) {
          var image = p.images && p.images[0]
            ? '<img src="' + UI.escapeHtml(p.images[0].url) + '" alt="" style="width:44px;height:34px;object-fit:cover;border-radius:6px" loading="lazy">'
            : '<span class="avatar" style="width:44px;height:34px;border-radius:6px">' + UI.icon('image', 'icon-sm') + '</span>';

          return '<tr>' +
            '<td><div class="flex">' + image +
            '<div><strong>' + UI.escapeHtml(p.name) + '</strong>' +
            '<div class="tiny muted">/' + UI.escapeHtml(p.slug) + '</div></div></div></td>' +
            '<td class="small">' + UI.escapeHtml(p.category) + '</td>' +
            '<td class="num price">' + UI.formatRupiah(p.price) + '</td>' +
            '<td class="num">' + p.stock + '</td>' +
            '<td class="num">' + UI.formatNumber(p.soldCount) + '</td>' +
            '<td>' + statusBadge(p.status) + '</td>' +
            '<td class="text-right" style="white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + p._id + '" aria-label="Ubah produk">' + UI.icon('edit-3', 'icon icon-sm') + '</button> ' +
            '<button class="btn btn-ghost btn-sm" data-hapus="' + p._id + '" aria-label="Hapus produk" style="color:var(--danger)">' + UI.icon('trash-2', 'icon icon-sm') + '</button>' +
            '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';

    host.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = items.filter(function (p) { return p._id === btn.dataset.edit; })[0];
        openForm(item);
      });
    });

    host.querySelectorAll('[data-hapus]').forEach(function (btn) {
      btn.addEventListener('click', function () { confirmDelete(btn.dataset.hapus); });
    });
  }

  function renderTop(products) {
    if (!products || !products.length) {
      topHost.innerHTML = '<p class="muted mb-0">Belum ada data penjualan produk.</p>';
      return;
    }
    topHost.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Produk</th><th class="num">Harga</th><th class="num">Pesanan</th><th class="num">Terjual</th>' +
      '</tr></thead><tbody>' +
      products
        .map(function (p) {
          return '<tr><td>' + UI.escapeHtml(p.name) + '</td>' +
            '<td class="num price">' + UI.formatRupiah(p.price) + '</td>' +
            '<td class="num">' + UI.formatNumber(p.orderCount) + '</td>' +
            '<td class="num">' + UI.formatNumber(p.soldCount) + '</td></tr>';
        })
        .join('') +
      '</tbody></table></div>';
  }

  function confirmDelete(id) {
    UI.confirmDialog({
      title: 'Hapus produk?',
      message: 'Produk akan dihapus dari tokomu. Kalau produk ini punya riwayat pesanan, produk hanya disembunyikan agar data pesanan tetap utuh.',
      confirmText: 'Ya, hapus',
    }).then(function (ok) {
      if (!ok) return;
      API.del('/seller/products/' + id)
        .then(function (data) {
          UI.toast(data.message || 'Produk dihapus.', 'success');
          load();
        })
        .catch(function (err) { UI.toast(err.message, 'error'); });
    });
  }

  function productFormHTML(product) {
    var p = product || {};
    var options = categories
      .map(function (c) {
        return '<option value="' + UI.escapeHtml(c.slug) + '"' + (p.category === c.slug ? ' selected' : '') + '>' +
          UI.escapeHtml(c.name) + '</option>';
      })
      .join('');

    var statusOptions = Object.keys(STATUS_LABEL)
      .map(function (key) {
        return '<option value="' + key + '"' + ((p.status || 'draft') === key ? ' selected' : '') + '>' +
          STATUS_LABEL[key] + '</option>';
      })
      .join('');

    return (
      '<div id="form-error"></div>' +
      '<div class="field"><label class="label" for="f-name">Nama produk <span class="req">*</span></label>' +
      '<input class="input" id="f-name" value="' + UI.escapeHtml(p.name || '') + '" placeholder="Contoh: Kopi Susu Aren">' +
      '<p class="error-text" data-error-for="name"></p></div>' +
      '<div class="form-row">' +
      '<div class="field"><label class="label" for="f-category">Kategori <span class="req">*</span></label>' +
      '<select class="select" id="f-category">' + options + '</select>' +
      '<p class="error-text" data-error-for="category"></p></div>' +
      '<div class="field"><label class="label" for="f-price">Harga (Rp) <span class="req">*</span></label>' +
      '<input class="input" type="number" id="f-price" min="0" step="100" value="' + (p.price || '') + '" placeholder="10000">' +
      '<p class="error-text" data-error-for="price"></p></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="field"><label class="label" for="f-stock">Stok <span class="req">*</span></label>' +
      '<input class="input" type="number" id="f-stock" min="0" step="1" value="' + (p.stock === undefined ? 0 : p.stock) + '">' +
      '<p class="error-text" data-error-for="stock"></p></div>' +
      '<div class="field"><label class="label" for="f-status">Status</label>' +
      '<select class="select" id="f-status">' + statusOptions + '</select>' +
      '<p class="hint">Draft = belum tampil di katalog. Aktif = tampil dan bisa dipesan.</p></div>' +
      '</div>' +
      '<div class="field"><label class="label" for="f-description">Deskripsi</label>' +
      '<textarea class="textarea" id="f-description" placeholder="Jelaskan produkmu: bahan, ukuran, varian, pengiriman.">' +
      UI.escapeHtml(p.description || '') + '</textarea></div>' +
      (product
        ? '<div class="field"><label class="label">Foto produk</label><div id="foto-list" class="flex flex-wrap"></div>' +
          '<input class="input mt-2" type="file" id="f-foto" accept="image/jpeg,image/png,image/webp">' +
          '<p class="hint">JPG/PNG/WebP, maksimal 4 MB. Pratinjau muncul setelah dipilih.</p>' +
          '<div id="foto-preview" class="mt-2"></div></div>'
        : '<div class="field"><label class="label">Foto produk</label>' +
          '<input class="input" type="file" id="f-foto" accept="image/jpeg,image/png,image/webp">' +
          '<p class="hint">JPG/PNG/WebP, maksimal 4 MB. Boleh diunggah setelah produk disimpan.</p>' +
          '<div id="foto-preview" class="mt-2"></div></div>')
    );
  }

  function openForm(product) {
    var isEdit = Boolean(product);

    var modal = UI.openModal({
      title: isEdit ? 'Ubah Produk' : 'Tambah Produk',
      body: productFormHTML(product),
      footer:
        '<button class="btn btn-ghost" data-close>Batal</button>' +
        '<button class="btn btn-primary" id="simpan-produk">' + (isEdit ? 'Simpan perubahan' : 'Simpan produk') + '</button>',
    });

    var errorHost = modal.element.querySelector('#form-error');

    function showError(message) {
      errorHost.innerHTML =
        '<div class="alert alert-error mb-4">' + UI.icon('alert-circle', 'icon icon-sm') +
        '<span>' + UI.escapeHtml(message) + '</span></div>';
    }

    // Pratinjau gambar sebelum disimpan
    var fileInput = modal.element.querySelector('#f-foto');
    var preview = modal.element.querySelector('#foto-preview');
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        preview.innerHTML = '';
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          showError('Ukuran file maksimal 4 MB.');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML = '<img src="' + e.target.result + '" alt="Pratinjau" style="max-width:160px;border-radius:8px;border:1px solid var(--border)">';
        };
        reader.readAsDataURL(file);
      });
    }

    // Daftar foto produk lama
    if (isEdit && product.images && product.images.length) {
      var fotoList = modal.element.querySelector('#foto-list');
      if (fotoList) {
        fotoList.innerHTML = product.images
          .map(function (img) {
            return '<span style="position:relative;display:inline-block">' +
              '<img src="' + UI.escapeHtml(img.url) + '" alt="" style="width:74px;height:58px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">' +
              '<button type="button" class="btn btn-danger btn-icon" data-hapus-foto="' + img._id +
              '" style="position:absolute;top:-6px;right:-6px;width:24px;min-height:24px;height:24px;border-radius:50%;padding:0" aria-label="Hapus foto">' +
              UI.icon('x', 'icon icon-sm') + '</button></span>';
          })
          .join('');

        fotoList.querySelectorAll('[data-hapus-foto]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            API.del('/seller/products/' + product._id + '/images/' + btn.dataset.hapusFoto)
              .then(function () {
                UI.toast('Gambar dihapus.', 'success');
                modal.close();
                load();
              })
              .catch(function (err) { UI.toast(err.message, 'error'); });
          });
        });
      }
    }

    modal.element.querySelector('#simpan-produk').addEventListener('click', function () {
      var payload = {
        name: modal.element.querySelector('#f-name').value.trim(),
        category: modal.element.querySelector('#f-category').value,
        price: parseInt(modal.element.querySelector('#f-price').value, 10),
        stock: parseInt(modal.element.querySelector('#f-stock').value, 10),
        status: modal.element.querySelector('#f-status').value,
        description: modal.element.querySelector('#f-description').value.trim(),
      };

      if (!payload.name || !payload.category) {
        showError('Nama produk dan kategori wajib diisi.');
        return;
      }
      if (isNaN(payload.price) || payload.price < 0) {
        showError('Harga harus berupa angka dan tidak boleh negatif.');
        return;
      }
      if (isNaN(payload.stock) || payload.stock < 0) {
        showError('Stok harus berupa angka dan tidak boleh negatif.');
        return;
      }

      var request = isEdit
        ? API.patch('/seller/products/' + product._id, payload)
        : API.post('/seller/products', payload);

      request
        .then(function (data) {
          var productId = data.product._id;

          // Upload foto bila dipilih (setelah produk tersimpan)
          var file = fileInput && fileInput.files[0];
          if (file) {
            return uploadImage(productId, file).then(function () {
              return data;
            });
          }
          return data;
        })
        .then(function () {
          modal.close();
          UI.toast(isEdit ? 'Produk diperbarui.' : 'Produk berhasil ditambahkan.', 'success');
          load();
        })
        .catch(function (err) {
          showError(err.message);
        });
    });
  }

  function uploadImage(productId, file) {
    var formData = new FormData();
    formData.append('image', file);

    return API.getCsrfToken().then(function (token) {
      return fetch('/api/seller/products/' + productId + '/images', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': token || '' },
        body: formData,
      });
    })
      .then(function (res) { return res.json(); })
      .then(function (payload) {
        if (!payload.success) {
          throw new Error((payload.error && payload.error.message) || 'Gagal mengunggah gambar.');
        }
        return payload.data;
      });
  }

  function load() {
    host.innerHTML = UI.skeletonGrid(3, 'stack');

    API.get('/seller/products', {
      q: document.getElementById('q').value.trim(),
      category: document.getElementById('filter-kategori').value,
      status: document.getElementById('filter-status').value,
      limit: 50,
    })
      .then(function (data) {
        renderList(data);
        renderTop(data.topProducts);
      })
      .catch(function (err) {
        host.innerHTML = UI.errorState(err.message);
      });
  }

  function loadCategories() {
    API.get('/categories')
      .then(function (data) {
        categories = data.items || [];
        var select = document.getElementById('filter-kategori');
        categories.forEach(function (c) {
          var option = document.createElement('option');
          option.value = c.slug;
          option.textContent = c.name;
          select.appendChild(option);
        });
      })
      .catch(function () { /* tidak kritis */ });
  }

  function init() {
    document.getElementById('btn-tambah').addEventListener('click', function () { openForm(); });
    document.getElementById('q').addEventListener('input', debounce(load, 350));
    document.getElementById('filter-kategori').addEventListener('change', load);
    document.getElementById('filter-status').addEventListener('change', load);

    loadCategories();
    load();
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  Dashboard.init('produk').then(function (session) {
    if (!session) return;
    init();
  });
})();
