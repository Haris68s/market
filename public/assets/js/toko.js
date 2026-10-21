/**
 * Halaman profil toko publik.
 */
(function () {
  'use strict';

  var host = document.getElementById('toko-detail');
  var state = { slug: '', page: 1, sort: 'newest' };

  function renderStore(store) {
    var waLink = 'https://wa.me/' + store.whatsapp;
    var waMessage = encodeURIComponent(
      'Halo ' + store.name + ', saya melihat toko Anda di KantinSiswa. Boleh tanya-tanya produknya?'
    );

    return (
      '<div class="store-hero">' +
      '<div class="store-profile-head">' +
      '<span class="avatar avatar-xl">' + UI.escapeHtml(store.name.charAt(0).toUpperCase()) + '</span>' +
      '<div style="flex:1 1 240px">' +
      '<h1 style="margin-bottom:4px">' + UI.escapeHtml(store.name) + '</h1>' +
      '<p class="muted small mb-3">' + UI.escapeHtml(store.category || '') +
      (store.location && store.location.city ? ' &middot; ' + UI.escapeHtml(store.location.city) : '') + '</p>' +
      '<div class="flex flex-wrap">' +
      UI.stars(store.ratingAvg, store.ratingCount) +
      '<a class="btn btn-whatsapp" href="' + waLink + '?text=' + waMessage + '" target="_blank" rel="noopener">' +
      UI.icon('message-circle') + ' Hubungi lewat WhatsApp</a>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="store-meta">' +
      '<div><span>Jumlah produk</span><strong>' + UI.formatNumber(store.productCount) + '</strong></div>' +
      '<div><span>Rating rata-rata</span><strong>' + (Number(store.ratingAvg || 0).toFixed(1).replace('.0', '') || '0') + '</strong></div>' +
      '<div><span>Jumlah ulasan</span><strong>' + UI.formatNumber(store.ratingCount) + '</strong></div>' +
      '<div><span>Terjual (tercatat)</span><strong>' + UI.formatNumber(store.totalSold) + '</strong></div>' +
      '</div>' +
      (store.location && store.location.address
        ? '<div class="flex mt-3 small muted"><span>' + UI.icon('map-pin', 'icon-sm') + '</span>' +
          '<span>Kelas / Lokasi: ' + UI.escapeHtml(store.location.address) + '</span></div>'
        : '') +
      '</div>'
    );
  }

  function render(data) {
    var store = data.store;
    var products = data.products || [];

    var html = renderStore(store);

    if (data.bestSeller) {
      html +=
        '<div class="card card-body-sm mb-4" style="border-color:var(--primary);background:var(--primary-lighter)">' +
        '<div class="flex">' + UI.icon('trending-up') +
        '<div><strong>Produk terlaris toko ini</strong><div class="small">' +
        UI.escapeHtml(data.bestSeller.name) + ' &middot; ' + UI.formatRupiah(data.bestSeller.price) +
        ' &middot; ' + UI.formatNumber(data.bestSeller.soldCount) + ' terjual</div></div>' +
        '<a class="btn btn-outline btn-sm" style="margin-left:auto" href="/produk.html?slug=' +
        encodeURIComponent(data.bestSeller.slug) + '">Lihat</a>' +
        '</div></div>';
    }

    html += '<div class="section-head"><div><h2>Produk Toko</h2>' +
      '<p class="mb-0">' + UI.formatNumber(data.pagination.total) + ' produk tersedia</p></div>' +
      '<div class="flex"><label class="label mb-0" for="sort-toko">Urutkan</label>' +
      '<select class="select" id="sort-toko" style="width:auto">' +
      '<option value="newest">Terbaru</option><option value="popular">Terlaris</option>' +
      '</select></div></div>';

    if (!products.length) {
      html += UI.emptyState('Belum ada produk', 'Toko ini belum mempublikasikan produk.', 'package');
    } else {
      html += '<div class="product-grid">' + products.map(UI.productCardHTML).join('') + '</div>';
      if (data.pagination.totalPages > 1) {
        html += '<div class="pagination" id="pagination-toko"></div>';
      }
    }

    host.innerHTML = html;

    document.getElementById('breadcrumb').innerHTML =
      '<a href="/">Beranda</a>' + UI.icon('chevron-right', 'icon') + '<span>' + UI.escapeHtml(store.name) + '</span>';

    var sortSelect = document.getElementById('sort-toko');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        state.sort = sortSelect.value;
        load();
      });
    }

    var pagination = document.getElementById('pagination-toko');
    if (pagination) {
      var p = data.pagination;
      var buttons = '';
      for (var i = 1; i <= p.totalPages; i += 1) {
        buttons += '<button type="button" data-page="' + i + '"' + (i === p.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
      }
      pagination.innerHTML = buttons;
      pagination.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.page = parseInt(btn.dataset.page, 10);
          load();
        });
      });
    }
  }

  function load() {
    API.get('/stores/' + encodeURIComponent(state.slug), { page: state.page, sort: state.sort })
      .then(render)
      .catch(function (err) {
        host.innerHTML = UI.errorState(err.message);
      });
  }

  function init() {
    state.slug = new URLSearchParams(window.location.search).get('slug');
    if (!state.slug) {
      host.innerHTML = UI.emptyState('Toko tidak ditemukan', 'Link toko tidak lengkap.', 'store',
        '<a class="btn btn-primary" href="/katalog.html">Lihat katalog</a>');
      return;
    }
    load();
  }

  UI.initLayout('katalog').then(init);
})();
