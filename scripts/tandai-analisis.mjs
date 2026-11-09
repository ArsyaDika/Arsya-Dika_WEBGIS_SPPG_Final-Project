// Skrip sekali jalan: menandai SPPG mana yang dipakai dalam analisis cakupan.
// Aturan:
//   - koordinat tidak ditemukan saat geocoding            -> dikeluarkan
//   - di luar Kota Semarang DAN > 8 km dari sekolah terdekat -> dikeluarkan (tidak mungkin menjangkau sekolah dalam 10 menit)
//   - selain itu                                           -> dipakai
//
//   node scripts/tandai-analisis.mjs
//
// Menulis ulang data/SPPG_geocoded.geojson dengan properti dipakai_analisis + alasan_dikeluarkan.

import fs from 'node:fs';

// ================= pengaturan: batas jarak SPPG luar kota ke sekolah terdekat =================
const BATAS_LUAR_KOTA_KM = 8;

// ================= fungsi bantu: jarak dua titik (haversine, km) =================
function jarakKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ================= pembacaan data SPPG hasil geocoding dan titik semua sekolah =================
const FILE = 'data/SPPG_geocoded.geojson';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const sekolah = ['SD', 'SMP', 'SMA'].flatMap((n) => JSON.parse(fs.readFileSync(`data/${n}.geojson`, 'utf8')).features)
  .map((f) => f.geometry.coordinates.slice(0, 2));

// ================= penandaan tiap SPPG: dipakai atau dikeluarkan beserta alasannya =================
let dipakai = 0;
for (const f of data.features) {
  const p = f.properties;
  const dalamKota = /^KOTA/i.test(p['Kabupaten/Kota SPPG']);
  let alasan = '';
  if (p.geo_sumber === 'tidak_ditemukan') {
    alasan = 'koordinat tidak ditemukan saat geocoding';
  } else if (!dalamKota) {
    const terdekat = Math.min(...sekolah.map((s) => jarakKm(f.geometry.coordinates.slice(0, 2), s)));
    if (terdekat > BATAS_LUAR_KOTA_KM) alasan = `di luar kota dan ${terdekat.toFixed(1)} km dari sekolah terdekat (batas ${BATAS_LUAR_KOTA_KM} km)`;
  }
  p.dipakai_analisis = alasan === '';
  p.alasan_dikeluarkan = alasan;
  if (p.dipakai_analisis) dipakai++;
}

// ================= penulisan hasil dan ringkasan =================
fs.writeFileSync(FILE, JSON.stringify(data));
console.log(`Dipakai untuk analisis: ${dipakai} dari ${data.features.length} SPPG`);
for (const f of data.features.filter((x) => !x.properties.dipakai_analisis)) {
  console.log(' - dikeluarkan:', f.properties['Nama SPPG'], '|', f.properties.alasan_dikeluarkan);
}
