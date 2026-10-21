/**
 * Helper grafik ringan.
 *
 * Memuat Chart.js dari CDN secara lazy (hanya saat halaman grafik dibuka)
 * supaya halaman lain tetap ringan untuk perangkat spesifikasi rendah.
 * Chart.js yang dipakai: https://www.chartjs.org
 */
(function () {
  'use strict';

  var scriptPromise = null;

  function loadChartJs() {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      script.async = true;
      script.onload = function () { resolve(window.Chart); };
      script.onerror = function () {
        scriptPromise = null;
        reject(new Error('Gagal memuat library grafik. Periksa koneksi internetmu.'));
      };
      document.head.appendChild(script);
    });

    return scriptPromise;
  }

  /** Palet warna yang konsisten dengan tema aplikasi. */
  var COLORS = {
    primary: '#16A34A',
    primaryDark: '#166534',
    primaryLight: 'rgba(22, 163, 74, 0.18)',
    danger: '#DC2626',
    dangerLight: 'rgba(220, 38, 38, 0.15)',
    muted: '#6B7280',
    grid: '#E5E7EB',
    text: '#1F2937',
  };

  function baseOptions(extra) {
    var options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: COLORS.text, boxWidth: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ': Rp' + Number(ctx.parsed.y || 0).toLocaleString('id-ID');
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: COLORS.muted, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.grid },
          ticks: {
            color: COLORS.muted,
            font: { size: 11 },
            callback: function (value) {
              return 'Rp' + Number(value).toLocaleString('id-ID');
            },
          },
        },
      },
    };

    if (extra) {
      Object.keys(extra).forEach(function (key) {
        options[key] = Object.assign({}, options[key] || {}, extra[key]);
      });
    }
    return options;
  }

  window.Charts = {
    load: loadChartJs,
    COLORS: COLORS,
    baseOptions: baseOptions,
  };
})();
