// Skrip sekali jalan: memperbaiki koordinat SPPG yang salah (banyak SPPG berbagi satu titik).
// Cara kerja: tiap kelurahan dicari ke Nominatim (OpenStreetMap) -> hasilnya dicek silang dengan
// titik tengah sekolah di kelurahan yang sama -> jika meleset/gagal dipakai titik tengah sekolah.
//
//   node scripts/geocode-sppg.mjs
//
// Keluaran (data/SPPG.geojson asli TIDAK diubah):
//   data/SPPG_geocoded.geojson      -> SPPG dengan koordinat baru + keterangan sumber/akurasi
//   data/SPPG_geocode_laporan.csv   -> tabel untuk diperiksa manual (bisa dibuka di Excel)

import fs from 'node:fs';

// ================= pengaturan: alamat API, jeda, dan batas pemeriksaan silang =================
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'sppg-latihan-geocoder/1.0'; // kebijakan Nominatim: wajib identitas klien, maks 1 permintaan/detik
const JEDA_MS = 1200;
// kotak pencarian sekitar Kota + Kabupaten Semarang (kiri,atas,kanan,bawah) agar tidak salah ke daerah lain
const VIEWBOX = '110.15,-6.85,110.65,-7.35';
const BATAS_CEK_KM = 3; // jika titik Nominatim > 3 km dari titik tengah sekolah di kelurahan sama, dianggap meleset

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

// ================= fungsi bantu: jarak dua titik (haversine, km) =================
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembacaan data SPPG dan titik tengah sekolah per kelurahan (untuk pemeriksaan silang) =================
const sppg = JSON.parse(fs.readFileSync('data/SPPG.geojson', 'utf8')).features;
const sekolah = ['SD', 'SMP', 'SMA'].flatMap((n) => JSON.parse(fs.readFileSync(`data/${n}.geojson`, 'utf8')).features);
const kumpul = new Map(); // "KELURAHAN|KECAMATAN" -> [[lng,lat],...]
for (const s of sekolah) {
  const k = `${norm(s.properties.DESA)}|${norm(s.properties.KECAMATAN)}`;
  if (!kumpul.has(k)) kumpul.set(k, []);
  kumpul.get(k).push(s.geometry.coordinates.slice(0, 2));
}
const centroidSekolah = (kel, kec) => {
  const pts = kumpul.get(`${norm(kel)}|${norm(kec)}`);
  if (!pts || pts.length === 0) return null;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
};

// ================= pencarian satu kelurahan ke Nominatim dengan beberapa variasi kueri =================
async function cari(q) {
  const url = `${NOMINATIM}?format=jsonv2&limit=3&countrycodes=id&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await tidur(JEDA_MS);
  return res.json();
}

async function geocodeKelurahan(kel, kec, kab) {
  const kabLabel = /^KOTA/i.test(kab) ? 'Kota Semarang' : 'Kabupaten Semarang';
  const variasi = [
    `${kel}, ${kec}, ${kabLabel}`,
    `${kel}, Kecamatan ${kec}, ${kabLabel}`,
    `${kel}, ${kabLabel}`,
  ];
  for (const q of variasi) {
    const hasil = await cari(q);
    const cocok = hasil.find((r) => norm(r.display_name).includes(norm(kel)));
    if (cocok) return { koord: [parseFloat(cocok.lon), parseFloat(cocok.lat)], kueri: q, nama: cocok.display_name };
  }
  return null;
}

// ================= perulangan: satu pencarian per kombinasi kelurahan unik =================
const kombinasi = new Map(); // kunci -> {kel,kec,kab}
for (const s of sppg) {
  const p = s.properties;
  const kunci = `${norm(p['Desa/Kelurahan SPPG'])}|${norm(p['Kecamatan SPPG'])}|${norm(p['Kabupaten/Kota SPPG'])}`;
  if (!kombinasi.has(kunci)) kombinasi.set(kunci, { kel: p['Desa/Kelurahan SPPG'], kec: p['Kecamatan SPPG'], kab: p['Kabupaten/Kota SPPG'] });
}
console.log(`Mencari ${kombinasi.size} kombinasi kelurahan unik (sekitar ${Math.ceil((kombinasi.size * 1.5 * JEDA_MS) / 60000)} menit)...`);

const putusan = new Map(); // kunci -> {koord, sumber, akurasi, jarak, catatan}
let n = 0;
for (const [kunci, { kel, kec, kab }] of kombinasi) {
  n++;
  const cs = centroidSekolah(kel, kec);
  let nom = null;
  try {
    nom = await geocodeKelurahan(kel, kec, kab);
  } catch (e) {
    console.log(`  error ${kel}: ${e.message}`);
  }

  let p;
  if (nom && cs) {
    const d = jarakKm(nom.koord, cs);
    p = d <= BATAS_CEK_KM
      ? { koord: nom.koord, sumber: 'nominatim', akurasi: 'kelurahan', jarak: d, catatan: '' }
      : { koord: cs, sumber: 'centroid_sekolah', akurasi: 'kelurahan_perkiraan', jarak: d, catatan: `nominatim meleset ${d.toFixed(1)} km dari sekolah setempat` };
  } else if (nom) {
    p = { koord: nom.koord, sumber: 'nominatim', akurasi: 'kelurahan', jarak: null, catatan: 'tanpa pemeriksaan silang (tidak ada sekolah di kelurahan ini)' };
  } else if (cs) {
    p = { koord: cs, sumber: 'centroid_sekolah', akurasi: 'kelurahan_perkiraan', jarak: null, catatan: 'nominatim tidak menemukan' };
  } else {
    p = { koord: null, sumber: 'tidak_ditemukan', akurasi: 'gagal', jarak: null, catatan: 'tidak ditemukan di Nominatim maupun sekolah' };
  }
  putusan.set(kunci, p);
  console.log(`[${n}/${kombinasi.size}] ${kel} / ${kec} -> ${p.sumber}${p.catatan ? ' (' + p.catatan + ')' : ''}`);
}

// ================= penulisan hasil: GeoJSON baru + laporan CSV =================
const baris = [['no_sppg', 'nama_sppg', 'kelurahan', 'kecamatan', 'kab_kota', 'lng_lama', 'lat_lama', 'lng_baru', 'lat_baru', 'sumber', 'akurasi', 'jarak_cek_km', 'catatan']];
const fiturBaru = sppg.map((s) => {
  const p = s.properties;
  const kunci = `${norm(p['Desa/Kelurahan SPPG'])}|${norm(p['Kecamatan SPPG'])}|${norm(p['Kabupaten/Kota SPPG'])}`;
  const k = putusan.get(kunci);
  const lama = s.geometry.coordinates.slice(0, 2);
  const baru = k.koord ?? lama;
  baris.push([p['No SPPG'], p['Nama SPPG'], p['Desa/Kelurahan SPPG'], p['Kecamatan SPPG'], p['Kabupaten/Kota SPPG'],
    lama[0], lama[1], k.koord ? baru[0] : '', k.koord ? baru[1] : '', k.sumber, k.akurasi, k.jarak == null ? '' : k.jarak.toFixed(2), k.catatan]);
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: baru },
    properties: { ...p, geo_sumber: k.sumber, geo_akurasi: k.akurasi, geo_jarak_cek_km: k.jarak == null ? null : +k.jarak.toFixed(2), lng_lama: lama[0], lat_lama: lama[1] },
  };
});
fs.writeFileSync('data/SPPG_geocoded.geojson', JSON.stringify({ type: 'FeatureCollection', features: fiturBaru }));
const csv = baris.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
fs.writeFileSync('data/SPPG_geocode_laporan.csv', '﻿' + csv); // BOM agar Excel membaca UTF-8

// ================= ringkasan akhir =================
const hitung = {};
fiturBaru.forEach((f) => { hitung[f.properties.geo_sumber] = (hitung[f.properties.geo_sumber] || 0) + 1; });
const unik = new Set(fiturBaru.filter((f) => f.properties.geo_sumber !== 'tidak_ditemukan').map((f) => f.geometry.coordinates.join(','))).size;
console.log('\nSelesai. Ringkasan sumber koordinat (per SPPG):', JSON.stringify(hitung));
console.log('Koordinat unik setelah perbaikan:', unik, '(sebelumnya 49)');
console.log('Hasil: data/SPPG_geocoded.geojson dan data/SPPG_geocode_laporan.csv');
