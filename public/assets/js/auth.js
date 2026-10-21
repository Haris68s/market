/**
 * Halaman autentikasi: login (masuk.html) dan pendaftaran (daftar.html).
 * Satu berkas dipakai untuk keduanya karena polanya sama.
 */
(function () {
  'use strict';

  function clearErrors(form) {
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('invalid'); });
    form.querySelectorAll('.error-text').forEach(function (e) { e.textContent = ''; });
    var box = document.getElementById('login-error') || document.getElementById('register-error');
    if (box) box.innerHTML = '';
  }

  function showErrors(form, details) {
    (details || []).forEach(function (d) {
      var input = form.querySelector('[name="' + d.field + '"]');
      if (!input) return;
      var field = input.closest('.field');
      if (!field) return;
      field.classList.add('invalid');
      var msg = field.querySelector('.error-text');
      if (msg) msg.textContent = d.message;
    });
  }

  function showError(message) {
    var box = document.getElementById('login-error') || document.getElementById('register-error');
    if (!box) return;
    box.innerHTML =
      '<div class="alert alert-error mb-4">' + UI.icon('alert-circle', 'icon icon-sm') +
      '<span>' + UI.escapeHtml(message) + '</span></div>';
  }

  function setLoading(button, loading, text) {
    button.disabled = loading;
    button.innerHTML = loading
      ? '<span class="spinner"></span> ' + UI.escapeHtml(text)
      : button.dataset.originalHtml;
  }

  /* ------------------------------- Login ------------------------------- */
  function initLogin() {
    var form = document.getElementById('form-login');
    if (!form) return;

    var button = document.getElementById('btn-masuk');
    button.dataset.originalHtml = button.innerHTML;

    // Kalau sudah login, langsung ke dashboard.
    UI.getSession().then(function (session) {
      if (session.user) {
        window.location.href = session.user.role === 'superadmin' ? '/admin/index.html' : '/dashboard/index.html';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);

      var payload = {
        whatsapp: form.whatsapp.value.trim(),
        password: form.password.value,
      };

      if (!payload.whatsapp || !payload.password) {
        showError('Nomor WhatsApp dan password wajib diisi.');
        return;
      }

      setLoading(button, true, 'Memproses...');

      API.post('/auth/login', payload)
        .then(function (data) {
          if (data.csrfToken) API.storeToken(data.csrfToken);
          UI.toast(data.message || 'Berhasil masuk.', 'success');
          var next = new URLSearchParams(window.location.search).get('next');
          setTimeout(function () {
            window.location.href = next || (data.user.role === 'superadmin' ? '/admin/index.html' : '/dashboard/index.html');
          }, 400);
        })
        .catch(function (err) {
          setLoading(button, false);
          showError(err.message);
          if (err.details) showErrors(form, err.details);
        });
    });
  }

  /* ---------------------------- Pendaftaran ---------------------------- */
  function initRegister() {
    var form = document.getElementById('form-register');
    if (!form) return;

    var button = document.getElementById('btn-daftar');
    button.dataset.originalHtml = button.innerHTML;

    // Muat daftar kategori untuk dropdown.
    API.get('/categories')
      .then(function (data) {
        var select = document.getElementById('category');
        (data.items || []).forEach(function (c) {
          var option = document.createElement('option');
          option.value = c.slug;
          option.textContent = c.name;
          select.appendChild(option);
        });
      })
      .catch(function () {
        UI.toast('Daftar kategori gagal dimuat. Muat ulang halaman.', 'error');
      });

    UI.getSession().then(function (session) {
      if (session.user) {
        window.location.href = session.user.role === 'superadmin' ? '/admin/index.html' : '/dashboard/index.html';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);

      var payload = {
        name: form.name.value.trim(),
        storeName: form.storeName.value.trim(),
        whatsapp: form.whatsapp.value.trim(),
        password: form.password.value,
        passwordConfirm: form.passwordConfirm.value,
        category: form.category.value,
        description: form.description.value.trim(),
        city: form.city.value.trim(),
        address: form.address.value.trim(),
        agreed: form.agreed.checked,
      };

      if (!payload.agreed) {
        showError('Kamu harus menyetujui aturan marketplace terlebih dahulu.');
        return;
      }

      setLoading(button, true, 'Membuat toko...');

      API.post('/auth/register', payload)
        .then(function (data) {
          UI.toast(data.message || 'Akun berhasil dibuat.', 'success');
          setTimeout(function () { window.location.href = '/dashboard/index.html'; }, 600);
        })
        .catch(function (err) {
          setLoading(button, false);
          showError(err.message);
          if (err.details) showErrors(form, err.details);
        });
    });
  }

  initLogin();
  initRegister();
})();
