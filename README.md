# WebGIS SPPG Kota Semarang

Dashboard WebGIS untuk menjawab satu pertanyaan: **apakah dapur SPPG (Satuan Pelayanan Pemenuhan Gizi) di Kota Semarang sudah menjangkau dan mencukupi sekolah di sekitarnya, dan di mana lokasi SPPG baru paling berguna?**

**Demo:** https://arsyadika.github.io/Arsya-Dika_WEBGIS_SPPG_Final-Project/

![Dashboard ringkasan kota](docs/screenshot/dashboard.png)

## Temuan utama

Dengan aturan resmi BGN yang dipakai proyek ini (maksimal 3.000 porsi per SPPG per hari dan waktu tempuh maksimal 30 menit):

| Ukuran | Hasil |
|---|---|
| Siswa yang sekolahnya berada dalam 10 menit berkendara dari satu SPPG atau lebih | **99,3%** (1.032 dari 1.042 sekolah) |
| Kapasitas terpakai di seluruh kota | **79%** (292.425 dari 369.000 porsi per hari) |
| Siswa yang tidak tertampung kuota SPPG mana pun dalam 30 menit | **0** |
| Sekolah di luar area 10 menit dari SPPG mana pun | **10 sekolah** (2.070 siswa) |
| Lokasi SPPG baru yang cukup untuk menutup 10 sekolah itu | **5 lokasi** |
| Waktu tempuh ke SPPG tercepat | median 2,5 menit, persentil 90 5,0 menit, maksimum 17,4 menit |

Artinya, **kapasitas secara keseluruhan sudah mencukupi**, dan kebutuhan lokasi baru muncul karena **jangkauan**, bukan karena kekurangan dapur: sepuluh sekolah di tepi kota berada lebih jauh dari 10 menit dari SPPG mana pun. Batas 10 menit adalah ukuran internal yang lebih ketat dari batas BGN (20–30 menit); tidak ada sekolah yang lebih dari 17,4 menit dari SPPG terdekat.

Catatan alokasi: SPPG yang penuh melepas sekolah ke SPPG terdekat berikutnya, sehingga sebagian sekolah dilayani SPPG yang bukan tercepat. Rata-rata waktu tempuh siswa 3,5 menit, tetapi 38 sekolah dilayani SPPG yang berjarak lebih dari 10 menit (terjauh 23 menit, masih di bawah 30).

![Kandidat lokasi SPPG baru](docs/screenshot/kandidat.png)

## Fitur

- **Mudah dipahami pengunjung baru**: kartu pengantar dengan pertanyaan yang dijawab, legenda permanen, temuan utama otomatis, dan tur 5 langkah. Tampilan juga disesuaikan untuk layar ponsel.
- Peta sekolah (SD/MI, SMP/MTs, SMA/SMK/MA; madrasah berpinggiran putih) dan titik SPPG hitam, dengan basemap gelap, jalan, dan satelit. Ukuran titik mengikuti jumlah siswa dan zoom.
- **Area jangkauan (isochrone) dinamis**: slider waktu tempuh 1–10 menit dari data multi-waktu (tanpa memanggil API dari browser).
- **Alokasi berkapasitas berbasis waktu tempuh**: pasangan SPPG–sekolah diproses dari waktu tempuh terpendek; tiap SPPG mengambil sekolah terdekatnya sampai kuota 3.000 per hari penuh, lalu sisa sekolah diambil SPPG terdekat lain yang masih punya kuota, semuanya maksimal 30 menit.
- **Sekolah jauh**: sekolah di luar area 10 menit diberi cincin merah (cincin lebih besar bila tidak tertampung), dengan filter "hanya sekolah jauh" untuk menimbang lokasi SPPG baru.
- **Usulan SPPG baru**: pencarian serakah dari 150 calon lokasi, dinilai dengan waktu tempuh dan kapasitas, lengkap dengan alasan tiap lokasi; jumlah paling sedikit yang menutup semua sekolah jauh tampil otomatis.
- Dashboard ringkasan kota: empat angka kunci, sekolah terjauh dari SPPG pelayannya, sebaran kapasitas terpakai, manfaat membangun SPPG baru, dan kualitas data.

## Cara kerja singkat

1. **Data sekolah**: daftar sekolah resmi Kota Semarang (NPSN dan koordinat) dari referensi Kemendikdasmen.
2. **Jumlah siswa**: tabel murid per kecamatan dari BPS *Kota Semarang Dalam Angka 2026* (tahun ajaran 2025/2026), dibagi rata ke sekolah pada kelompok yang sama (jenjang, kecamatan, negeri/swasta).
3. **Titik SPPG**: koordinat diperbaiki bertahap (geocoding kelurahan, lalu pencarian nama jalan di OpenStreetMap lewat Overpass), lalu ditandai mana yang dipakai analisis.
4. **Waktu tempuh**: isochrone 1–10 menit, matriks SPPG ke sekolah, dan matriks calon kandidat ke sekolah dihitung dari OpenRouteService (profil mobil) dan disimpan sebagai berkas statis.
5. **Aplikasi** memuat berkas statis itu dan menghitung cakupan, alokasi, serta kandidat langsung di browser (MapLibre GL JS, Turf.js, Chart.js). Tidak ada server dan tidak ada API key di sisi browser.

## Keterbatasan data (baca sebelum memakai angkanya)

- **Jumlah siswa adalah estimasi.** BPS hanya menyediakan angka per kecamatan, jadi siswa dibagi rata antar sekolah. Sekolah besar dan kecil dianggap sama.
- **Kapasitas dan jangkauan memakai acuan BGN yang belum diverifikasi ulang ke dokumen resminya.** Kapasitas 3.000 per SPPG per hari dan batas 20–30 menit berasal dari pemberitaan dan salinan petunjuk teknis. Skenario 2.000 dan 2.500 tersedia di tab Atur; pada 2.000, sekitar 50.000 siswa tidak tertampung, jadi angka kecukupan sangat bergantung pada asumsi kapasitas.
- **Satu siswa dianggap satu porsi**, dan satu sekolah tidak dipecah ke beberapa SPPG.
- **Titik SPPG tidak seluruhnya presisi.** Dari 123 SPPG yang dipakai (120 titik unik): 80 di jalan, 23 di ruas jalan OSM, 7 di tempat bernama, dan **13 masih berupa titik kelurahan** (pencarian OSM gagal atau tidak menemukan alamatnya; 4 di antaranya di Kabupaten Semarang).
- **Cakupan sekolah hanya Kota Semarang.** Beberapa SPPG di Kabupaten Semarang (Ungaran) ikut dihitung karena dekat perbatasan, tetapi sekolah di kabupaten itu tidak dimuat.
- **Kandidat dipilih dari 150 calon lokasi** (titik sekolah, jarak minimal 1 km antar calon dan 300 m dari SPPG yang ada), bukan dari seluruh kota. Hasilnya petunjuk awal, bukan rekomendasi penempatan final.
- Daftar alamat SPPG berasal dari direktori pihak ketiga (infosppg.id), bukan dari BGN.

## Teknologi

HTML, CSS, JavaScript tanpa kerangka kerja; MapLibre GL JS 4.7, Turf.js 7, Chart.js 4.4, Tailwind (CDN). Data jalan dan waktu tempuh: OpenStreetMap dan OpenRouteService. Skrip pengolah data memakai Node.js.

## Cara menjalankan

Aplikasi statis. Dari folder proyek jalankan server lokal, lalu buka `index.html`:

```
python -m http.server 8000
```

Buka http://localhost:8000/index.html (atau pakai ekstensi Live Server).

### Menghitung ulang data (opsional)

Hasil sudah tersimpan di folder `data/`, jadi langkah ini hanya perlu bila titik SPPG atau sekolah berubah. Butuh Node.js 18+ dan berkas `.env` berisi `ORS_API_KEY=...` (tidak ikut ter-commit).

```
node scripts/fetch-isochrones-multi.mjs   # isochrone 1-10 menit tiap titik SPPG
node scripts/fetch-matriks-waktu.mjs      # waktu tempuh SPPG -> sekolah
node scripts/pilih-kandidat.mjs           # pilih 150 calon lokasi baru
node scripts/fetch-matriks-kandidat.mjs   # waktu tempuh calon -> sekolah
```

Skrip lain di `scripts/` (pengambilan sekolah, alamat SPPG, geocoding, penguraian tabel BPS) dijalankan sekali saat membangun data; urutan dan keluarannya dijelaskan pada komentar di awal tiap skrip.

## Catatan belajar

Proyek ini dikerjakan sambil belajar. Setiap perbaikan dan keputusan dicatat dengan format masalah, perubahan, alasan, hasil, dan pelajaran di [docs/catatan-belajar.md](docs/catatan-belajar.md). Riwayat commit mengikuti catatan itu.

## Author

Arsya Dika
