/**
 * Membuat SVG sprite berisi ikon Lucide yang dipakai aplikasi.
 *
 * Jalankan: npm run icons
 *
 * Hasil: public/assets/icons/sprite.svg
 * Pakai di HTML: <svg class="icon"><use href="/assets/icons/sprite.svg#shopping-bag"></use></svg>
 *
 * Ikon diambil dari paket "lucide-static" sehingga tidak ada permintaan ke CDN
 * (aplikasi tetap jalan tanpa internet).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const iconsDir = path.join(root, 'node_modules', 'lucide-static', 'icons');
const outDir = path.join(root, 'public', 'assets', 'icons');
const outFile = path.join(outDir, 'sprite.svg');

/** Daftar ikon yang dipakai di seluruh aplikasi. */
const ICONS = [
  // navigasi & umum
  'search', 'shopping-bag', 'store', 'layout-dashboard', 'user', 'users', 'log-out', 'menu', 'x',
  'chevron-down', 'chevron-right', 'chevron-left', 'arrow-right', 'arrow-left', 'settings',
  'package', 'tag', 'trash-2', 'edit-3', 'plus', 'check', 'check-circle', 'x-circle',
  'alert-circle', 'alert-triangle', 'info', 'loader', 'image', 'upload', 'eye', 'eye-off',
  'lock', 'mail', 'phone', 'message-circle', 'star', 'heart', 'home', 'clipboard-list',
  'wallet', 'trending-up', 'trending-down', 'bar-chart-3', 'pie-chart', 'filter', 'sort-desc',
  'refresh-cw', 'external-link', 'map-pin', 'shield', 'shield-check', 'ban', 'flag',
  'file-text', 'download', 'calendar', 'clock', 'more-vertical', 'shopping-cart',
  'layers', 'badge-check', 'percent', 'minus', 'credit-card', 'link', 'copy',
  // kategori
  'utensils', 'shirt', 'smartphone', 'book-open', 'wrench', 'palette', 'gift', 'music',
  // dashboard
  'truck', 'package-check', 'package-x', 'circle-dollar-sign', 'receipt', 'file-check-2',
  'file-x-2', 'user-check', 'user-x', 'scale', 'key-round', 'globe',
];

function extractInner(svg) {
  // Buang komentar lisensi di awal file
  const withoutComments = svg.replace(/<!--[\s\S]*?-->/g, '').trim();
  const start = withoutComments.indexOf('>');
  const end = withoutComments.lastIndexOf('</svg>');
  if (start === -1 || end === -1) return '';
  return withoutComments
    .slice(start + 1, end)
    .replace(/\s+/g, ' ')
    .trim();
}

async function build() {
  if (!existsSync(iconsDir)) {
    console.error('Paket lucide-static belum terinstall. Jalankan: npm install');
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const symbols = [];
  const missing = [];

  for (const name of ICONS) {
    const file = path.join(iconsDir, `${name}.svg`);
    // eslint-disable-next-line no-await-in-loop
    if (!existsSync(file)) {
      missing.push(name);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const raw = await readFile(file, 'utf8');
    const inner = extractInner(raw);
    symbols.push(
      `  <symbol id="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${inner}\n  </symbol>`
    );
  }

  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbols.join('\n')}
</svg>
`;

  await writeFile(outFile, sprite, 'utf8');

  console.log(`✅ Sprite ikon dibuat: ${symbols.length} ikon -> public/assets/icons/sprite.svg`);
  if (missing.length) {
    console.log(`⚠️  Ikon tidak ditemukan di lucide-static: ${missing.join(', ')}`);
  }
}

build().catch((err) => {
  console.error('Gagal membuat sprite ikon:', err);
  process.exit(1);
});
