// Skrip sekali jalan: menghitung matriks waktu tempuh berkendara (detik) dari semua titik SPPG ke semua sekolah
// memakai OpenRouteService Matrix API, agar aplikasi bisa mengalokasikan sekolah ke SPPG berdasarkan WAKTU TEMPUH
// (bukan jarak garis lurus).
//
//   node scripts/fetch-matriks-waktu.mjs
//
// Masukan : data/SPPG_geocoded.geojson (yang dipakai_analisis), data/sekolah.geojson, .env (ORS_API_KEY)
// Keluaran: data/waktu-tempuh.json -> { titik:["lng,lat",...], npsn:[...], detik:[[...]] }  (detik[i][j] = waktu titik i ke sekolah j; null = tidak terhubung)

import fs from 'node:fs';

// ================= pengaturan: alamat API, ukuran potongan (maks 3.500 rute per permintaan), jeda (batas gratis 40/menit) =================
const ORS_BASE = process.env.ORS_BASE || 'https://api.heigit.org/openrouteservice';
let SRC = 50, DST = 70;
const JEDA_MS = 1700, MAKS_ULANG = 3;
const OUT = 'data/waktu-tempuh.json';
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

// ================= pembacaan titik SPPG unik dan sekolah =================
const sppg = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8')).features.filter((f) => f.properties.dipakai_analisis);
const titik = [...new Set(sppg.map((f) => f.geometry.coordinates.slice(0, 2).join(',')))];
const sekolah = JSON.parse(fs.readFileSync('data/sekolah.geojson', 'utf8')).features;
const xyTitik = titik.map((k) => k.split(',').map(Number));
const xySek = sekolah.map((f) => f.geometry.coordinates.slice(0, 2));
console.log(`Titik SPPG: ${titik.length} | sekolah: ${sekolah.length} | rute: ${titik.length * sekolah.length}`);

// ================= satu permintaan matriks untuk potongan sumber (SPPG) x tujuan (sekolah), dengan ulang otomatis =================
async function matriks(s0, s1, d0, d1) {
  const lokasi = [...xyTitik.slice(s0, s1), ...xySek.slice(d0, d1)];
  const ns = s1 - s0, nd = d1 - d0;
  const body = { locations: lokasi, sources: Array.from({ length: ns }, (_, i) => i), destinations: Array.from({ length: nd }, (_, i) => ns + i), metrics: ['duration'] };
  for (let i = 1; i <= MAKS_ULANG; i++) {
    try {
      const res = await fetch(`${ORS_BASE}/v2/matrix/driving-car`, { method: 'POST', headers: { Authorization: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 429) { console.log('  kena batas, tunggu 65 detik'); await tidur(65000); continue; }
      if (!res.ok) { const t = await res.text(); throw new Error(`HTTP ${res.status} ${t.slice(0, 160).replace(KEY, '<KEY>')}`); }
      const d = await res.json();
      if (!d.durations) throw new Error('respons tanpa durations');
      return d.durations;
    } catch (e) { if (i === MAKS_ULANG) throw e; await tidur(3000 * i); }
  }
}

// ================= pengisian matriks per potongan; jika batas rute terlampaui, ukuran potongan dikecilkan otomatis =================
const detik = titik.map(() => new Array(sekolah.length).fill(null));
let permintaan = 0, tidakTerhubung = 0;
for (let s0 = 0; s0 < titik.length; s0 += SRC) {
  for (let d0 = 0; d0 < sekolah.length; d0 += DST) {
    const s1 = Math.min(titik.length, s0 + SRC), d1 = Math.min(sekolah.length, d0 + DST);
    let dur;
    try { dur = await matriks(s0, s1, d0, d1); }
    catch (e) { console.error('Gagal pada potongan', s0, d0, '-', e.message); process.exit(2); }
    dur.forEach((baris, i) => baris.forEach((v, j) => { if (v == null) tidakTerhubung++; else detik[s0 + i][d0 + j] = Math.round(v); }));
    permintaan++;
    if (permintaan % 5 === 0) console.log(`permintaan ${permintaan} (SPPG ${s1}/${titik.length}, sekolah ${d1}/${sekolah.length})`);
    await tidur(JEDA_MS);
  }
}

// ================= penulisan hasil dan ringkasan (sebaran waktu tempuh terdekat tiap sekolah) =================
fs.writeFileSync(OUT, JSON.stringify({ titik, npsn: sekolah.map((f) => f.properties.NPSN), detik }));
const terdekat = sekolah.map((_, j) => Math.min(...detik.map((b) => (b[j] == null ? Infinity : b[j])))).filter(Number.isFinite).sort((a, b) => a - b);
console.log(`Selesai: ${permintaan} permintaan | tidak terhubung: ${tidakTerhubung} | sekolah punya SPPG terjangkau: ${terdekat.length}/${sekolah.length}`);
console.log(`Waktu ke SPPG tercepat (menit): median ${(terdekat[Math.floor(terdekat.length / 2)] / 60).toFixed(1)}, p90 ${(terdekat[Math.floor(terdekat.length * 0.9)] / 60).toFixed(1)}, maks ${(terdekat[terdekat.length - 1] / 60).toFixed(1)}`);
