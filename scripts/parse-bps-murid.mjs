// Skrip sekali jalan: mengurai tabel jumlah murid per kecamatan dari teks hasil ekstraksi PDF
// "Kota Semarang Dalam Angka 2026" (BPS), tabel 4.1.3 sampai 4.1.9, tahun ajaran 2025/2026 (semester ganjil).
//
//   node scripts/parse-bps-murid.mjs <berkas-teks-hasil-ekstraksi.txt>
//
// Berkas teks dibuat dari PDF (teks per halaman dengan penanda "=====HALAMAN n=====").
// Keluaran: data/murid_bps_2025.json -> {sumber, tahun_ajaran, data:[{jenjang,kecamatan,negeri,swasta,jumlah}], total_kota:{...}}

import fs from 'node:fs';

// ================= pengaturan: tabel BPS yang dibaca dan daftar kecamatan Kota Semarang =================
const TABEL = { '4.1.3': 'SD', '4.1.4': 'MI', '4.1.5': 'SMP', '4.1.6': 'MTs', '4.1.7': 'SMA', '4.1.8': 'SMK', '4.1.9': 'MA' };
const KEC = ['Mijen', 'Gunung Pati', 'Banyumanik', 'Gajah Mungkur', 'Semarang Selatan', 'Candisari', 'Tembalang', 'Pedurungan', 'Genuk', 'Gayamsari', 'Semarang Timur', 'Semarang Utara', 'Semarang Tengah', 'Semarang Barat', 'Tugu', 'Ngaliyan'];
const angka = (t) => (t === '–' || t === '-' ? 0 : parseInt(t.replace(/\./g, ''), 10));

// ================= pembacaan teks dan pemisahan per halaman =================
const teks = fs.readFileSync(process.argv[2], 'utf8');
const halaman = teks.split(/=====HALAMAN \d+=====/).slice(1);

// ================= pengambilan baris tiap kecamatan dari halaman yang memuat blok "Murid/ Pupils" tiap tabel =================
const data = [], totalKota = {};
for (const [no, jenjang] of Object.entries(TABEL)) {
  // halaman lanjutan tabel yang memuat blok Murid; tabel Kemendikbud punya 6 angka (2024/2025 & 2025/2026), tabel Kemenag punya 3 angka
  const hal = halaman.find((h) => new RegExp(`Continued Table\\s+${no.replace('.', '\\.')}`).test(h) && /Murid\/\s*Pupils/.test(h));
  if (!hal) { console.error('Blok murid tidak ditemukan untuk', jenjang); process.exit(1); }
  for (const baris of hal.split('\n')) {
    const m = baris.trim().match(/^(Kota Semarang|[A-Za-z ]+?)\s+((?:[\d.]+|–|-)(?:\s+(?:[\d.]+|–|-))+)\s*$/);
    if (!m) continue;
    const nama = m[1].trim();
    if (nama !== 'Kota Semarang' && !KEC.includes(nama)) continue;
    const n = m[2].trim().split(/\s+/).map(angka);
    let negeri, swasta, jumlah;
    if (n.length === 6) { negeri = n[1]; swasta = n[3]; jumlah = n[5]; }   // ambil kolom 2025/2026
    else if (n.length === 3) { negeri = n[0]; swasta = n[1]; jumlah = n[2]; }
    else continue;
    if (nama === 'Kota Semarang') totalKota[jenjang] = { negeri, swasta, jumlah };
    else data.push({ jenjang, kecamatan: nama, negeri, swasta, jumlah });
  }
}

// ================= pemeriksaan: tiap jenjang harus punya 16 kecamatan dan jumlah kecamatan = total kota =================
let ok = true;
for (const j of Object.values(TABEL)) {
  const baris = data.filter((d) => d.jenjang === j);
  const sum = baris.reduce((a, d) => a + d.jumlah, 0);
  const sama = sum === totalKota[j].jumlah;
  const negeriSwasta = baris.every((d) => d.negeri + d.swasta === d.jumlah);
  console.log(`${j.padEnd(4)} kecamatan: ${baris.length} | jumlah kecamatan: ${sum} | total kota BPS: ${totalKota[j].jumlah} | ${sama ? 'COCOK' : 'TIDAK COCOK'} | negeri+swasta=jumlah: ${negeriSwasta}`);
  if (baris.length !== 16 || !sama || !negeriSwasta) ok = false;
}
fs.writeFileSync('data/murid_bps_2025.json', JSON.stringify({
  sumber: 'BPS Kota Semarang, Kota Semarang Dalam Angka 2026, tabel 4.1.3-4.1.9 (data semester ganjil, Dapodik Kemendikdasmen dan EMIS Kemenag)',
  tahun_ajaran: '2025/2026', data, total_kota: totalKota,
}, null, 1));
console.log(ok ? 'Semua pemeriksaan lolos. Ditulis ke data/murid_bps_2025.json' : 'ADA PEMERIKSAAN YANG GAGAL');
process.exitCode = ok ? 0 : 2;
