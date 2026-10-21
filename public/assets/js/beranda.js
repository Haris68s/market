/**
 * Halaman beranda: mengambil data ringkasan dari /api/products/featured.
 */
(function () {
  'use strict';

  function renderHeroStats(data) {
    var totalProduk = (data.newest || []).length + (data.popular || []).length;
    var host = document.getElementById('hero-stats');
    if (!host) return;
    host.innerHTML = [
      { value: totalProduk + '+', label: 'Produk dari teman sekolah' },
      { value: (data.featuredStores || []).length + '', label: 'Toko aktif' },
      { value: (data.categories || []).length + '', label: 'Kategori' },
    ]
      .map(function (s) {
        return '<div class="hero-stat"><strong>' + UI.escapeHtml(s.value) + '</strong><span>' + UI.escapeHtml(s.label) + '</span></div>';
      })
      .join('');
  }

  function renderCategories(categories) {
    var host = document.getElementById('kategori-grid');
    if (!categories || !categories.length) {
      host.innerHTML = UI.emptyState('Belum ada kategori', 'Kategori akan ditambahkan admin.', 'layers');
      return;
    }
    host.innerHTML = categories
      .map(function (c) {
        return (
          '<a class="category-card" href="/katalog.html?category=' + encodeURIComponent(c.slug) + '">' +
          '<span class="category-icon">' + UI.icon(c.icon || 'package') + '</span>' +
          '<span>' + UI.escapeHtml(c.name) + '</span>' +
          '</a>'
        );
      })
      .join('');
  }

  function renderProductSection(hostId, items, emptyTitle, emptyMessage, iconName) {
    var host = document.getElementById(hostId);
    if (!host) return;
    if (!items || !items.length) {
      host.innerHTML = UI.emptyState(emptyTitle, emptyMessage, iconName);
      return;
    }
    host.innerHTML = '<div class="product-grid">' + items.map(UI.productCardHTML).join('') + '</div>';
  }

  function renderStores(stores) {
    var host = document.getElementById('toko-grid');
    if (!host) return;
    if (!stores || !stores.length) {
      host.innerHTML = UI.emptyState('Belum ada toko pilihan', 'Toko akan tampil di sini setelah produknya tersedia.', 'store');
      return;
    }
    host.innerHTML = stores.map(UI.storeCardHTML).join('');
  }

  function load() {
    var kategori = document.getElementById('kategori-grid');
    var terbaru = document.getElementById('terbaru-grid');
    var terlaris = document.getElementById('terlaris-grid');
    var rating = document.getElementById('rating-grid');
    var toko = document.getElementById('toko-grid');

    kategori.innerHTML = UI.skeletonGrid(8, 'grid grid-4');
    terbaru.innerHTML = UI.skeletonGrid(4);
    terlaris.innerHTML = UI.skeletonGrid(4);
    rating.innerHTML = UI.skeletonGrid(4);

    API.get('/products/featured')
      .then(function (data) {
        renderHeroStats(data);
        renderCategories(data.categories);
        renderProductSection(
          'terbaru-grid',
          data.newest,
          'Belum ada produk',
          'Jadilah yang pertama membuka toko di sekolahmu.',
          'package'
        );
        renderProductSection(
          'terlaris-grid',
          data.popular,
          'Belum ada produk terlaris',
          'Produk terlaris muncul setelah ada pesanan yang selesai.',
          'trending-up'
        );

        // Rating tertinggi butuh jumlah ulasan minimum. Bila belum cukup,
        // tampilkan produk terbaru sebagai alternatif (tanpa mengarang angka).
        if (data.meta && data.meta.note) {
          document.getElementById('rating-note').textContent = data.meta.note;
          renderProductSection('rating-grid', data.topRatedFallback, 'Belum ada rating', data.meta.note, 'star');
        } else {
          renderProductSection('rating-grid', data.topRated, 'Belum ada rating', 'Belum ada ulasan yang cukup.', 'star');
        }

        renderStores(data.featuredStores);
      })
      .catch(function (err) {
        [kategori, terbaru, terlaris, rating, toko].forEach(function (el) {
          el.innerHTML = UI.errorState(err.message, 'retry-beranda');
        });
        var retry = document.createElement('button');
        retry.id = 'retry-beranda';
        retry.className = 'hidden';
        retry.addEventListener('click', load);
        document.querySelector('main').appendChild(retry);
      });
  }

  UI.initLayout('beranda').then(load);
})();
