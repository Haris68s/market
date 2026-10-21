/**
 * Halaman detail produk: galeri, informasi toko, pemesanan WhatsApp, ulasan.
 */
(function () {
  'use strict';

  var host = document.getElementById('produk-detail');
  var state = { product: null, store: null, qty: 1 };

  function starsRow(rating, count) {
    return (
      '<div class="flex small">' +
      UI.stars(rating) +
      '<span class="muted">' + UI.formatNumber(count) + ' ulasan</span>' +
      '</div>'
    );
  }

  function renderGallery(images, name) {
    if (!images || !images.length) {
      return '<div class="gallery-main"><div class="placeholder" style="display:grid;place-items:center;height:100%;color:#cbd5e1">' +
        UI.icon('image', 'icon icon-xl') + '</div></div>';
    }
    var main = images[0];
    var html = '<div class="gallery-main"><img id="gallery-main-img" src="' + UI.escapeHtml(main.url) + '" alt="' +
      UI.escapeHtml(name) + '"></div>';

    if (images.length > 1) {
      html += '<div class="gallery-thumbs">' +
        images
          .map(function (img, i) {
            return '<button type="button" data-img="' + UI.escapeHtml(img.url) + '"' + (i === 0 ? ' class="active"' : '') +
              ' aria-label="Lihat gambar ' + (i + 1) + '"><img src="' + UI.escapeHtml(img.url) + '" alt="" loading="lazy"></button>';
          })
          .join('') +
        '</div>';
    }
    return html;
  }

  function renderReviews(data) {
    var reviews = data.reviews || [];
    var breakdown = data.ratingBreakdown || {};
    var total = Object.keys(breakdown).reduce(function (sum, k) { return sum + breakdown[k]; }, 0);

    var html = '<section class="card mt-6"><div class="card-head"><h2>Ulasan Pembeli</h2>' +
      '<span class="muted small">' + UI.formatNumber(total) + ' ulasan</span></div><div class="card-body">';

    if (!reviews.length) {
      html += '<p class="muted">Belum ada ulasan untuk produk ini. Ulasan muncul setelah pembeli menyelesaikan pesanan.</p>';
    } else {
      if (total > 0) {
        html += '<div class="grid grid-2" style="gap:var(--space-6);align-items:center;margin-bottom:var(--space-4)">' +
          '<div class="text-center">' +
          '<div style="font-size:2.6rem;font-weight:800;line-height:1">' +
          (Number(data.product.ratingAvg || 0).toFixed(1).replace('.0', '')) + '</div>' +
          '<div class="mt-2">' + UI.stars(data.product.ratingAvg) + '</div>' +
          '<div class="tiny muted mt-2">' + UI.formatNumber(data.product.ratingCount) + ' ulasan</div>' +
          '</div>' +
          '<div class="rating-bars">';
        for (var star = 5; star >= 1; star -= 1) {
          var count = breakdown[star] || 0;
          var pct = total ? Math.round((count / total) * 100) : 0;
          html += '<div class="rating-bar"><span>' + star + ' bintang</span>' +
            '<span class="bar"><span style="width:' + pct + '%"></span></span>' +
            '<span>' + count + '</span></div>';
        }
        html += '</div></div>';
      }

      reviews.forEach(function (r) {
        html += '<article class="review-item">' +
          '<div class="review-head">' +
          '<span class="avatar">' + UI.escapeHtml((r.buyerId && r.buyerId.name ? r.buyerId.name : '?').charAt(0).toUpperCase()) + '</span>' +
          '<div><strong>' + UI.escapeHtml(r.buyerId && r.buyerId.name ? r.buyerId.name : 'Pembeli') + '</strong>' +
          '<div class="tiny muted">' + UI.formatRelative(r.createdAt) + '</div></div>' +
          UI.stars(r.rating) +
          (r.isVerifiedPurchase
            ? '<span class="badge badge-info">Terverifikasi</span>'
            : '<span class="badge badge-outline" title="Transaksi dilakukan lewat WhatsApp sehingga tidak dapat diverifikasi otomatis">Belum terverifikasi</span>') +
          '</div>' +
          '<p class="mb-0">' + UI.escapeHtml(r.comment) + '</p>' +
          '</article>';
      });
    }

    html += '</div></section>';
    return html;
  }

  function renderRelated(related) {
    if (!related || !related.length) return '';
    return '<section class="mt-6"><div class="section-head"><div><h2>Produk Terkait</h2>' +
      '<p>Produk lain dengan kategori yang sama.</p></div></div>' +
      '<div class="product-grid">' + related.map(UI.productCardHTML).join('') + '</div></section>';
  }

  function render(data) {
    var product = data.product;
    var store = data.store;
    state.product = product;
    state.store = store;
    state.reviewOrderId = data.reviewableOrderId;

    var stok = product.stock;
    var stokLabel;
    var stokBadge;
    if (stok <= 0) {
      stokLabel = 'Stok habis &mdash; hubungi penjual untuk ketersediaan';
      stokBadge = '<span class="badge badge-danger">Habis</span>';
    } else if (stok <= 5) {
      stokLabel = 'Tinggal ' + stok + ' lagi';
      stokBadge = '<span class="badge badge-warning">Sisa ' + stok + '</span>';
    } else {
      stokLabel = 'Stok tersedia (' + stok + ')';
      stokBadge = '<span class="badge">Tersedia</span>';
    }

    var waLink = 'https://wa.me/' + (store ? store.whatsapp : '');

    host.innerHTML =
      '<div class="product-detail">' +
      '<div>' +
      renderGallery(product.images, product.name) +
      renderRelated(data.related) +
      '</div>' +
      '<div>' +
      '<div class="flex flex-wrap mb-3">' + stokBadge +
      (product.category ? '<span class="badge badge-muted">' + UI.escapeHtml(product.category) + '</span>' : '') +
      '</div>' +
      '<h1>' + UI.escapeHtml(product.name) + '</h1>' +
      starsRow(product.ratingAvg || 0, product.ratingCount || 0) +
      '<div class="detail-price">' + UI.formatRupiah(product.price) + '</div>' +
      '<p class="muted small">' + stokLabel + '</p>' +
      '<hr style="border:none;border-top:1px solid var(--border);margin:var(--space-5) 0">' +
      '<div class="store-inline mb-4">' +
      '<span class="avatar avatar-lg">' + UI.escapeHtml((store ? store.name : '?').charAt(0).toUpperCase()) + '</span>' +
      '<div style="flex:1 1 auto;min-width:0">' +
      '<strong>' + UI.escapeHtml(store ? store.name : '-') + '</strong>' +
      '<div class="tiny muted">' + UI.escapeHtml(store ? store.category : '') +
      (store && store.location && store.location.city ? ' &middot; ' + UI.escapeHtml(store.location.city) : '') +
      '</div></div>' +
      (store ? '<a class="btn btn-outline btn-sm" href="/toko.html?slug=' + encodeURIComponent(store.slug) + '">Lihat toko</a>' : '') +
      '</div>' +
      '<div class="mb-4">' +
      '<label class="label" for="qty">Jumlah</label>' +
      '<div class="qty-control">' +
      '<button type="button" id="qty-minus" aria-label="Kurangi jumlah">&minus;</button>' +
      '<input type="number" id="qty" value="1" min="1" max="99" aria-label="Jumlah pesanan">' +
      '<button type="button" id="qty-plus" aria-label="Tambah jumlah">+</button>' +
      '</div>' +
      '<p class="hint">Total: <strong id="qty-total">' + UI.formatRupiah(product.price) + '</strong></p>' +
      '</div>' +
      '<div class="stack">' +
      '<button class="btn btn-whatsapp btn-lg btn-block" id="btn-wa">' +
      UI.icon('message-circle') + ' Pesan via WhatsApp</button>' +
      '<a class="btn btn-outline btn-block" href="' + UI.escapeHtml(waLink) + '" target="_blank" rel="noopener">' +
      UI.icon('phone') + ' Chat langsung ke penjual</a>' +
      '</div>' +
      '<div class="alert alert-info mt-4">' + UI.icon('info', 'icon icon-sm') +
      '<span>Membuka WhatsApp belum berarti pesanan terkonfirmasi atau pembayaran berhasil. ' +
      'Penjual akan mengonfirmasi lewat WhatsApp. Permintaan pesanan tetap tercatat di dashboard penjual.</span></div>' +
      (data.canReview ? '<button class="btn btn-primary btn-block mt-3" id="btn-ulasan">' + UI.icon('star') + ' Beri ulasan</button>' : '') +
      '<div class="mt-5">' +
      '<h3>Deskripsi</h3>' +
      '<p style="white-space:pre-wrap">' + UI.escapeHtml(product.description || 'Penjual belum menulis deskripsi.') + '</p>' +
      '</div>' +
      '</div>' +
      '</div>' +
      renderReviews(data);

    bindGallery();
    bindQuantity();
    bindOrder();
    bindReview();
    document.getElementById('breadcrumb').innerHTML =
      '<a href="/">Beranda</a>' + UI.icon('chevron-right', 'icon') +
      '<a href="/katalog.html?category=' + encodeURIComponent(product.category || '') + '">' +
      UI.escapeHtml(product.category || 'Produk') + '</a>' + UI.icon('chevron-right', 'icon') +
      '<span>' + UI.escapeHtml(product.name) + '</span>';
  }

  function bindGallery() {
    var thumbs = host.querySelectorAll('.gallery-thumbs button');
    var mainImg = document.getElementById('gallery-main-img');
    thumbs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        mainImg.src = btn.dataset.img;
        thumbs.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }

  function bindQuantity() {
    var input = document.getElementById('qty');
    var total = document.getElementById('qty-total');

    function update() {
      var qty = parseInt(input.value, 10) || 1;
      if (qty < 1) qty = 1;
      if (qty > 99) qty = 99;
      input.value = qty;
      state.qty = qty;
      total.textContent = UI.formatRupiah(state.product.price * qty);
    }

    document.getElementById('qty-minus').addEventListener('click', function () {
      input.value = (parseInt(input.value, 10) || 1) - 1;
      update();
    });
    document.getElementById('qty-plus').addEventListener('click', function () {
      input.value = (parseInt(input.value, 10) || 1) + 1;
      update();
    });
    input.addEventListener('change', update);
    update();
  }

  function bindOrder() {
    document.getElementById('btn-wa').addEventListener('click', function () {
      var button = this;
      button.disabled = true;

      API.post('/orders', {
        productId: state.product._id,
        qty: state.qty,
      })
        .then(function (data) {
          if (data.stockWarning) {
            UI.toast(data.stockWarning, 'warning', 6000);
          } else {
            UI.toast('Permintaan pesanan tercatat. Membuka WhatsApp...', 'success');
          }
          // Beri jeda agar pengguna sempat membaca pesan konfirmasi.
          setTimeout(function () {
            window.open(data.waLink, '_blank', 'noopener');
            button.disabled = false;
          }, 600);
        })
        .catch(function (err) {
          button.disabled = false;
          UI.toast(err.message, 'error', 6000);
        });
    });
  }

  function bindReview() {
    var btn = document.getElementById('btn-ulasan');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var options = [5, 4, 3, 2, 1]
        .map(function (n) {
          return '<label class="radio-row"><input type="radio" name="rating" value="' + n + '"' +
            (n === 5 ? ' checked' : '') + '> ' + n + ' bintang</label>';
        })
        .join('');

      var modal = UI.openModal({
        title: 'Beri ulasan',
        body:
          '<div class="field"><label class="label">Rating</label>' + options + '</div>' +
          '<div class="field"><label class="label" for="ulasan-komentar">Komentar</label>' +
          '<textarea class="textarea" id="ulasan-komentar" placeholder="Bagaimana produk ini? Minimal 5 karakter."></textarea>' +
          '<p class="hint">Ulasan akan ditandai "belum terverifikasi" karena konfirmasi pembayaran dilakukan lewat WhatsApp.</p></div>' +
          '<div id="ulasan-error"></div>',
        footer:
          '<button class="btn btn-ghost" data-close>Batal</button>' +
          '<button class="btn btn-primary" id="ulasan-simpan">Kirim ulasan</button>',
      });

      modal.element.querySelector('#ulasan-simpan').addEventListener('click', function () {
        var rating = parseInt(modal.element.querySelector('input[name="rating"]:checked').value, 10);
        var comment = modal.element.querySelector('#ulasan-komentar').value;
        var errorHost = modal.element.querySelector('#ulasan-error');

        API.post('/reviews', {
          productId: state.product._id,
          orderId: state.reviewOrderId || '',
          rating: rating,
          comment: comment,
        })
          .then(function () {
            modal.close();
            UI.toast('Terima kasih! Ulasan Anda tersimpan.', 'success');
            load();
          })
          .catch(function (err) {
            errorHost.innerHTML = '<div class="alert alert-error">' + UI.icon('alert-circle', 'icon icon-sm') +
              '<span>' + UI.escapeHtml(err.message) + '</span></div>';
          });
      });
    });
  }

  function load() {
    var slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) {
      host.innerHTML = UI.emptyState('Produk tidak ditemukan', 'Link produk tidak lengkap.', 'alert-triangle',
        '<a class="btn btn-primary" href="/katalog.html">Lihat katalog</a>');
      return;
    }

    API.get('/products/' + encodeURIComponent(slug))
      .then(render)
      .catch(function (err) {
        host.innerHTML = UI.errorState(err.message);
      });
  }

  UI.initLayout('katalog').then(load);
})();
