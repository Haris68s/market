/**
 * Halaman katalog: pencarian, filter, urutan, dan pagination.
 *
 * Semua parameter dikirim ke backend, dan backend yang memvalidasinya.
 */
(function () {
  'use strict';

  var state = {
    q: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    page: 1,
    limit: 12,
  };

  var grid = document.getElementById('produk-grid');
  var pagination = document.getElementById('pagination');
  var filters = document.getElementById('active-filters');
  var resultCount = document.getElementById('result-count');
  var resultMeta = document.getElementById('result-meta');

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('minPrice')) state.minPrice = params.get('minPrice');
    if (params.get('maxPrice')) state.maxPrice = params.get('maxPrice');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('page')) state.page = parseInt(params.get('page'), 10) || 1;
  }

  function writeUrl() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category) params.set('category', state.category);
    if (state.minPrice) params.set('minPrice', state.minPrice);
    if (state.maxPrice) params.set('maxPrice', state.maxPrice);
    if (state.sort !== 'newest') params.set('sort', state.sort);
    if (state.page > 1) params.set('page', state.page);
    var qs = params.toString();
    window.history.replaceState({}, '', qs ? '?' + qs : window.location.pathname);
  }

  function loadCategories() {
    return API.get('/categories')
      .then(function (data) {
        var host = document.getElementById('filter-kategori');
        var items = data.items || [];
        host.innerHTML =
          '<li><button type="button" data-category="">Semua kategori</button></li>' +
          items
            .map(function (c) {
              return '<li><button type="button" data-category="' + UI.escapeHtml(c.slug) + '">' +
                UI.escapeHtml(c.name) + '</button></li>';
            })
            .join('');

        host.querySelectorAll('button').forEach(function (btn) {
          btn.addEventListener('click', function () {
            state.category = btn.dataset.category;
            state.page = 1;
            host.querySelectorAll('button').forEach(function (b) {
              b.classList.toggle('active', b === btn);
            });
            load();
          });
        });

        markActiveCategory();
      })
      .catch(function () {
        /* kategori bukan hal kritis, tetap biarkan katalog berjalan */
      });
  }

  function markActiveCategory() {
    var host = document.getElementById('filter-kategori');
    host.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', (b.dataset.category || '') === state.category);
    });
  }

  function markActiveSort() {
    document.getElementById('filter-sort').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.sort === state.sort);
    });
  }

  function renderActiveFilters() {
    var chips = [];
    if (state.q) chips.push({ key: 'q', label: 'Kata kunci: "' + state.q + '"' });
    if (state.category) chips.push({ key: 'category', label: 'Kategori: ' + state.category });
    if (state.minPrice) chips.push({ key: 'minPrice', label: 'Min ' + UI.formatRupiah(state.minPrice) });
    if (state.maxPrice) chips.push({ key: 'maxPrice', label: 'Maks ' + UI.formatRupiah(state.maxPrice) });

    if (!chips.length) {
      filters.innerHTML = '';
      return;
    }

    filters.innerHTML = chips
      .map(function (c) {
        return '<span class="active-filter">' + UI.escapeHtml(c.label) +
          '<button type="button" data-clear="' + c.key + '" aria-label="Hapus filter">' +
          UI.icon('x', 'icon-sm') + '</button></span>';
      })
      .join('');

    filters.querySelectorAll('[data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.clear;
        state[key] = key === 'minPrice' || key === 'maxPrice' ? '' : '';
        if (key === 'minPrice') document.getElementById('filter-min').value = '';
        if (key === 'maxPrice') document.getElementById('filter-max').value = '';
        if (key === 'category') markActiveCategory();
        state.page = 1;
        load();
      });
    });
  }

  function renderPagination(p) {
    if (!p || p.totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    var html = '<button type="button" data-page="' + (p.page - 1) + '"' + (p.hasPrev ? '' : ' disabled') + ' aria-label="Halaman sebelumnya">' +
      UI.icon('chevron-left', 'icon-sm') + '</button>';

    var start = Math.max(1, p.page - 2);
    var end = Math.min(p.totalPages, start + 4);
    start = Math.max(1, end - 4);

    for (var i = start; i <= end; i += 1) {
      html += '<button type="button" data-page="' + i + '"' + (i === p.page ? ' aria-current="page"' : '') + '>' + i + '</button>';
    }

    html += '<button type="button" data-page="' + (p.page + 1) + '"' + (p.hasNext ? '' : ' disabled') + ' aria-label="Halaman berikutnya">' +
      UI.icon('chevron-right', 'icon-sm') + '</button>';

    pagination.innerHTML = html;
    pagination.querySelectorAll('button[data-page]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.page = parseInt(btn.dataset.page, 10);
        load();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function load() {
    grid.innerHTML = UI.skeletonGrid(6);
    pagination.innerHTML = '';
    writeUrl();
    renderActiveFilters();

    API.get('/products', {
      q: state.q,
      category: state.category,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      sort: state.sort,
      page: state.page,
      limit: state.limit,
    })
      .then(function (data) {
        var items = data.items || [];
        var p = data.pagination || {};

        resultCount.textContent = items.length
          ? 'Menampilkan ' + items.length + ' dari ' + UI.formatNumber(p.total) + ' produk'
          : 'Tidak ada produk yang cocok';

        resultMeta.textContent = p.totalPages > 1 ? 'Halaman ' + p.page + ' dari ' + p.totalPages : '';

        if (!items.length) {
          grid.innerHTML = UI.emptyState(
            'Produk tidak ditemukan',
            'Coba kata kunci lain, atau atur ulang filter kategori dan harga.',
            'search',
            '<button class="btn btn-outline" id="reset-kosong">Atur ulang filter</button>'
          );
          var resetBtn = document.getElementById('reset-kosong');
          if (resetBtn) resetBtn.addEventListener('click', resetFilters);
          pagination.innerHTML = '';
          return;
        }

        grid.innerHTML = '<div class="product-grid">' + items.map(UI.productCardHTML).join('') + '</div>';
        renderPagination(p);
      })
      .catch(function (err) {
        grid.innerHTML = UI.errorState(err.message);
      });
  }

  function resetFilters() {
    state.q = '';
    state.category = '';
    state.minPrice = '';
    state.maxPrice = '';
    state.sort = 'newest';
    state.page = 1;
    document.getElementById('filter-min').value = '';
    document.getElementById('filter-max').value = '';
    var navInput = document.getElementById('nav-search-input');
    if (navInput) navInput.value = '';
    markActiveCategory();
    markActiveSort();
    load();
  }

  function init() {
    readUrl();
    markActiveSort();
    document.getElementById('filter-min').value = state.minPrice;
    document.getElementById('filter-max').value = state.maxPrice;

    document.getElementById('filter-sort').querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.sort = btn.dataset.sort;
        state.page = 1;
        markActiveSort();
        load();
      });
    });

    document.getElementById('filter-harga-terapkan').addEventListener('click', function () {
      var min = document.getElementById('filter-min').value;
      var max = document.getElementById('filter-max').value;
      if (min && max && parseInt(min, 10) > parseInt(max, 10)) {
        UI.toast('Harga minimum tidak boleh lebih besar dari harga maksimum.', 'error');
        return;
      }
      state.minPrice = min;
      state.maxPrice = max;
      state.page = 1;
      load();
    });

    document.getElementById('filter-reset').addEventListener('click', resetFilters);

    var navInput = document.getElementById('nav-search-input');
    if (navInput && state.q) navInput.value = state.q;

    loadCategories();
    load();
  }

  UI.initLayout('katalog').then(init);
})();
