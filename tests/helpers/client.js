/**
 * Helper pengujian: klien HTTP dengan session & CSRF otomatis.
 *
 * Setiap klien = satu "browser" (cookie session terpisah).
 */
'use strict';

const request = require('supertest');

/**
 * @param {object} app instance Express
 */
function createClient(app) {
  const agent = request.agent(app);
  let csrfToken = null;

  const client = {
    agent,

    /** Ambil token CSRF (wajib untuk POST/PATCH/DELETE). */
    async refreshCsrf() {
      const res = await agent.get('/api/csrf');
      csrfToken = res.body && res.body.data ? res.body.data.csrfToken : null;
      return csrfToken;
    },

    /** Login dan siapkan token CSRF sekaligus. */
    async login(whatsapp, password) {
      await client.refreshCsrf();
      const res = await client.post('/api/auth/login', { whatsapp, password });
      await client.refreshCsrf();
      return res;
    },

    get(url) {
      return agent.get(url);
    },

    /** Ambil token CSRF saat ini (untuk request manual). */
    getCsrfToken() {
      return csrfToken;
    },

    post(url, body) {
      return agent.post(url).set('X-CSRF-Token', csrfToken).send(body);
    },

    patch(url, body) {
      return agent.patch(url).set('X-CSRF-Token', csrfToken).send(body);
    },

    del(url) {
      return agent.delete(url).set('X-CSRF-Token', csrfToken);
    },
  };

  return client;
}

module.exports = { createClient };
