// Skrip sekali jalan: mengambil alamat jalan tiap SPPG di Kota Semarang dari direktori publik infosppg.id
// (sumber pihak ketiga, bukan BGN). Tiap kartu memuat nama, alamat, dan "ID: #nomor" (sama dengan kolom No SPPG).
//
//   node scripts/ambil-alamat-sppg.mjs
//
// Keluaran: data/SPPG_alamat.json  -> [{id, nama, alamat, halaman}, ...]

import fs from 'node:fs';

// ================= pengaturan: alamat direktori, jumlah halaman, dan jeda sopan antar permintaan =================
// ================= memperbaiki alamat tetap Kota Semarang menjadi bisa memilih direktori Kabupaten Semarang lewat opsi --kab (SPPG Ungaran dan sekitarnya tercatat di sana), dengan berkas keluaran terpisah =================
const KAB = process.argv.includes('--kab');
const BASE = KAB ? 'https://infosppg.id/direktori-sppg/jawa-tengah/semarang' : 'https://infosppg.id/direktori-sppg/jawa-tengah/kota-semarang';
const KELUARAN = KAB ? 'data/SPPG_alamat_kab.json' : 'data/SPPG_alamat.json';
const USER_AGENT = 'sppg-latihan-alamat/1.0';
const JEDA_MS = 1500;
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const bersih = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&bull;/g, '•').replace(/\s+/g, ' ').trim();

// ================= penarikan satu halaman lalu pemisahan kartu SPPG (nama, alamat, ID) =================
async function ambilHalaman(n) {
  const res = await fetch(`${BASE}?page=${n}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} (halaman ${n})`);
  const html = await res.text();
  const kartu = html.split('<h3 class="text-base font-extrabold').slice(1);
  return kartu.map((k) => {
    const nama = bersih(k.slice(k.indexOf('>') + 1, k.indexOf('</h3>')));
    const alamat = (k.match(/line-clamp-2[^>]*>([\s\S]*?)<\/p>/) || [])[1];
    const id = (k.match(/ID:\s*#(\d+)/) || [])[1];
    return { id: id ?? null, nama, alamat: alamat ? bersih(alamat) : null, halaman: n };
  });
}

// ================= perulangan semua halaman sampai tidak ada kartu lagi =================
const semua = [];
for (let n = 1; n <= 30; n++) {
  const data = await ambilHalaman(n);
  if (data.length === 0) break;
  semua.push(...data);
  console.log(`halaman ${n}: ${data.length} SPPG (total ${semua.length})`);
  await tidur(JEDA_MS);
}

// ================= penulisan hasil dan pemeriksaan sederhana (ID kosong, alamat kosong, ID ganda) =================
fs.writeFileSync(KELUARAN, JSON.stringify(semua, null, 1));
const idGanda = semua.length - new Set(semua.map((s) => s.id)).size;
console.log(`Selesai: ${semua.length} SPPG | tanpa ID: ${semua.filter((s) => !s.id).length} | tanpa alamat: ${semua.filter((s) => !s.alamat).length} | ID ganda: ${idGanda}`);
