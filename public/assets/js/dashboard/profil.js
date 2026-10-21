/**
 * Dashboard penjual - edit profil toko & ganti password.
 */
(function () {
  'use strict';

  var form = document.getElementById('form-profil');
  var passwordForm = document.getElementById('form-password');
  var errorHost = document.getElementById('profil-error');

  function showError(message) {
    errorHost.innerHTML =
      '<div class="alert alert-error mb-4">' + UI.icon('alert-circle', 'icon-sm') +
      '<span>' + UI.escapeHtml(message) + '</span></div>';
  }

  function fillForm(store) {
    form.name.value = store.name || '';
    form.category.value = store.category || '';
    form.whatsapp.value = store.whatsapp || '';
    form.description.value = store.description || '';
    form.city.value = (store.location && store.location.city) || '';
    form.address.value = (store.location && store.location.address) || '';
    form.showAddress.checked = Boolean(store.location && store.location.showAddress);
    form.showExactAddress.checked = Boolean(store.location && store.location.showExactAddress);

    var link = document.getElementById('lihat-publik');
    if (link && store.slug) link.href = '/toko.html?slug=' + encodeURIComponent(store.slug);
  }

  function renderRating(data) {
    var rating = data.rating || {};
    document.getElementById('rating-toko').innerHTML =
      '<div class="flex">' +
      '<div style="font-size:2.4rem;font-weight:800;line-height:1">' +
      (Number(rating.average || 0).toFixed(1).replace('.0', '') || '0') + '</div>' +
      '<div>' + UI.stars(rating.average) +
      '<div class="tiny muted">' + UI.formatNumber(rating.count) + ' ulasan terbit</div></div>' +
      '</div>';
  }

  function loadCategories() {
    API.get('/categories')
      .then(function (data) {
        var select = form.category;
        (data.items || []).forEach(function (c) {
          var option = document.createElement('option');
          option.value = c.slug;
          option.textContent = c.name;
          select.appendChild(option);
        });
      })
      .catch(function () { /* tidak kritis */ });
  }

  function init() {
    loadCategories();

    API.get('/seller/profile')
      .then(function (data) {
        fillForm(data.store);
        renderRating(data);
      })
      .catch(function (err) { showError(err.message); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorHost.innerHTML = '';

      var payload = {
        name: form.name.value.trim(),
        category: form.category.value,
        whatsapp: form.whatsapp.value.trim(),
        description: form.description.value.trim(),
        location: {
          city: form.city.value.trim(),
          address: form.address.value.trim(),
          showAddress: form.showAddress.checked,
          showExactAddress: form.showExactAddress.checked,
        },
      };

      if (!payload.name) {
        showError('Nama toko wajib diisi.');
        return;
      }

      API.patch('/seller/profile', payload)
        .then(function (data) {
          UI.toast(data.message || 'Profil toko diperbarui.', 'success');
          fillForm(data.store);
        })
        .catch(function (err) {
          showError(err.message);
        });
    });

    passwordForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var payload = {
        currentPassword: passwordForm.currentPassword.value,
        newPassword: passwordForm.newPassword.value,
        newPasswordConfirm: passwordForm.newPasswordConfirm.value,
      };

      API.patch('/auth/password', payload)
        .then(function (data) {
          UI.toast(data.message || 'Password berhasil diubah.', 'success');
          passwordForm.reset();
        })
        .catch(function (err) {
          UI.toast(err.message, 'error');
        });
    });
  }

  Dashboard.init('profil').then(function (session) {
    if (session) init();
  });
})();
