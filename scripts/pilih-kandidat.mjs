// Skrip sekali jalan: memilih 150 calon lokasi SPPG baru dari titik sekolah, agar aplikasi tidak perlu mengevaluasi semua 1.042 sekolah
// dan matriks waktu tempuh kandidat (scripts/fetch-matriks-kandidat.mjs) cukup 150 x 1.042 rute.
//
//   node scripts/pilih-kandidat.mjs
//
// Masukan : data/sekolah.geojson, data/SPPG_geocoded.geojson (yang dipakai_analisis), data/waktu-tempuh.json (waktu SPPG -> sekolah)
// Keluaran: data/kandidat-lokasi.json -> { aturan, kandidat:[{npsn,nama,xy,skor,beban,jauh,siswa2km,sppg2km}] }
//
// Pemilihan tidak bergantung pada kapasitas yang diketik pengguna: skor memakai kapasitas acuan 3.000 hanya untuk mengurutkan calon.
// Pilihan akhir (kapasitas yang sedang dipakai) tetap ditentukan aplikasi saat tombol kandidat dijalankan.

import fs from 'node:fs';

// ================= pengaturan: jumlah calon, jari-jari kepadatan, jarak minimal ke SPPG dan antar calon, ambang "jauh dari SPPG", kapasitas acuan =================
const JUMLAH = 150, RADIUS_M = 2000, JARAK_MIN_SPPG = 300, JARAK_MIN_KANDIDAT = 1000, AMBANG_JAUH_DETIK = 600, KAP_ACUAN = 3000;
const OUT = 'data/kandidat-lokasi.json';

function jarakM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dl = (b[1] - a[1]) * r, dg = (b[0] - a[0]) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dg / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ================= pembacaan data: sekolah (dengan jumlah siswa), titik SPPG unik (dengan jumlah SPPG per titik), dan waktu tempuh tercepat tiap sekolah ke SPPG =================
const sekolah = JSON.parse(fs.readFileSync('data/sekolah.geojson', 'utf8')).features;
const sppgF = JSON.parse(fs.readFileSync('data/SPPG_geocoded.geojson', 'utf8')).features.filter((f) => f.properties.dipakai_analisis);
const grup = new Map();
sppgF.forEach((f) => { const k = f.geometry.coordinates.slice(0, 2).join(','); grup.set(k, (grup.get(k) || 0) + 1); });
const titikSppg = [...grup.entries()].map(([k, n]) => ({ xy: k.split(',').map(Number), n }));
const w = JSON.parse(fs.readFileSync('data/waktu-tempuh.json', 'utf8'));
const kolom = new Map(w.npsn.map((n, j) => [String(n), j]));
const xy = sekolah.map((f) => f.geometry.coordinates.slice(0, 2));
const siswa = sekolah.map((f) => Number(f.properties.siswa) || 0);
const tTercepat = sekolah.map((f) => {
  const j = kolom.get(String(f.properties.NPSN));
  let m = Infinity;
  if (j != null) w.detik.forEach((b) => { if (b[j] != null && b[j] < m) m = b[j]; });
  return m;
});

// ================= penilaian tiap sekolah sebagai calon lokasi: beban = siswa dalam 2 km di atas kapasitas SPPG dalam 2 km; jauh = siswa dalam 2 km yang waktu tempuh ke SPPG tercepatnya lebih dari 10 menit =================
const calon = [];
xy.forEach((p, c) => {
  const terdekatSppg = Math.min(...titikSppg.map((t) => jarakM(p, t.xy)));
  if (terdekatSppg < JARAK_MIN_SPPG) return;                    // terlalu dekat dengan SPPG yang ada
  let s2 = 0, jauh = 0;
  xy.forEach((q, s) => { if (jarakM(p, q) <= RADIUS_M) { s2 += siswa[s]; if (tTercepat[s] > AMBANG_JAUH_DETIK) jauh += siswa[s]; } });
  const sppg2km = titikSppg.filter((t) => jarakM(p, t.xy) <= RADIUS_M).reduce((a, t) => a + t.n, 0);
  const beban = Math.max(0, s2 - sppg2km * KAP_ACUAN);
  calon.push({ c, skor: beban + 2 * jauh, beban, jauh, siswa2km: s2, sppg2km });
});

// ================= pemilihan serakah: ambil skor tertinggi, lewati yang berjarak kurang dari 1 km dari calon yang sudah terpilih =================
calon.sort((a, b) => b.skor - a.skor || b.siswa2km - a.siswa2km);   // skor sama (mis. 0): utamakan area yang lebih padat siswa, agar tetap berguna bila kapasitas diturunkan
const pilih = [];
for (const k of calon) {
  if (pilih.length >= JUMLAH) break;
  if (pilih.some((p) => jarakM(xy[k.c], xy[p.c]) < JARAK_MIN_KANDIDAT)) continue;
  pilih.push(k);
}

// ================= penulisan hasil dan ringkasan =================
const kandidat = pilih.map((k) => ({ npsn: String(sekolah[k.c].properties.NPSN), nama: sekolah[k.c].properties.NAMA, xy: xy[k.c], skor: Math.round(k.skor), beban: Math.round(k.beban), jauh: Math.round(k.jauh), siswa2km: k.siswa2km, sppg2km: k.sppg2km }));
fs.writeFileSync(OUT, JSON.stringify({ aturan: { jumlah: JUMLAH, radius_m: RADIUS_M, jarak_min_sppg_m: JARAK_MIN_SPPG, jarak_min_kandidat_m: JARAK_MIN_KANDIDAT, ambang_jauh_detik: AMBANG_JAUH_DETIK, kapasitas_acuan: KAP_ACUAN }, kandidat }));
console.log(`Calon memenuhi syarat: ${calon.length} | terpilih: ${kandidat.length}/${JUMLAH}`);
console.log(`Skor tertinggi ${kandidat[0].skor} (${kandidat[0].nama}), terendah ${kandidat[kandidat.length - 1].skor}`);
console.log(`Kandidat dengan skor 0: ${kandidat.filter((k) => k.skor === 0).length}`);
