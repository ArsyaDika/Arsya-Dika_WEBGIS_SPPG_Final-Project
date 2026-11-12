// Skrip sekali jalan: memperhalus koordinat SPPG yang masih berupa titik kelurahan dengan mencari RUAS JALAN (atau nama tempat)
// dari alamatnya di data OpenStreetMap lewat Overpass API, lalu mengambil titik pada ruas itu yang terdekat dengan titik kelurahan.
// Nominatim sebelumnya tidak menemukan jalan-jalan ini (ejaan berbeda, gang, perumahan), sehingga dipakai pencocokan kata kunci longgar.
//
//   node scripts/geocode-sppg-overpass.mjs
//
// Masukan : data/SPPG_geocoded.geojson (yang dipakai_analisis dan belum berkoordinat jalan), data/SPPG_alamat.json
// Keluaran: data/SPPG_geocoded.geojson (diperbarui; geo_akurasi = 'ruas_jalan' atau 'tempat'), data/SPPG_overpass_laporan.csv

import fs from 'node:fs';

// ================= pengaturan: alamat Overpass, jeda, jari-jari pencarian, dan batas kewajaran jarak ke titik kelurahan =================
// ================= memperbaiki server tunggal dan radius sempit menjadi dua server Overpass (utama + lz4), percobaan ulang bertahap saat server penuh, radius 5 km, dan batas kewajaran 4 km agar jalan panjang atau titik kelurahan yang kurang tepat tidak menyebabkan penolakan =================
const SERVER = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter'];
const UA = 'sppg-latihan-geocoder/1.0';
const JEDA_MS = 4000;
const RADIUS_M = 4000;
const BATAS_KM = 4;
const UMUM = new Set(['JALAN', 'JLN', 'RAYA', 'TIMUR', 'BARAT', 'UTARA', 'SELATAN', 'TENGAH', 'NOMOR', 'GANG', 'PERUM', 'PERUMAHAN', 'KAWASAN', 'KOMPLEK', 'BLOK', 'DAPUR', 'SETAPAK', 'KELURAHAN', 'KECAMATAN', 'SEMARANG', 'JAWA', 'TENGAH', 'KOTA', 'SPPG']);
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const nrm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\bKOTA\b/g, '').replace(/\s+/g, ' ').trim();
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembuatan kata kunci dari alamat: nama jalan (setelah Jl/Jalan/Gg/Gang) dan nama tempat (perumahan, kawasan, komplek, dll.), diambil kata terpanjang yang bukan kata umum =================
function kataKunci(alamat) {
  const a = String(alamat || '');
  const terms = [];
  for (const m of a.matchAll(/\b(?:Jl|Jln|Jalan|Gg|Gang)\.?\s+([A-Za-z0-9 .']+?)(?=\s+(?:No|Rt|Rw|Kel|Kec|Km|Blok|Kav|Kota)\b|,|$)/gi)) terms.push({ jenis: 'jalan', teks: m[1] });
  for (const seg of a.split(',')) if (/(regency|technopark|pergudangan|perum|kawasan|komplek|taman|asrama|puri|citra|dapur)/i.test(seg)) terms.push({ jenis: 'tempat', teks: seg });
  const hasil = [];
  for (const t of terms) {
    const kata = nrm(t.teks).split(' ').filter((w) => w.length >= 4 && !UMUM.has(w) && !/^\d+$/.test(w)).sort((x, y) => y.length - x.length);
    if (kata[0]) hasil.push({ jenis: t.jenis, kata: kata[0], lain: kata.slice(1, 3), teks: t.teks.trim() });   // kata cadangan jika kata terpanjang tidak cocok
  }
  return hasil;
}

async function overpass(q) {
  let alasan = '';
  for (let i = 0; i < 6; i++) {
    const srv = SERVER[i % SERVER.length];
    try {
      const res = await fetch(srv, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      if (res.ok) {
        const d = await res.json();
        if (!(d.remark && /runtime error|timed out|out of memory/i.test(d.remark))) { await tidur(JEDA_MS); return d; }
        alasan = d.remark;
      } else alasan = `HTTP ${res.status}`;
    } catch (e) { alasan = e.message; }
    await tidur(Math.min(60000, 8000 * 2 ** i));   // 8, 16, 32, 60, 60, 60 detik
  }
  throw new Error('Overpass gagal: ' + alasan);
}

// ================= pencarian satu kata kunci di sekitar titik kelurahan: ruas jalan bernama (geometri penuh) atau elemen bernama lain (pusat); hasil = titik terdekat ke titik kelurahan =================
async function cariKata(k, kel, nomor) {
  const [lng, lat] = kel;
  const re = k.kata.replace(/[^A-Z0-9]/g, '');
  // ================= pembuatan pencocokan nomor rumah: bila alamat punya nomor, cari dulu elemen OSM dengan addr:street dan addr:housenumber yang sama (titik paling tepat), baru ruas jalan =================
  if (k.jenis === 'jalan' && nomor) {
    const qn = `[out:json][timeout:90];nwr["addr:housenumber"="${nomor}"]["addr:street"~"${re}",i](around:${RADIUS_M},${lat},${lng});out center;`;
    const dn = await overpass(qn);
    let tn = null;
    for (const e of dn.elements || []) { const p = e.center ? [e.center.lon, e.center.lat] : [e.lon, e.lat]; const jr = jarakKm(p, kel); if (!tn || jr < tn.jarak) tn = { xy: p, jarak: jr, nama: `${e.tags['addr:street']} no ${nomor}`, tepat: true }; }
    if (tn && tn.jarak <= BATAS_KM) return tn;
  }
  const q = k.jenis === 'jalan'
    ? `[out:json][timeout:90];way["highway"]["name"~"${re}",i](around:${RADIUS_M},${lat},${lng});out geom;`
    : `[out:json][timeout:90];nwr["name"~"${re}",i](around:${RADIUS_M},${lat},${lng});out center;`;
  const d = await overpass(q);
  let terbaik = null;
  for (const e of d.elements || []) {
    const titik = e.geometry ? e.geometry.map((p) => [p.lon, p.lat]) : e.center ? [[e.center.lon, e.center.lat]] : e.lat ? [[e.lon, e.lat]] : [];
    for (const p of titik) { const jr = jarakKm(p, kel); if (!terbaik || jr < terbaik.jarak) terbaik = { xy: p, jarak: jr, nama: e.tags && e.tags.name }; }
  }
  return terbaik && terbaik.jarak <= BATAS_KM ? terbaik : null;
}

// ================= pembacaan data dan perulangan: tiap SPPG yang belum berkoordinat jalan dicoba dengan semua kata kunci dari alamatnya =================
const data = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8'));
// ================= memperbaiki alamat hanya dari direktori Kota menjadi Kota + Kabupaten Semarang (SPPG Ungaran), dan pencocokan nama persis menjadi toleran terhadap penomoran: jika tidak ada nama yang sama, dipakai entri direktori dengan nama dasar yang sama (tanpa angka akhir) yang belum terpakai =================
const alamat = [...JSON.parse(fs.readFileSync('data/SPPG_alamat.json', 'utf8')), ...(fs.existsSync('data/SPPG_alamat_kab.json') ? JSON.parse(fs.readFileSync('data/SPPG_alamat_kab.json', 'utf8')) : [])];
const byNama = new Map(alamat.map((a) => [nrm(a.nama), a]));
const dasar = (s) => nrm(s).replace(/\s+\d+$/, '').replace(/\bSEMARANG\b/g, '').replace(/\s+/g, ' ').trim();
const terpakai = new Set();
function cariAlamat(namaSppg) {
  const persis = byNama.get(nrm(namaSppg));
  if (persis) { terpakai.add(persis); return { a: persis, perkiraan: false }; }
  const calon = alamat.filter((x) => dasar(x.nama) === dasar(namaSppg) && !terpakai.has(x));
  if (calon.length) { calon.sort((x, y) => x.nama.localeCompare(y.nama)); terpakai.add(calon[0]); return { a: calon[0], perkiraan: true }; }
  return null;
}
const baris = [['no_sppg', 'nama_sppg', 'alamat', 'kata_kunci', 'nama_osm', 'jarak_ke_kelurahan_km', 'lng_baru', 'lat_baru', 'hasil']];
const hitung = {};
const sasaran = data.features.filter((f) => f.properties.dipakai_analisis && f.properties.geo_akurasi !== 'jalan' && f.properties.geo_akurasi !== 'ruas_jalan' && f.properties.geo_akurasi !== 'tempat');
console.log(`SPPG yang diproses: ${sasaran.length}`);
let n = 0;
for (const f of sasaran) {
  n++;
  const p = f.properties, kel = [p.lng_kelurahan ?? f.geometry.coordinates[0], p.lat_kelurahan ?? f.geometry.coordinates[1]];
  p.lng_kelurahan = kel[0]; p.lat_kelurahan = kel[1];
  const ca = cariAlamat(p['Nama SPPG']);
  const a = ca ? ca.a : null;
  let pilih = null, kk = '';
  const nomor = a ? ((String(a.alamat).match(/\bNo\.?\s*(\d+[A-Za-z]?)/i) || [])[1] || '') : '';
  const daftar = a ? kataKunci(a.alamat) : [];
  for (const k of daftar) {
    for (const kata of [k.kata, ...(k.lain || [])]) {
      try { pilih = await cariKata({ ...k, kata }, kel, nomor); } catch (e) { console.log('  error', e.message); }
      if (pilih) { kk = `${k.jenis}:${kata}${pilih.tepat ? ' (no ' + nomor + ')' : ''}${ca.perkiraan ? ' [alamat perkiraan]' : ''}`; pilih.jenis = k.jenis; break; }
    }
    if (pilih) break;
  }
  let hasil = 'tetap_kelurahan';
  if (pilih) {
    f.geometry.coordinates = pilih.xy;
    p.geo_sumber = 'osm_overpass';
    p.geo_akurasi = pilih.jenis === 'jalan' ? 'ruas_jalan' : 'tempat';
    hasil = p.geo_akurasi;
  }
  hitung[hasil] = (hitung[hasil] || 0) + 1;
  baris.push([p['No SPPG'], p['Nama SPPG'], a ? a.alamat : '', kk, pilih ? pilih.nama : '', pilih ? pilih.jarak.toFixed(2) : '', pilih ? pilih.xy[0] : '', pilih ? pilih.xy[1] : '', hasil]);
  console.log(`[${n}/${sasaran.length}] ${p['Nama SPPG']} -> ${hasil}${pilih ? ` (${pilih.jarak.toFixed(2)} km, ${pilih.nama || ''})` : ''}`);
}

// ================= penulisan hasil dan ringkasan =================
fs.writeFileSync('data/SPPG_geocoded.geojson', JSON.stringify(data));
fs.writeFileSync('data/SPPG_overpass_laporan.csv', '﻿' + baris.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'));
const unik = new Set(data.features.filter((f) => f.properties.dipakai_analisis).map((f) => f.geometry.coordinates.slice(0, 2).join(','))).size;
console.log('\nSelesai.', JSON.stringify(hitung), '| titik unik SPPG:', unik);
