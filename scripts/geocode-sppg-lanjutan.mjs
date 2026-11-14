// Skrip sekali jalan (tahap lanjutan): memperhalus SPPG yang MASIH berakurasi 'kelurahan' setelah geocode-sppg-overpass.mjs,
// dengan Nominatim terstruktur (jalan + nomor, varian ejaan, nama tempat/dusun, dibatasi kotak sekitar titik kelurahan) lalu Overpass longgar sebagai cadangan.
//
//   node scripts/geocode-sppg-lanjutan.mjs
//
// Masukan : data/SPPG_geocoded.geojson, data/SPPG_alamat.json, data/SPPG_alamat_kab.json
// Keluaran: data/SPPG_geocoded.kandidat.geojson (salinan lengkap; HANYA yang berhasil diubah), data/SPPG_lanjutan_laporan.csv
// data/SPPG_geocoded.geojson TIDAK diubah; kandidat dipindah ke berkas utama hanya setelah ditinjau.

import fs from 'node:fs';

// ================= pengaturan: jeda (Nominatim maks 1 permintaan/detik), batas kewajaran 3 km dari titik kelurahan, jarak minimal agar dianggap titik baru =================
const NOM = 'https://nominatim.openstreetmap.org/search';
const OVP = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter'];
const UA = 'sppg-latihan-geocoder/1.0';
const JEDA_NOM = 1600, JEDA_OVP = 4000, BATAS_KM = 3, MIN_BEDA_M = 10, KOTAK = 0.04;
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const nrm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\bKOTA\b/g, '').replace(/\s+/g, ' ').trim();
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembacaan data dan pencocokan alamat (sama dengan skrip sebelumnya: nama persis, lalu nama dasar tanpa angka akhir) =================
const data = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8'));
const alamat = [...JSON.parse(fs.readFileSync('data/SPPG_alamat.json', 'utf8')), ...JSON.parse(fs.readFileSync('data/SPPG_alamat_kab.json', 'utf8'))];
const byNama = new Map(alamat.map((a) => [nrm(a.nama), a]));
const dasar = (s) => nrm(s).replace(/\s+\d+$/, '').replace(/\bSEMARANG\b/g, '').replace(/\s+/g, ' ').trim();
const terpakai = new Set();
// alamat yang sudah dipakai SPPG lain (yang tidak ikut diproses) dicatat dulu agar tidak diambil ulang
data.features.forEach((f) => { const a = byNama.get(nrm(f.properties['Nama SPPG'])); if (a && !(f.properties.dipakai_analisis && f.properties.geo_akurasi === 'kelurahan')) terpakai.add(a); });
function cariAlamat(nama) {
  const persis = byNama.get(nrm(nama));
  if (persis) { terpakai.add(persis); return persis; }
  const calon = alamat.filter((x) => dasar(x.nama) === dasar(nama) && !terpakai.has(x));
  if (calon.length) { calon.sort((x, y) => x.nama.localeCompare(y.nama)); terpakai.add(calon[0]); return { ...calon[0], perkiraan: true }; }
  return null;
}

// ================= pembuatan varian pencarian dari alamat: nama jalan (beberapa ejaan), nomor, nama tempat/dusun =================
const SINGKAT = [[/\bJend\.?\b/gi, 'Jenderal'], [/\bKol\.?\b/gi, 'Kolonel'], [/\bProf\.?\b/gi, 'Profesor'], [/\bTm\.?\b/gi, 'Taman'], [/\bGg\.?\b/gi, 'Gang'], [/\bSlt\b/gi, 'Selatan']];
function ekstrak(a, kab) {
  const t = String(a.alamat || '');
  const nomor = (t.match(/\bNo\.?\s*(\d+[A-Za-z]?)/i) || [])[1] || '';
  const jalanKasar = [];
  for (const m of t.matchAll(/\b(?:Jl|Jln|Jalan|Gg|Gang|Tm)\.?\s+([A-Za-z0-9 .']+?)(?=\s+(?:No|Rt|Rw|Kel|Kec|Km|Blok|Kav|Kota|Slt)\b|\s+\d|,|$)/gi)) jalanKasar.push(m[1].trim());
  if (/^Tm\./i.test(t)) { const m = t.match(/^Tm\.\s+([A-Za-z ]+?)(?:\s+Slt|\s+No|,)/i); if (m) jalanKasar.push('Taman ' + m[1]); }
  const varian = new Set();
  for (const j0 of jalanKasar) {
    let j = j0;
    SINGKAT.forEach(([re, s]) => { j = j.replace(re, s); });
    for (const nama of new Set([j, j0, j.replace(/\bRaya\b/i, '').trim(), j.endsWith('Raya') ? j : j + ' Raya', j.replace(/\b(Utara|Selatan|Barat|Timur)\b/i, '').trim()])) if (nama.length >= 4) varian.add(nama);
  }
  const tempat = [];
  for (const seg of t.split(',')) if (/(technopark|perum|kawasan|komplek|taman|dusun|dsn|dukuh|kajangan|regency|puri)/i.test(seg)) tempat.push(seg.replace(/\b(Rt|Rw)\.?\s*\d+(\s*\/\s*\d+)?/gi, '').replace(/\b(Dapur \d+|Kawasan)\b/gi, '').replace(/\s+/g, ' ').trim());
  return { nomor, varian: [...varian], tempat, kab };
}

// ================= satu permintaan Nominatim dengan kotak pembatas di sekitar titik kelurahan =================
async function nominatim(params, kel) {
  const [lng, lat] = kel;
  const u = new URL(NOM);
  Object.entries({ format: 'jsonv2', limit: 5, countrycodes: 'id', viewbox: `${lng - KOTAK},${lat + KOTAK},${lng + KOTAK},${lat - KOTAK}`, bounded: 1, ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'id' } });
      await tidur(JEDA_NOM);
      if (res.status === 429) { await tidur(30000); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) { if (i === 3) { console.log('  nominatim gagal:', e.message); return []; } await tidur(5000 * i); }
  }
  return [];
}
// pilih hasil terdekat ke titik kelurahan yang masuk akal (jalan/bangunan/tempat), dalam batas 3 km
function pilihHasil(rs, kel) {
  let b = null;
  for (const r of rs) {
    const xy = [Number(r.lon), Number(r.lat)], jr = jarakKm(xy, kel);
    if (jr > BATAS_KM) continue;
    if (r.category === 'boundary' || r.category === 'place' && /^(suburb|village|neighbourhood|quarter|city|town)$/.test(r.type)) continue;   // wilayah = bukan titik jalan
    if (!b || jr < b.jarak) b = { xy, jarak: jr, nama: r.display_name.split(',').slice(0, 2).join(','), tipe: `${r.category}/${r.type}` };
  }
  return b;
}

// ================= Overpass longgar sebagai cadangan (ruas jalan bernama mirip dalam radius 4 km), dengan percobaan ulang terbatas =================
async function overpass(q) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(OVP[i % 2], { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
      if (res.ok) { const d = await res.json(); if (!(d.remark && /runtime error|timed out|out of memory/i.test(d.remark))) { await tidur(JEDA_OVP); return d; } }
    } catch { /* ulang */ }
    await tidur(10000 * (i + 1));
  }
  return null;
}
async function overpassLonggar(nama, kel, nomor) {
  const kata = nrm(nama).split(' ').filter((w) => w.length >= 4 && !['JALAN', 'RAYA', 'TIMUR', 'BARAT', 'UTARA', 'SELATAN', 'TAMAN'].includes(w)).sort((x, y) => y.length - x.length)[0];
  if (!kata) return null;
  const [lng, lat] = kel;
  if (nomor) {
    const dn = await overpass(`[out:json][timeout:60];nwr["addr:housenumber"="${nomor}"]["addr:street"~"${kata}",i](around:4000,${lat},${lng});out center;`);
    let b = null;
    for (const e of (dn && dn.elements) || []) { const p = e.center ? [e.center.lon, e.center.lat] : [e.lon, e.lat]; const jr = jarakKm(p, kel); if (jr <= BATAS_KM && (!b || jr < b.jarak)) b = { xy: p, jarak: jr, nama: `${e.tags['addr:street']} no ${nomor}`, tipe: 'osm/housenumber' }; }
    if (b) return b;
  }
  const d = await overpass(`[out:json][timeout:60];way["highway"]["name"~"${kata}",i](around:4000,${lat},${lng});out geom;`);
  let b = null;
  for (const e of (d && d.elements) || []) for (const p of (e.geometry || []).map((g) => [g.lon, g.lat])) { const jr = jarakKm(p, kel); if (jr <= BATAS_KM && (!b || jr < b.jarak)) b = { xy: p, jarak: jr, nama: e.tags && e.tags.name, tipe: 'osm/highway' }; }
  return b;
}

// ================= perulangan: per SPPG coba strategi berurutan dari yang paling tepat; berhenti di strategi pertama yang berhasil =================
const sasaran = data.features.filter((f) => f.properties.dipakai_analisis && f.properties.geo_akurasi === 'kelurahan');
console.log('SPPG diproses:', sasaran.length);
const baris = [['no_sppg', 'nama', 'alamat_dipakai', 'strategi', 'hasil_osm', 'tipe', 'akurasi_lama', 'akurasi_baru', 'pindah_m', 'lng_baru', 'lat_baru']];
const ringkas = {};
let n = 0;
for (const f of sasaran) {
  n++;
  const p = f.properties, lama = f.geometry.coordinates.slice(0, 2);
  const kel = [p.lng_kelurahan ?? lama[0], p.lat_kelurahan ?? lama[1]];
  const a = p.alamat ? { alamat: p.alamat } : cariAlamat(p['Nama SPPG']);
  const kab = /Ungaran|Kab\./i.test(p['Nama SPPG'] + (a ? a.alamat : '')) && !/Kota Semarang/i.test(a ? a.alamat : '');
  const kota = kab ? 'Kabupaten Semarang' : 'Kota Semarang';
  const kelNama = String(p['Desa/Kelurahan SPPG'] || '');
  let pilih = null, strategi = '';
  if (a) {
    const e = ekstrak(a, kab);
    // 1) jalan + nomor (terstruktur), 2) jalan saja (terstruktur), 3) teks bebas jalan + kelurahan
    outer: for (const nama of e.varian) {
      const coba = [];
      if (e.nomor) coba.push([`terstruktur jalan+no "${e.nomor} ${nama}"`, { street: `${e.nomor} ${nama}`, city: kab ? 'Semarang' : 'Semarang' }]);
      coba.push([`terstruktur jalan "${nama}"`, { street: nama, city: 'Semarang' }]);
      coba.push([`teks "${nama}, ${kelNama}"`, { q: `${nama}, ${kelNama}, ${kota}` }]);
      for (const [label, par] of coba) { const r = pilihHasil(await nominatim(par, kel), kel); if (r) { pilih = r; strategi = label; break outer; } }
    }
    if (!pilih) for (const t of e.tempat) { const r = pilihHasil(await nominatim({ q: `${t}, ${kelNama}, ${kota}` }, kel), kel); if (r) { pilih = r; strategi = `tempat "${t}"`; break; } }
    if (!pilih) for (const nama of e.varian.slice(0, 2)) { const r = await overpassLonggar(nama, kel, e.nomor); if (r) { pilih = r; strategi = `overpass longgar "${nama}"`; break; } }
  }
  let akurasiBaru = 'kelurahan', pindah = 0;
  if (pilih) {
    pindah = jarakKm(pilih.xy, lama) * 1000;
    if (pindah < MIN_BEDA_M) { pilih = null; strategi += ' (sama dengan titik lama, ditolak)'; }
  }
  if (pilih) {
    akurasiBaru = /housenumber|house|building|amenity|shop|office|man_made|landuse|place/i.test(pilih.tipe) ? 'tempat' : 'jalan';
    if (/housenumber/.test(pilih.tipe)) akurasiBaru = 'jalan';
    f.geometry.coordinates = pilih.xy;
    p.lng_kelurahan = kel[0]; p.lat_kelurahan = kel[1];
    p.geo_sumber = /overpass/.test(strategi) ? 'osm_overpass' : 'nominatim_lanjutan';
    p.geo_akurasi = akurasiBaru;
    p.geo_jarak_cek_km = Number(pilih.jarak.toFixed(2));
  }
  ringkas[akurasiBaru] = (ringkas[akurasiBaru] || 0) + 1;
  baris.push([p['No SPPG'], p['Nama SPPG'], a ? a.alamat : '(tidak ada alamat)', strategi || 'gagal', pilih ? pilih.nama : '', pilih ? pilih.tipe : '', 'kelurahan', akurasiBaru, Math.round(pindah), pilih ? pilih.xy[0] : '', pilih ? pilih.xy[1] : '']);
  console.log(`[${n}/${sasaran.length}] ${p['Nama SPPG']} -> ${akurasiBaru}${pilih ? ` (${Math.round(pindah)} m; ${strategi})` : ''}`);
}

fs.writeFileSync('data/SPPG_geocoded.kandidat.geojson', JSON.stringify(data));
fs.writeFileSync('data/SPPG_lanjutan_laporan.csv', '﻿' + baris.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'));
console.log('\nSelesai.', JSON.stringify(ringkas));
