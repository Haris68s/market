/**
 * Halaman lupa password & reset password.
 */
(function () {
  'use strict';

  function clearErrors(form) {
    form.querySelectorAll('.field').forEach(function (f) { f.classList.remove('invalid'); });
    form.querySelectorAll('.error-text').forEach(function (e) { e.textContent = ''; });
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

  function initRequest() {
    var form = document.getElementById('form-reset-request');
    if (!form) return;

    var button = document.getElementById('btn-kirim');
    var original = button.innerHTML;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);

      var box = document.getElementById('reset-request-result');
      box.innerHTML = '';
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span> Mengirim...';

      API.post('/auth/request-reset', { whatsapp: form.whatsapp.value.trim() })
        .then(function (data) {
          button.disabled = false;
          button.innerHTML = original;
          box.innerHTML =
            '<div class="alert alert-success mb-4">' + UI.icon('check-circle', 'icon-sm') +
            '<span>' + UI.escapeHtml(data.message) + '</span></div>';
          form.classList.add('hidden');
        })
        .catch(function (err) {
          button.disabled = false;
          button.innerHTML = original;
          box.innerHTML =
            '<div class="alert alert-error mb-4">' + UI.icon('alert-circle', 'icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
          if (err.details) showErrors(form, err.details);
        });
    });
  }

  function initReset() {
    var form = document.getElementById('form-reset');
    if (!form) return;

    var button = document.getElementById('btn-reset');
    var original = button.innerHTML;

    // Isi kode reset dari URL bila ada (?token=...)
    var tokenFromUrl = new URLSearchParams(window.location.search).get('token');
    if (tokenFromUrl) form.token.value = tokenFromUrl;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);

      var box = document.getElementById('reset-result');
      box.innerHTML = '';
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span> Menyimpan...';

      API.post('/auth/reset-password', {
        token: form.token.value.trim(),
        newPassword: form.newPassword.value,
        newPasswordConfirm: form.newPasswordConfirm.value,
      })
        .then(function (data) {
          button.disabled = false;
          button.innerHTML = original;
          box.innerHTML =
            '<div class="alert alert-success mb-4">' + UI.icon('check-circle', 'icon-sm') +
            '<span>' + UI.escapeHtml(data.message) + '</span></div>';
          form.classList.add('hidden');
          setTimeout(function () { window.location.href = '/masuk.html'; }, 1500);
        })
        .catch(function (err) {
          button.disabled = false;
          button.innerHTML = original;
          box.innerHTML =
            '<div class="alert alert-error mb-4">' + UI.icon('alert-circle', 'icon-sm') +
            '<span>' + UI.escapeHtml(err.message) + '</span></div>';
          if (err.details) showErrors(form, err.details);
        });
    });
  }

  initRequest();
  initReset();
})();
