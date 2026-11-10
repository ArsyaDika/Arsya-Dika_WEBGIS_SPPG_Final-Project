// Skrip sekali jalan: menarik isochrone berkendara untuk SEMUA titik SPPG pada beberapa waktu tempuh sekaligus
// (60, 120, ..., 600 detik) dari OpenRouteService, agar aplikasi bisa memilih waktu tempuh <= 600 detik lewat slider
// tanpa memanggil API (dan tanpa menaruh API key di browser).
//
//   node scripts/fetch-isochrones-multi.mjs            (bisa dilanjutkan jika terputus; hasil sementara tersimpan)
//
// Masukan : data/SPPG_geocoded.geojson (yang dipakai_analisis), data/sekolah.geojson (titik alternatif jika isochrone terlalu kecil), .env (ORS_API_KEY)
// Keluaran: data/isochrone-multi.geojson -> poligon dengan properti {titik:"lng,lat", waktu_detik}

import fs from 'node:fs';

// ================= pengaturan: waktu tempuh, alamat API, jeda antar permintaan (batas gratis 20/menit) =================
const WAKTU = [60, 120, 180, 240, 300, 360, 420, 480, 540, 600];
const ORS_BASE = process.env.ORS_BASE || 'https://api.heigit.org/openrouteservice';
const JEDA_MS = 3500, MAKS_ULANG = 3, LUAS_MIN_KM2 = 10;
const OUT = 'data/isochrone-multi.geojson';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// ================= pembacaan API key dari .env (tidak pernah dicetak) =================
function bacaEnv() {
  if (!fs.existsSync('.env')) return {};
  const o = {};
  for (const b of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const i = b.indexOf('='); if (i > 0 && !b.trim().startsWith('#')) o[b.slice(0, i).trim()] = b.slice(i + 1).trim().replace(/^["']|["']$/g, ''); }
  return o;
}
const KEY = process.env.ORS_API_KEY || bacaEnv().ORS_API_KEY;
if (!KEY) { console.error('ORS_API_KEY tidak ditemukan di .env'); process.exit(1); }

// ================= fungsi bantu: luas poligon (km2) dan jarak (km) =================
function luasKm2(g) {
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
  const kx = 111.32 * Math.cos((-7 * Math.PI) / 180), ky = 110.57;
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * kx * (ring[i + 1][1] * ky) - ring[i + 1][0] * kx * (ring[i][1] * ky);
  return Math.abs(a) / 2;
}
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= penarikan isochrone satu titik untuk semua waktu (satu permintaan), dengan ulang otomatis =================
async function tarik(lng, lat) {
  for (let i = 1; i <= MAKS_ULANG; i++) {
    try {
      const res = await fetch(`${ORS_BASE}/v2/isochrones/driving-car`, { method: 'POST', headers: { Authorization: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ locations: [[lng, lat]], range: WAKTU, range_type: 'time' }) });
      if (res.status === 429) { console.log('  kena batas per menit, tunggu 65 detik'); await tidur(65000); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (!d.features || d.features.length < WAKTU.length) throw new Error('respons kurang lengkap');
      return { fitur: d.features, sisa: res.headers.get('x-ratelimit-remaining') };
    } catch (e) { if (i === MAKS_ULANG) throw e; await tidur(3000 * i); }
  }
}

// ================= daftar titik SPPG unik yang dipakai analisis dan titik sekolah (untuk titik alternatif) =================
const sppg = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8')).features.filter((f) => f.properties.dipakai_analisis);
const titik = [...new Set(sppg.map((f) => f.geometry.coordinates.slice(0, 2).join(',')))];
const sekolah = JSON.parse(fs.readFileSync('data/sekolah.geojson', 'utf8')).features.map((f) => f.geometry.coordinates.slice(0, 2));
console.log(`Titik SPPG unik: ${titik.length} | waktu: ${WAKTU.join(',')} detik`);

// ================= pembacaan hasil sementara (untuk dilanjutkan) =================
let hasil = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { type: 'FeatureCollection', features: [] };
const sudah = new Set(hasil.features.map((f) => f.properties.titik));
const simpan = () => fs.writeFileSync(OUT, JSON.stringify(hasil));

// ================= perulangan: tarik tiap titik; jika isochrone 600 detik terlalu kecil (titik di ruas jalan terpencil) coba dari sekolah terdekat =================
const gagal = [];
let n = 0, sisaKuota = '-';
for (const kunci of titik) {
  n++;
  if (sudah.has(kunci)) continue;
  const [lng, lat] = kunci.split(',').map(Number);
  try {
    let { fitur, sisa } = await tarik(lng, lat);
    sisaKuota = sisa ?? sisaKuota;
    const luas600 = () => luasKm2(fitur.find((f) => f.properties.value === 600).geometry);
    if (luas600() < LUAS_MIN_KM2) {
      let terbaik = fitur, lt = luas600();
      for (const o of sekolah.map((p) => ({ p, d: jarakKm([lng, lat], p) })).filter((o) => o.d <= 3).sort((a, b) => a.d - b.d).slice(0, 3)) {
        await tidur(JEDA_MS);
        const r = await tarik(o.p[0], o.p[1]);
        const l = luasKm2(r.fitur.find((f) => f.properties.value === 600).geometry);
        if (l > lt) { terbaik = r.fitur; lt = l; }
        if (lt >= LUAS_MIN_KM2) break;
      }
      fitur = terbaik;
      console.log(`  isochrone kecil dialihkan (luas 600 detik: ${lt.toFixed(1)} km2)`);
    }
    for (const f of fitur) hasil.features.push({ type: 'Feature', geometry: f.geometry, properties: { titik: kunci, waktu_detik: f.properties.value } });
    console.log(`[${n}/${titik.length}] ${kunci} (sisa kuota: ${sisaKuota})`);
    if (n % 10 === 0) simpan();
  } catch (e) { gagal.push({ titik: kunci, alasan: e.message }); console.log(`  GAGAL ${kunci}: ${e.message}`); }
  await tidur(JEDA_MS);
}
simpan();
console.log(`\nSelesai: ${new Set(hasil.features.map((f) => f.properties.titik)).size}/${titik.length} titik, ${hasil.features.length} poligon.`);
if (gagal.length) { console.log('Gagal:', JSON.stringify(gagal)); process.exitCode = 2; }
