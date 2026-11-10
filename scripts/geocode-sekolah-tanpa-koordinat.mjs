// Skrip sekali jalan: mencari koordinat untuk sekolah resmi yang tidak punya Lintang/Bujur, lewat Nominatim (alamat/nama).
// Hasil diperiksa terhadap titik tengah sekolah lain di kelurahan yang sama (batas BATAS_KM); jika tidak ketemu, dipakai
// titik tengah kelurahan (ditandai perkiraan).
//
//   node scripts/geocode-sekolah-tanpa-koordinat.mjs
//
// Masukan : data/sekolah_resmi.json
// Keluaran: data/sekolah_geocode_tambahan.json -> { "<npsn>": {lat,lng,sumber,akurasi,jarak_km} }, dibaca oleh scripts/bangun-data-sekolah.mjs

import fs from 'node:fs';

// ================= pengaturan: alamat Nominatim, jeda, kotak pencarian, dan batas kewajaran jarak ke titik tengah kelurahan =================
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'sppg-latihan-geocoder/1.0'; // kebijakan Nominatim: identitas klien wajib, maks 1 permintaan/detik
const JEDA_MS = 1200;
const VIEWBOX = '110.20,-6.85,110.55,-7.20';
const BATAS_KM = 2.5;
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const kec = (k) => String(k).replace(/^Kec\.\s*/i, '').trim();
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembacaan data dan titik tengah kelurahan dari sekolah yang punya koordinat (untuk pemeriksaan silang) =================
const resmi = JSON.parse(fs.readFileSync('data/sekolah_resmi.json', 'utf8'));
const dalam = (lat, lng) => lat >= -7.20 && lat <= -6.85 && lng >= 110.20 && lng <= 110.55;
const ok = resmi.filter((s) => s.lat != null && s.lng != null && dalam(s.lat, s.lng));
const pusat = new Map();
ok.forEach((s) => { const k = `${norm(s.kelurahan)}|${norm(kec(s.kecamatan))}`; if (!pusat.has(k)) pusat.set(k, []); pusat.get(k).push([s.lng, s.lat]); });
const centroid = (kel, kc) => { const p = pusat.get(`${norm(kel)}|${norm(kc)}`); return p && p.length ? [p.reduce((a, x) => a + x[0], 0) / p.length, p.reduce((a, x) => a + x[1], 0) / p.length] : null; };

// ================= daftar sekolah yang perlu dicari: bentuk yang dipakai BPS dan tanpa koordinat yang valid =================
const JENJANG = ['SD', 'MI', 'SMP', 'MTs', 'SMA', 'SMK', 'MA'];
const perlu = resmi.filter((s) => JENJANG.includes(s.bentuk) && !(s.lat != null && s.lng != null && (dalam(s.lat, s.lng) || dalam(-Math.abs(s.lat), s.lng))));
console.log(`Sekolah tanpa koordinat valid: ${perlu.length}`);

async function cari(q) {
  const url = `${NOMINATIM}?format=jsonv2&limit=5&countrycodes=id&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await tidur(JEDA_MS);
  return res.json();
}
// nama jalan dari alamat (buang RT/RW/No/Kelurahan/Kecamatan)
function jalan(a) {
  let s = String(a || '').split(',')[0].replace(/\b(RT|RW|KEL|KELURAHAN|KEC|KECAMATAN|KOTA|NO|NOMOR|BLOK)\b\.?.*$/i, '');
  return s.replace(/^\s*(JL|JLN|JALAN)\.?\s*/i, 'Jalan ').replace(/[.]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ================= pencarian per sekolah: nama sekolah, lalu nama jalan; terima hasil terdekat dengan titik tengah kelurahan dalam batas =================
const hasil = {};
let n = 0;
for (const s of perlu) {
  n++;
  const kc = kec(s.kecamatan), ctr = centroid(s.kelurahan, kc);
  const kueri = [`${s.nama}, ${s.kelurahan}, ${kc}, Kota Semarang`, `${s.nama}, Semarang`, ...(jalan(s.alamat) ? [`${jalan(s.alamat)}, ${s.kelurahan}, ${kc}, Kota Semarang`, `${jalan(s.alamat)}, ${kc}, Kota Semarang`] : [])];
  let pilih = null, q0 = '';
  for (const q of kueri) {
    let h = [];
    try { h = await cari(q); } catch (e) { console.log('  error', e.message); }
    const c = h.map((r) => ({ xy: [parseFloat(r.lon), parseFloat(r.lat)], tipe: `${r.class}/${r.type}` }))
      .map((r) => ({ ...r, d: ctr ? jarakKm(r.xy, ctr) : 0 }))
      .filter((r) => !ctr || r.d <= BATAS_KM).sort((a, b) => a.d - b.d);
    if (c.length) { pilih = c[0]; q0 = q; break; }
  }
  if (pilih) hasil[s.npsn] = { lat: pilih.xy[1], lng: pilih.xy[0], sumber: 'nominatim', akurasi: q0.startsWith(s.nama) ? 'nama_sekolah' : 'jalan', jarak_km: ctr ? +pilih.d.toFixed(2) : null };
  else if (ctr) hasil[s.npsn] = { lat: ctr[1], lng: ctr[0], sumber: 'titik_tengah_kelurahan', akurasi: 'kelurahan_perkiraan', jarak_km: 0 };
  else hasil[s.npsn] = { lat: null, lng: null, sumber: 'tidak_ditemukan', akurasi: 'gagal', jarak_km: null };
  console.log(`[${n}/${perlu.length}] ${s.bentuk} ${s.nama} -> ${hasil[s.npsn].akurasi}`);
}

// ================= penulisan hasil dan ringkasan =================
fs.writeFileSync('data/sekolah_geocode_tambahan.json', JSON.stringify(hasil, null, 1));
const c = {};
Object.values(hasil).forEach((h) => { c[h.akurasi] = (c[h.akurasi] || 0) + 1; });
console.log('Selesai.', JSON.stringify(c));
