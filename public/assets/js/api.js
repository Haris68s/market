/**
 * API Client — pembungkus fetch().
 *
 * Tanggung jawab:
 * - Menambahkan token CSRF untuk request yang mengubah data.
 * - Menyeragamkan bentuk error jadi Error dengan .message & .details.
 * - Mengarahkan pengguna ke halaman masuk bila session habis.
 *
 * Tidak ada kredensial di sini: cookie session HttpOnly yang dikirim browser.
 */
(function () {
  'use strict';

  var csrfToken = null;

  function storeToken(token) {
    csrfToken = token || null;
  }

  function buildQuery(params) {
    if (!params) return '';
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function ApiError(message, status, code, details) {
    this.name = 'ApiError';
    this.message = message || 'Terjadi kesalahan.';
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
  ApiError.prototype = Object.create(Error.prototype);

  /**
   * Ambil token CSRF dari server (dipanggil sekali per halaman).
   */
  function ensureCsrf() {
    if (csrfToken) return Promise.resolve(csrfToken);
    return fetch('/api/csrf', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (body) {
        csrfToken = body && body.data ? body.data.csrfToken : null;
        return csrfToken;
      })
      .catch(function () { return null; });
  }

  function request(method, path, body, options) {
    options = options || {};
    var isWrite = method !== 'GET' && method !== 'HEAD';

    var run = function () {
      var headers = { Accept: 'application/json' };
      var init = { method: method, credentials: 'same-origin', headers: headers };

      if (body !== undefined && body !== null) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      if (isWrite && csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      return fetch('/api' + path, init).then(function (res) {
        return res
          .json()
          .catch(function () { return { success: false, error: { message: 'Respons server tidak valid.' } }; })
          .then(function (payload) {
            // Simpan token CSRF baru kalau server mengirimkannya
            // (mis. setelah login yang membuat session baru).
            if (payload && payload.data && payload.data.csrfToken) {
              csrfToken = payload.data.csrfToken;
            }

            if (res.ok && payload && payload.success) {
              return payload.data !== undefined ? payload.data : payload;
            }

            var err = (payload && payload.error) || {};
            var apiError = new ApiError(
              err.message || 'Terjadi kesalahan pada server.',
              res.status,
              err.code,
              err.details
            );

            // Session habis -> arahkan ke halaman masuk.
            if (res.status === 401 && !options.silent401) {
              var next = encodeURIComponent(window.location.pathname + window.location.search);
              window.location.href = '/masuk.html?next=' + next;
            }

            throw apiError;
          });
      });
    };

    return isWrite && !csrfToken ? ensureCsrf().then(run) : run();
  }

  window.API = {
    get: function (path, params, options) {
      return request('GET', path + buildQuery(params), null, options);
    },
    post: function (path, body, options) {
      return request('POST', path, body || {}, options);
    },
    patch: function (path, body, options) {
      return request('PATCH', path, body || {}, options);
    },
    del: function (path, options) {
      return request('DELETE', path, null, options);
    },
    ensureCsrf: ensureCsrf,
    storeToken: storeToken,
    /** Ambil token CSRF saat ini (dipakai untuk upload multipart/form-data). */
    getCsrfToken: function () {
      return csrfToken || ensureCsrf();
    },
    ApiError: ApiError,
  };
})();
