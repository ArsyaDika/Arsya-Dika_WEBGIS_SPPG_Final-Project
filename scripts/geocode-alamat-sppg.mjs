// Skrip sekali jalan: memperhalus koordinat SPPG dari titik kelurahan menjadi titik JALAN (alamat) memakai Nominatim.
// Alur: SPPG dicocokkan ke alamat (data/SPPG_alamat.json) lewat nama -> nama jalan dicari ke Nominatim ->
// hasil dipilih yang terdekat dengan titik kelurahan lama dan harus <= BATAS_KM (jika tidak, titik kelurahan dipertahankan).
//
//   node scripts/geocode-alamat-sppg.mjs
//
// Keluaran: data/SPPG_geocoded.geojson (diperbarui) dan data/SPPG_alamat_laporan.csv (untuk diperiksa di Excel)

import fs from 'node:fs';

// ================= pengaturan: alamat Nominatim, jeda, kotak pencarian, dan batas kewajaran jarak ke titik kelurahan =================
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'sppg-latihan-geocoder/1.0'; // kebijakan Nominatim: identitas klien wajib, maks 1 permintaan/detik
const JEDA_MS = 1200;
const VIEWBOX = '110.15,-6.85,110.65,-7.35';
const BATAS_KM = 2.5;
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const nrm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\bKOTA\b/g, '').replace(/\s+/g, ' ').trim();

function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembuatan pembersihan alamat: ambil nama jalan saja (buang RT/RW/No/Kelurahan/Kecamatan) =================
function namaJalan(alamat) {
  let s = String(alamat).split(',')[0];
  s = s.replace(/\b(RT|RW|KEL|KELURAHAN|KEC|KECAMATAN|KOTA|NO|NOMOR|BLOK)\b\.?.*$/i, '');
  s = s.replace(/^\s*(JL|JLN|JALAN)\.?\s*/i, 'Jalan ').replace(/[.]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

// ================= pembacaan data: alamat per nama SPPG dan SPPG hasil geocoding kelurahan =================
const alamat = JSON.parse(fs.readFileSync('data/SPPG_alamat.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8'));
const byNama = new Map();
alamat.forEach((a) => { const k = nrm(a.nama); if (!byNama.has(k)) byNama.set(k, a); });

async function cari(q) {
  const url = `${NOMINATIM}?format=jsonv2&limit=5&countrycodes=id&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await tidur(JEDA_MS);
  return res.json();
}

// ================= perulangan SPPG yang dipakai analisis: cari titik jalan, terima hanya yang wajar terhadap titik kelurahan =================
const baris = [['no_sppg', 'nama_sppg', 'alamat', 'jalan_dicari', 'lng_kelurahan', 'lat_kelurahan', 'lng_baru', 'lat_baru', 'selisih_km', 'hasil', 'kueri_berhasil']];
const hitung = { jalan: 0, kelurahan_tetap: 0, tanpa_alamat: 0 };
let n = 0;
for (const f of data.features) {
  const p = f.properties;
  if (!p.dipakai_analisis) continue;
  n++;
  const lama = f.geometry.coordinates.slice(0, 2);
  p.lng_kelurahan = p.lng_kelurahan ?? lama[0]; // titik kelurahan asli disimpan sekali (jika skrip diulang tidak tertimpa)
  p.lat_kelurahan = p.lat_kelurahan ?? lama[1];
  const kel = [p.lng_kelurahan, p.lat_kelurahan];
  const a = byNama.get(nrm(p['Nama SPPG']));
  if (!a) {
    hitung.tanpa_alamat++;
    baris.push([p['No SPPG'], p['Nama SPPG'], '', '', kel[0], kel[1], '', '', '', 'tanpa_alamat', '']);
    continue;
  }
  p.alamat = a.alamat;
  const jalan = namaJalan(a.alamat);
  const kueri = [
    `${jalan}, ${p['Desa/Kelurahan SPPG']}, ${p['Kecamatan SPPG']}, Kota Semarang`,
    `${jalan}, ${p['Kecamatan SPPG']}, Kota Semarang`,
    `${jalan}, Semarang`,
  ];
  let pilih = null, kueriOk = '';
  for (const q of kueri) {
    let hasil = [];
    try { hasil = await cari(q); } catch (e) { console.log('  error', e.message); }
    const kandidat = hasil
      .map((r) => ({ xy: [parseFloat(r.lon), parseFloat(r.lat)], tipe: `${r.class}/${r.type}` }))
      .map((r) => ({ ...r, d: jarakKm(r.xy, kel) }))
      .filter((r) => r.d <= BATAS_KM)
      .sort((x, y) => x.d - y.d);
    if (kandidat.length) { pilih = kandidat[0]; kueriOk = q; break; }
  }
  if (pilih) {
    f.geometry.coordinates = pilih.xy;
    p.geo_sumber = 'nominatim_jalan';
    p.geo_akurasi = 'jalan';
    hitung.jalan++;
    baris.push([p['No SPPG'], p['Nama SPPG'], a.alamat, jalan, kel[0], kel[1], pilih.xy[0], pilih.xy[1], pilih.d.toFixed(2), 'jalan', kueriOk]);
  } else {
    hitung.kelurahan_tetap++;
    baris.push([p['No SPPG'], p['Nama SPPG'], a.alamat, jalan, kel[0], kel[1], '', '', '', 'kelurahan_tetap', '']);
  }
  console.log(`[${n}] ${p['Nama SPPG']} -> ${pilih ? 'jalan (' + pilih.d.toFixed(2) + ' km dari titik kelurahan)' : 'tetap titik kelurahan'}`);
}

// ================= penulisan hasil: GeoJSON diperbarui + laporan CSV + ringkasan =================
fs.writeFileSync('data/SPPG_geocoded.geojson', JSON.stringify(data));
const csv = baris.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
fs.writeFileSync('data/SPPG_alamat_laporan.csv', '﻿' + csv);
const unik = new Set(data.features.filter((f) => f.properties.dipakai_analisis).map((f) => f.geometry.coordinates.slice(0, 2).join(','))).size;
console.log('\nSelesai.', JSON.stringify(hitung), '| titik unik SPPG yang dipakai:', unik);
