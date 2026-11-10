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
// ================= memperbaiki nama keluaran isochrone-600.geojson menjadi isochrone-sppg-600.geojson agar hasil lama (koordinat salah) tidak tertimpa dan tidak ikut dilanjutkan =================
const OUT_FILE = `data/isochrone-sppg-${RANGE_DETIK}.geojson`;
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

// ================= memperbaiki sumber SPPG.geojson menjadi SPPG_geocoded.geojson (hanya dipakai_analisis) agar isochrone dihitung dari koordinat yang sudah benar =================
const semuaSppg = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8')).features;
const sppg = semuaSppg.map((f, i) => ({ ...f, idx: i })).filter((f) => f.properties.dipakai_analisis);
console.log(`SPPG dipakai analisis: ${sppg.length} dari ${semuaSppg.length}`);

// ================= pengelompokan SPPG berkoordinat sama agar tiap titik unik hanya dipanggil sekali ke API =================
const kelompok = new Map(); // "lng,lat" -> [SPPG...]
for (const s of sppg) {
  const k = s.geometry.coordinates.slice(0, 2).join(',');
  if (!kelompok.has(k)) kelompok.set(k, []);
  kelompok.get(k).push(s);
}
console.log(`Titik unik yang dipanggil ke API: ${kelompok.size}`);

// ================= pembacaan hasil yang sudah ada (agar bisa dilanjutkan) =================
let hasil = { type: 'FeatureCollection', features: [] };
// ================= memperbaiki pembacaan hasil lama menjadi bisa diabaikan lewat --ulang agar isochrone dihitung ulang saat koordinat SPPG berubah (hasil lama tidak lagi sesuai titik baru) =================
if (!argv.includes('--ulang') && fs.existsSync(OUT_FILE)) {
  hasil = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  console.log(`Melanjutkan: ${hasil.features.length} isochrone sudah ada di ${OUT_FILE}`);
}

// ================= pembuatan pemeriksaan isochrone terlalu kecil (titik jatuh di ruas jalan terpencil) agar bisa dialihkan ke titik sekolah terdekat yang jaringan jalannya terhubung =================
const LUAS_MIN_KM2 = 10;
const sekolahXY = ['SD', 'SMP', 'SMA'].flatMap((n) => JSON.parse(fs.readFileSync(`data/${n}.geojson`, 'utf8')).features)
  .map((f) => f.geometry.coordinates.slice(0, 2));
function luasKm2(geom) {
  const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
  const kx = 111.32 * Math.cos((-7 * Math.PI) / 180), ky = 110.57; // km per derajat di sekitar Semarang
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * kx * (ring[i + 1][1] * ky) - ring[i + 1][0] * kx * (ring[i][1] * ky);
  return Math.abs(a) / 2;
}
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembuatan opsi --perbaiki-kecil: buang isochrone yang terlalu kecil dari hasil lama agar dihitung ulang =================
if (argv.includes('--perbaiki-kecil')) {
  const sebelum = hasil.features.length;
  hasil.features = hasil.features.filter((f) => luasKm2(f.geometry) >= LUAS_MIN_KM2);
  console.log(`--perbaiki-kecil: ${sebelum - hasil.features.length} isochrone < ${LUAS_MIN_KM2} km2 dibuang untuk dihitung ulang`);
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
let urut = 0;
for (const [kunci, anggota] of kelompok) {
  urut++;
  if (anggota.every((s) => sudah.has(s.idx))) continue; // semua SPPG di titik ini sudah punya isochrone
  const [lng, lat] = kunci.split(',').map(Number);
  const label = anggota.map((s) => s.properties['Nama SPPG']).join(' + ');
  try {
    let { feature, sisa } = await tarik(lng, lat);
    sisaKuota = sisa ?? sisaKuota;
    // ================= memperbaiki isochrone kecil (< LUAS_MIN_KM2) menjadi dicoba ulang dari sekolah terdekat (<= 3 km) agar titik berada di jaringan jalan yang terhubung =================
    let dialihkan = false;
    if (luasKm2(feature.geometry) < LUAS_MIN_KM2) {
      const alt = sekolahXY.map((p) => ({ p, d: jarakKm([lng, lat], p) })).filter((o) => o.d <= 3).sort((a, b) => a.d - b.d).slice(0, 3);
      let terbaik = feature, luasTerbaik = luasKm2(feature.geometry);
      for (const o of alt) {
        await tidur(JEDA_MS);
        const r = await tarik(o.p[0], o.p[1]);
        const l = luasKm2(r.feature.geometry);
        if (l > luasTerbaik) { terbaik = r.feature; luasTerbaik = l; dialihkan = true; }
        if (luasTerbaik >= LUAS_MIN_KM2) break;
      }
      feature = terbaik;
      console.log(`  isochrone kecil, ${dialihkan ? 'dialihkan ke titik sekolah terdekat' : 'tidak ada titik alternatif yang lebih baik'} (luas ${luasTerbaik.toFixed(1)} km2)`);
    }
    // satu isochrone dipakai bersama oleh semua SPPG yang berada di titik yang sama
    for (const s of anggota) {
      hasil.features.push({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          sppg_idx: s.idx, // urutan di data/SPPG_geocoded.geojson
          sppg_no: s.properties['No SPPG'] ?? null,
          sppg_nama: s.properties['Nama SPPG'] ?? `SPPG-${s.idx}`,
          waktu_detik: RANGE_DETIK,
          luas_km2: +luasKm2(feature.geometry).toFixed(1),
          isochrone_dialihkan: dialihkan,
        },
      });
    }
    console.log(`[titik ${urut}/${kelompok.size}] ${label}  (SPPG tersimpan: ${hasil.features.length}/${sppg.length}, sisa kuota header: ${sisaKuota})`);
    if (urut % 10 === 0) simpan();
  } catch (e) {
    gagal.push({ titik: kunci, sppg: label, alasan: e.message });
    console.log(`  GAGAL ${label}: ${e.message}`);
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
