// Skrip sekali jalan: menarik isochrone (area jangkauan berkendara) untuk SEMUA SPPG
// dari OpenRouteService lalu menyimpannya sebagai berkas statis data/isochrone-600.geojson.
//
// Cara pakai (dari folder proyek):
//   node scripts/fetch-isochrones.mjs            -> 600 detik (10 menit), bisa dilanjutkan jika terputus
//   node scripts/fetch-isochrones.mjs --range 900
//
// Butuh berkas .env berisi:  ORS_API_KEY=...   (berkas .env tidak ikut ter-commit)

import fs from 'node:fs';

// ================= pengaturan: waktu tempuh, alamat API, dan jeda antar permintaan =================
const argv = process.argv.slice(2);
const argIdx = argv.indexOf('--range');
const RANGE_DETIK = argIdx >= 0 ? Number(argv[argIdx + 1]) : 600;
const OUT_FILE = `data/isochrone-${RANGE_DETIK}.geojson`;
const ORS_BASE = process.env.ORS_BASE || 'https://api.heigit.org/openrouteservice';
const PROFIL = 'driving-car';
// batas gratis ORS: 20 permintaan isochrone per menit -> 1 permintaan per 3,5 detik agar aman
const JEDA_MS = 3500;
const MAKS_ULANG = 3;

// ================= pembacaan API key dari .env (key tidak pernah dicetak ke layar) =================
function bacaEnv() {
  if (!fs.existsSync('.env')) return {};
  const out = {};
  for (const baris of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const i = baris.indexOf('=');
    if (i < 1 || baris.trim().startsWith('#')) continue;
    out[baris.slice(0, i).trim()] = baris.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}
const KEY = process.env.ORS_API_KEY || bacaEnv().ORS_API_KEY;
if (!KEY) {
  console.error('ORS_API_KEY tidak ditemukan. Isi berkas .env dengan baris ORS_API_KEY=...');
  process.exit(1);
}

// ================= pembacaan data SPPG dan hasil yang sudah ada (agar bisa dilanjutkan) =================
const sppg = JSON.parse(fs.readFileSync('data/SPPG.geojson', 'utf8')).features;
let hasil = { type: 'FeatureCollection', features: [] };
if (fs.existsSync(OUT_FILE)) {
  hasil = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  console.log(`Melanjutkan: ${hasil.features.length} isochrone sudah ada di ${OUT_FILE}`);
}
const sudah = new Set(hasil.features.map((f) => f.properties.sppg_idx));

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const simpan = () => {
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(hasil));
};

// ================= penarikan isochrone satu titik SPPG (dengan ulang otomatis jika kena batas) =================
async function tarik(lng, lat) {
  for (let percobaan = 1; percobaan <= MAKS_ULANG; percobaan++) {
    const res = await fetch(`${ORS_BASE}/v2/isochrones/${PROFIL}`, {
      method: 'POST',
      headers: { Authorization: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: [[lng, lat]], range: [RANGE_DETIK], range_type: 'time' }),
    });
    if (res.status === 429) {
      console.log('  kena batas per menit, menunggu 65 detik...');
      await tidur(65000);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.features || data.features.length === 0) throw new Error('respons tanpa poligon');
    return { feature: data.features[0], sisa: res.headers.get('x-ratelimit-remaining') };
  }
  throw new Error('gagal setelah beberapa kali ulang');
}

// ================= perulangan semua SPPG: tarik, beri atribut, simpan bertahap =================
const gagal = [];
let sisaKuota = '-';
for (let i = 0; i < sppg.length; i++) {
  if (sudah.has(i)) continue;
  const s = sppg[i];
  const [lng, lat] = s.geometry.coordinates;
  const nama = s.properties['Nama SPPG'] || `SPPG-${i}`;
  try {
    const { feature, sisa } = await tarik(lng, lat);
    sisaKuota = sisa ?? sisaKuota;
    hasil.features.push({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        sppg_idx: i,
        sppg_no: s.properties['No SPPG'] ?? null,
        sppg_nama: nama,
        waktu_detik: RANGE_DETIK,
      },
    });
    console.log(`[${hasil.features.length}/${sppg.length}] ${nama}  (sisa kuota header: ${sisaKuota})`);
    if (hasil.features.length % 10 === 0) simpan();
  } catch (e) {
    gagal.push({ i, nama, alasan: e.message });
    console.log(`  GAGAL ${nama}: ${e.message}`);
  }
  await tidur(JEDA_MS);
}

// ================= ringkasan akhir =================
simpan();
console.log(`\nSelesai. Tersimpan: ${hasil.features.length}/${sppg.length} di ${OUT_FILE}`);
if (gagal.length) {
  console.log('Gagal:', JSON.stringify(gagal));
  console.log('Jalankan lagi perintah yang sama untuk mengulang hanya yang gagal.');
  process.exitCode = 2;
}
