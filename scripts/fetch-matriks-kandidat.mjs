// Skrip sekali jalan: menghitung matriks waktu tempuh berkendara (detik) dari 150 calon lokasi SPPG baru ke semua sekolah
// memakai OpenRouteService Matrix API, agar aplikasi menilai kandidat dengan WAKTU TEMPUH (sama dengan alokasi SPPG yang ada).
//
//   node scripts/fetch-matriks-kandidat.mjs
//
// Masukan : data/kandidat-lokasi.json (dari scripts/pilih-kandidat.mjs), data/sekolah.geojson, .env (ORS_API_KEY)
// Keluaran: data/waktu-kandidat.json -> { kandidat:[npsn,...], titik:["lng,lat",...], npsn:[...sekolah], detik:[[...]] }  (detik[i][j] = waktu calon i ke sekolah j; null = tidak terhubung)

import fs from 'node:fs';

// ================= pengaturan: alamat API, ukuran potongan (maks 3.500 rute per permintaan), jeda (batas gratis 40/menit) =================
const ORS_BASE = process.env.ORS_BASE || 'https://api.heigit.org/openrouteservice';
const SRC = 50, DST = 70;
const JEDA_MS = 1700, MAKS_ULANG = 3;
const OUT = 'data/waktu-kandidat.json';
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

// ================= pembacaan calon lokasi dan sekolah =================
const kand = JSON.parse(fs.readFileSync('data/kandidat-lokasi.json', 'utf8')).kandidat;
const sekolah = JSON.parse(fs.readFileSync('data/sekolah.geojson', 'utf8')).features;
const xyKand = kand.map((k) => k.xy);
const xySek = sekolah.map((f) => f.geometry.coordinates.slice(0, 2));
console.log(`Calon: ${kand.length} | sekolah: ${sekolah.length} | rute: ${kand.length * sekolah.length}`);

// ================= satu permintaan matriks untuk potongan sumber (calon) x tujuan (sekolah), dengan ulang otomatis =================
async function matriks(s0, s1, d0, d1) {
  const lokasi = [...xyKand.slice(s0, s1), ...xySek.slice(d0, d1)];
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

// ================= pengisian matriks per potongan =================
const detik = kand.map(() => new Array(sekolah.length).fill(null));
let permintaan = 0, tidakTerhubung = 0;
for (let s0 = 0; s0 < kand.length; s0 += SRC) {
  for (let d0 = 0; d0 < sekolah.length; d0 += DST) {
    const s1 = Math.min(kand.length, s0 + SRC), d1 = Math.min(sekolah.length, d0 + DST);
    let dur;
    try { dur = await matriks(s0, s1, d0, d1); }
    catch (e) { console.error('Gagal pada potongan', s0, d0, '-', e.message); process.exit(2); }
    dur.forEach((baris, i) => baris.forEach((v, j) => { if (v == null) tidakTerhubung++; else detik[s0 + i][d0 + j] = Math.round(v); }));
    permintaan++;
    if (permintaan % 5 === 0) console.log(`permintaan ${permintaan} (calon ${s1}/${kand.length}, sekolah ${d1}/${sekolah.length})`);
    await tidur(JEDA_MS);
  }
}

// ================= penulisan hasil dan ringkasan =================
fs.writeFileSync(OUT, JSON.stringify({ kandidat: kand.map((k) => k.npsn), titik: kand.map((k) => k.xy.join(',')), npsn: sekolah.map((f) => f.properties.NPSN), detik }));
console.log(`Selesai: ${permintaan} permintaan | pasangan tidak terhubung: ${tidakTerhubung} dari ${kand.length * sekolah.length}`);
