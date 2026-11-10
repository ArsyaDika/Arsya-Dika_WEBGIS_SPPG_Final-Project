// Skrip sekali jalan: mengambil daftar sekolah resmi Kota Semarang (SD, SMP, SMA, SMK, MI, MTs, MA) beserta
// koordinat (Lintang/Bujur) dari halaman publik referensi Kemendikdasmen.
//
//   node scripts/ambil-sekolah-kemendikdasmen.mjs
//
// Alur: halaman rekap kota -> daftar tiap kecamatan (dikdas dan dikmen) -> halaman detail tiap sekolah (koordinat).
// Bisa dilanjutkan jika terputus (hasil sementara disimpan di data/sekolah_resmi.json).
// Keluaran: data/sekolah_resmi.json -> [{npsn,nama,bentuk,status,alamat,kelurahan,kecamatan,lat,lng}, ...]

import fs from 'node:fs';

// ================= pengaturan: alamat situs, kode wilayah Kota Semarang, dan jeda sopan antar permintaan =================
const HOST = 'https://referensi.data.kemendikdasmen.go.id';
const KODE_KOTA = '036300';
const UA = 'Mozilla/5.0 sppg-latihan-sekolah/1.0';
const JEDA_MS = 700;
const OUT = 'data/sekolah_resmi.json';
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const bersih = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

async function ambil(path) {
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(HOST + path, { headers: { 'User-Agent': UA } });
      if (res.ok) { const t = await res.text(); await tidur(JEDA_MS); return t; }
      if (res.status === 404) return null;
    } catch { /* coba lagi */ }
    await tidur(2000 * i);
  }
  throw new Error('gagal mengambil ' + path);
}

// ================= pengambilan daftar kecamatan Kota Semarang dari halaman rekap kota =================
const rekap = await ambil(`/satpen/dikdas/${KODE_KOTA}/2`);
const kecamatan = [...rekap.matchAll(/href="\/satpen\/dikdas\/(\d{6})\/3[^"]*"[^>]*>([^<]+)</g)].map((m) => ({ kode: m[1], nama: bersih(m[2]) }));
console.log(`Kecamatan ditemukan: ${kecamatan.length}`, kecamatan.map((k) => k.nama).join(', '));

// ================= pengambilan daftar sekolah per kecamatan (dikdas dan dikmen): NPSN, nama, bentuk, status, alamat, kelurahan =================
let hasil = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const ada = new Set(hasil.map((s) => s.npsn));
const daftar = [];
for (const k of kecamatan) {
  for (const jenjang of ['dikdas', 'dikmen']) {
    const html = await ambil(`/satpen/${jenjang}/${k.kode}/3`);
    if (!html) continue;
    for (const tr of html.split('<tr').slice(1)) {
      const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => bersih(m[1]));
      if (td.length >= 7 && /^\d{8}$/.test(td[1])) daftar.push({ npsn: td[1], nama: td[2], bentuk: td[3], status: td[4], alamat: td[5], kelurahan: td[6], kecamatan: k.nama, jenjang });
    }
  }
  console.log(`daftar ${k.nama}: total kumulatif ${daftar.length}`);
}
const perBentuk = {};
daftar.forEach((s) => { perBentuk[s.bentuk] = (perBentuk[s.bentuk] || 0) + 1; });
console.log('Per bentuk:', JSON.stringify(perBentuk));

// ================= pengambilan koordinat tiap sekolah dari halaman detail (Lintang/Bujur), disimpan bertahap =================
let n = 0;
for (const s of daftar) {
  n++;
  if (ada.has(s.npsn)) continue;
  const html = await ambil(`/satpen/detail/${s.npsn}`);
  const txt = html ? bersih(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')) : '';
  const lat = parseFloat((txt.match(/Lintang\s+(-?\d+\.\d+)/) || [])[1]);
  const lng = parseFloat((txt.match(/Bujur\s+(-?\d+\.\d+)/) || [])[1]);
  hasil.push({ ...s, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null });
  if (n % 25 === 0) { fs.writeFileSync(OUT, JSON.stringify(hasil)); console.log(`detail ${n}/${daftar.length}`); }
}
fs.writeFileSync(OUT, JSON.stringify(hasil));

// ================= ringkasan akhir: jumlah per bentuk dan yang tanpa koordinat =================
const tanpaKoord = hasil.filter((s) => s.lat == null || s.lng == null).length;
console.log(`Selesai: ${hasil.length} sekolah | tanpa koordinat: ${tanpaKoord}`);
