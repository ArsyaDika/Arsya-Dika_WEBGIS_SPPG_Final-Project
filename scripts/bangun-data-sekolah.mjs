// Skrip sekali jalan: menggabungkan daftar sekolah resmi Kemendikdasmen (NPSN + koordinat) dengan jumlah murid BPS
// per kecamatan (tahun ajaran 2025/2026) menjadi satu berkas peta sekolah.
//
//   node scripts/bangun-data-sekolah.mjs
//
// Masukan : data/sekolah_resmi.json, data/murid_bps_2025.json, data/SD|SMP|SMA.geojson (hanya untuk menyelamatkan koordinat yang hilang)
// Keluaran: data/sekolah.geojson (FeatureCollection titik) dan data/sekolah_laporan.json (ringkasan pemeriksaan)
//
// Aturan jumlah murid: murid BPS per (jenjang, kecamatan, status negeri/swasta) dibagi rata ke sekolah resmi pada kelompok yang sama.
// Jadi total per kecamatan persis sama dengan BPS, tetapi variasi antar sekolah dalam kelompok itu tidak diketahui.

import fs from 'node:fs';

// ================= pengaturan: jenjang yang dipakai (sesuai tabel BPS) dan kotak wajar Kota Semarang =================
const JENJANG = ['SD', 'MI', 'SMP', 'MTs', 'SMA', 'SMK', 'MA'];
const KOTAK = { lngMin: 110.20, lngMax: 110.55, latMin: -7.20, latMax: -6.85 };
const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const kecNorm = (k) => String(k).replace(/^Kec\.\s*/i, '').trim();
const statusNorm = (s) => (/NEGERI/i.test(s) ? 'negeri' : 'swasta');

// ================= pembacaan data: sekolah resmi, murid BPS, dan titik sekolah lama (cadangan koordinat) =================
const resmi = JSON.parse(fs.readFileSync('data/sekolah_resmi.json', 'utf8'));
const bps = JSON.parse(fs.readFileSync('data/murid_bps_2025.json', 'utf8'));
const lama = ['SD', 'SMP', 'SMA'].flatMap((j) => JSON.parse(fs.readFileSync(`data/${j}.geojson`, 'utf8')).features);
const lamaPerNama = new Map();
lama.forEach((f) => { const k = norm(f.properties.NAMA); if (!lamaPerNama.has(k)) lamaPerNama.set(k, []); lamaPerNama.get(k).push(f); });

// ================= perbaikan koordinat: tanda lintang terbalik, di luar kotak kota, atau hilang (cadangan dari data lama lewat nama) =================
const dalam = (lat, lng) => lat >= KOTAK.latMin && lat <= KOTAK.latMax && lng >= KOTAK.lngMin && lng <= KOTAK.lngMax;
const tambahan = fs.existsSync('data/sekolah_geocode_tambahan.json') ? JSON.parse(fs.readFileSync('data/sekolah_geocode_tambahan.json', 'utf8')) : {};
const laporan = { diperbaiki_tanda: 0, diselamatkan_dari_data_lama: 0, dari_geocode_tambahan: 0, tanpa_koordinat: [], di_luar_kota: [] };
const sekolah = resmi.filter((s) => JENJANG.includes(s.bentuk)).map((s) => {
  let { lat, lng } = s, sumber = 'resmi';
  if (lat != null && lng != null && !dalam(lat, lng) && dalam(-Math.abs(lat), lng)) { lat = -Math.abs(lat); laporan.diperbaiki_tanda++; sumber = 'resmi_tanda_diperbaiki'; }
  if (lat != null && lng != null && !dalam(lat, lng)) { laporan.di_luar_kota.push(s.nama); lat = null; lng = null; }
  if (lat == null || lng == null) {
    const cocok = (lamaPerNama.get(norm(s.nama)) || []).filter((f) => norm(f.properties.DESA) === norm(s.kelurahan));
    if (cocok.length === 1) { [lng, lat] = cocok[0].geometry.coordinates; sumber = 'data_lama_by_nama'; laporan.diselamatkan_dari_data_lama++; }
  }
  // ================= memperbaiki sekolah tanpa koordinat menjadi memakai hasil geocoding tambahan (data/sekolah_geocode_tambahan.json) sebagai cadangan terakhir agar sekolah itu tetap muncul di peta dan beban SPPG =================
  if ((lat == null || lng == null) && tambahan[s.npsn] && tambahan[s.npsn].lat != null) { lat = tambahan[s.npsn].lat; lng = tambahan[s.npsn].lng; sumber = `geocode_${tambahan[s.npsn].akurasi}`; laporan.dari_geocode_tambahan++; }
  if (lat == null || lng == null) { laporan.tanpa_koordinat.push(`${s.bentuk} ${s.nama} (${kecNorm(s.kecamatan)})`); sumber = 'tanpa'; }
  return { ...s, kec: kecNorm(s.kecamatan), st: statusNorm(s.status), lat, lng, koordinat_sumber: sumber };
});

// ================= pembagian murid BPS ke sekolah: per (jenjang, kecamatan, status); kelompok tanpa sekolah dialihkan ke status lain di kecamatan yang sama =================
const kelompok = new Map(); // "jenjang|kec|status" -> [sekolah]
sekolah.forEach((s) => { const k = `${s.bentuk}|${s.kec}|${s.st}`; if (!kelompok.has(k)) kelompok.set(k, []); kelompok.get(k).push(s); });
const tidakTertampung = [];
for (const d of bps.data) {
  const kunciN = `${d.jenjang}|${d.kecamatan}|negeri`, kunciS = `${d.jenjang}|${d.kecamatan}|swasta`;
  const adaN = (kelompok.get(kunciN) || []).length, adaS = (kelompok.get(kunciS) || []).length;
  let negeri = d.negeri, swasta = d.swasta;
  if (!adaN && negeri) { if (adaS) { swasta += negeri; negeri = 0; } else { tidakTertampung.push(`${d.jenjang} ${d.kecamatan}: ${d.negeri} murid negeri tanpa sekolah`); negeri = 0; } }
  if (!adaS && swasta) { if (adaN) { negeri += swasta; swasta = 0; } else { tidakTertampung.push(`${d.jenjang} ${d.kecamatan}: ${d.swasta} murid swasta tanpa sekolah`); swasta = 0; } }
  for (const [kunci, total] of [[kunciN, negeri], [kunciS, swasta]]) {
    const isi = kelompok.get(kunci) || [];
    if (!isi.length) continue;
    const dasar = Math.floor(total / isi.length);
    let sisa = total - dasar * isi.length; // sisa pembulatan dibagikan satu-satu agar jumlah kelompok tepat
    isi.forEach((s) => { s.siswa = dasar + (sisa-- > 0 ? 1 : 0); });
  }
}
sekolah.forEach((s) => { if (s.siswa == null) s.siswa = 0; });

// ================= penulisan GeoJSON sekolah (hanya yang berkoordinat) dan laporan pemeriksaan total terhadap BPS =================
const fitur = sekolah.filter((s) => s.lat != null).map((s) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  properties: { NAMA: s.nama, jenjang: s.bentuk, NPSN: s.npsn, STATUS: s.status, ALAMAT: s.alamat, DESA: s.kelurahan, KECAMATAN: s.kec, siswa: s.siswa, sumber_siswa: 'bps_kecamatan_dibagi_rata', koordinat_sumber: s.koordinat_sumber },
}));
fs.writeFileSync('data/sekolah.geojson', JSON.stringify({ type: 'FeatureCollection', features: fitur }));
const ringkas = {};
for (const j of JENJANG) {
  const semua = sekolah.filter((s) => s.bentuk === j), peta = fitur.filter((f) => f.properties.jenjang === j);
  ringkas[j] = { sekolah_resmi: semua.length, di_peta: peta.length, murid_bps: bps.total_kota[j].jumlah, murid_teralokasi_semua: semua.reduce((a, s) => a + s.siswa, 0), murid_di_peta: peta.reduce((a, f) => a + f.properties.siswa, 0) };
}
fs.writeFileSync('data/sekolah_laporan.json', JSON.stringify({ ...laporan, tidak_tertampung: tidakTertampung, ringkas }, null, 1));
console.log('Sekolah di peta:', fitur.length, 'dari', sekolah.length, '| tanda diperbaiki:', laporan.diperbaiki_tanda, '| diselamatkan dari data lama:', laporan.diselamatkan_dari_data_lama, '| tanpa koordinat:', laporan.tanpa_koordinat.length, '| di luar kota:', laporan.di_luar_kota.length);
for (const j of JENJANG) { const r = ringkas[j]; console.log(`${j.padEnd(4)} resmi ${String(r.sekolah_resmi).padStart(3)} | di peta ${String(r.di_peta).padStart(3)} | murid BPS ${String(r.murid_bps).padStart(7)} | teralokasi ${String(r.murid_teralokasi_semua).padStart(7)} | di peta ${String(r.murid_di_peta).padStart(7)}`); }
if (tidakTertampung.length) console.log('Tidak tertampung:', tidakTertampung);
