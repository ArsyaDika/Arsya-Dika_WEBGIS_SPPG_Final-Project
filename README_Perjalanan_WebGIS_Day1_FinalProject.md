# Perjalanan MAPID WebGIS Academy 2026 (Batch 2): Day 1 sampai Final Project

**Peserta:** Muhammad Arsya Dika Maulana
**Final Project:** WebGIS Analisis Keterjangkauan dan Rekomendasi Lokasi SPPG di Kota Semarang
**Studi kasus berulang:** Kota Semarang (fasilitas kesehatan, sosial-ekonomi, jalan, sekolah, SPPG)

Dokumen ini merangkum seluruh tahapan belajar secara berurutan, dari dasar GIS sampai WebGIS interaktif. Setiap tahap berisi tujuan, apa yang dikerjakan, dan lokasi berkasnya.

---

## Ringkasan Alur

| Tahap | Hari / Sesi | Topik | Tools | Folder |
|---|---|---|---|---|
| 1 | Day 1-3 | GIS Fundamental dan Location Analytics | QGIS, ArcGIS, GEO MAPID | `Day 01-03 - QGIS/` |
| 2 | Day 4-7 | Python untuk data spasial | Python, Jupyter, GeoPandas | `Day 04-07 - Python/` |
| 3 | Day 8-13 | Web Fundamental (HTML, CSS, JavaScript) | HTML, CSS, Tailwind, JS | `Day 08-13 - Web Fundamental/` |
| 4 | Day 14-18 | MapLibre GL JS (peta, heatmap, isochrone) | MapLibre GL JS, API MAPID | `Day 14-18 - MapLibre/` |
| 5 | Final Project | WebGIS SPPG Semarang | MapLibre, Turf.js, Chart.js, Tailwind | `Final Project/` |

Alur logikanya: **memahami data spasial (GIS)** → **mengolahnya dengan kode (Python)** → **membangun halaman web (HTML/CSS/JS)** → **menampilkannya sebagai peta interaktif (MapLibre)** → **menggabungkan semuanya menjadi aplikasi analisis (Final Project)**.

---

## Tahap 1: GIS Fundamental dan Location Analytics (Day 1-3)

**Tujuan:** memahami konsep dasar GIS, sistem koordinat, model data, dan analisis spasial dasar.

### Sesi 1: GIS Fundamental
- **Hands-on:** analisis di QGIS dengan data halte bus Jakarta. Operasi yang dilakukan: *buffer*, *clip*, dan *shortest path*.
- **Task 1:** analisis jangkauan fasilitas kesehatan di Kota Semarang.
  - Menggabungkan data Puskesmas dan Rumah Sakit.
  - Menghitung jumlah fasilitas kesehatan per kecamatan.
  - Mengidentifikasi area yang tidak terlayani RS dan Puskesmas.
  - Membuat layout peta akhir (PDF dan PNG).
- **Berkas utama:** `Sesi 1 - GIS Fundamental/Task _1/` (proyek `.qgz`, folder `Geojson/`, folder `Peta/`) dan laporan `Laporan Analisa Singkat_Task 1_GIS Fundamental.pdf`.

### Sesi 2: Location Analytics 1
- **Task 2:** analisis Status Sosial Ekonomi (SES) Kota Semarang 2024, dikerjakan dalam dua versi: **ArcGIS** dan **GEO MAPID**.
- **Berkas utama:** `Sesi 2 - Location Analytics 1/` (data GeoJSON SES, dokumen task versi ArcGIS dan MAPID).

### Sesi 3: Location Analytics 2
- **Task 3:** analisis lokasi rumah sakit di Semarang menggunakan GEO MAPID.
- **Berkas utama:** `Sesi 3 - Location Analytics 2/`.

**Hasil belajar:** mampu menyiapkan data, melakukan overlay dan buffer, lalu menyajikan hasil sebagai peta tematik dan laporan singkat.

---

## Tahap 2: Python untuk Analisis Spasial (Day 4-7)

**Tujuan:** mengotomatiskan pengolahan data spasial dengan Python.

| Hari | Topik | Berkas utama |
|---|---|---|
| Day 4 | Pengantar Python untuk data spasial | `Day 4/` (notebook hands-on, WebGIS mini hidrokarbon, task banjir pluvial) |
| Day 5 | Bekerja dengan data spasial: buffer, clip, dissolve, union, simplify, filter | `Day 5/` (notebook, hasil GeoJSON per operasi) |
| Day 6 | Spatial analytics dan peta interaktif | `Day 6/` (analisis lokasi, peta klaster dan GeoJSON gempa) |
| Day 7 | Lanjutan studi kasus Python | `Day 7/` |

**Hasil belajar:** alur kerja baca data, cek CRS, olah (buffer, dissolve, union), lalu ekspor ke GeoJSON atau HTML interaktif.

> Catatan kerapian: folder `Include/`, `Lib/`, dan `Scripts/` di dalam `Day 08-13 - Web Fundamental/MAPID_WEBGIS_BOOTCAMP/` adalah lingkungan virtual Python (virtual environment), bukan hasil kerja. Sebaiknya tidak ikut diserahkan atau diunggah.

---

## Tahap 3: Web Fundamental (Day 8-13)

**Tujuan:** membangun halaman web sebagai dasar sebelum membuat WebGIS.

| Hari | Topik | Berkas utama |
|---|---|---|
| Day 8 | HTML: struktur dasar, elemen semantik dan non-semantik | `Day 8/Hands On Day 8/` (`semantik.html`, `non-semantik.html`), `Day 8/Task day 8/HandsonDay8/TestDay8.html` |
| Day 9 | CSS: inline, internal, dan external | `Day 9/Hands on/` (`inlineCSS.html`, `internalCSS.html`, `externalCSS.html`) |
| Day 10-11 | CSS Framework (Tailwind/Bootstrap) | Folder `Day 10/` dan `Day 11/` belum berisi berkas |
| Day 12 | Praktik membuat halaman (landing page) | `Day 12/sebelum hands-on/` dan `Day 12/hasil hands-on/` |
| Day 13 | JavaScript dan pemanggilan API | Belum ada berkas di folder |

**Hasil belajar:** memahami struktur HTML, tiga cara menerapkan CSS, serta membandingkan kondisi *sebelum* dan *sesudah* hands-on pada Day 12.

---

## Tahap 4: MapLibre GL JS (Day 14-18)

**Tujuan:** menampilkan data spasial di peta web, lalu menambahkan fitur analisis.

| Hari | Topik | Berkas utama |
|---|---|---|
| Day 14 | MapLibre dasar: inisialisasi peta dengan basemap MAPID | `Day 14 - MapLibre Dasar/` |
| Day 15 | MapLibre 2: memanggil data dari API, layer titik dan poligon. Task: jalan Kota Semarang | `Day 15 - MapLibre 2/` dan `Task MapLibre_Day_2/` |
| Day 16 | Fitur toolbox: heatmap dan radius | Folder `Day 16 - MapLibre 3/` belum berisi berkas |
| Day 17 | MapLibre 4: keterjangkauan dengan isochrone dan filter data | `Day 17 - MapLibre 4/` |
| Hands-on | Latihan bersama mentor sebagai bekal Final Project | `Hands-On Final - Kak Rifqi/` |

**Hasil belajar:** pola dasar peta (`map` → `source` → `layer`), pemanggilan API, interaksi klik dan popup, heatmap, serta isochrone.

---

## Tahap 5: Final Project, WebGIS SPPG Kota Semarang

### Latar belakang
Distribusi fasilitas pendidikan di Kota Semarang tidak merata dan jangkauan layanan SPPG terbatas, sehingga berpotensi menimbulkan ketimpangan akses pemenuhan gizi siswa. WebGIS ini mengevaluasi keterjangkauan SPPG terhadap sekolah dan menunjukkan area yang belum terlayani.

### Alur analisis (sesuai kode di `Final Project/src/app.js`)

1. **Memuat data:** SD, SMP, SMA, dan SPPG (GeoJSON) ditampilkan sebagai layer titik. Setiap sekolah diberi atribut jenjang.
2. **Memilih SPPG:** pengguna mengklik titik SPPG, lalu popup menampilkan nama dan jenjang.
3. **Isochrone:** jangkauan layanan dihitung dari waktu tempuh mobil (default 600 detik) lewat API routing MAPID dan digambar sebagai area hijau.
4. **Overlay (point-in-polygon, Turf.js):** menghitung jumlah sekolah dan siswa yang terlayani per jenjang.
5. **Gap analysis:** sekolah di luar isochrone ditandai sebagai belum terlayani.
6. **Kandidat SPPG baru:** area dibagi grid 1 km, permintaan (jumlah siswa) dihitung per sel, lalu 5 sel dengan siswa terbanyak menjadi kandidat lokasi.
7. **Heatmap:** kepadatan sekolah, berbobot jumlah siswa.
8. **Dashboard:** kartu ringkasan dan tiga grafik (jumlah sekolah, jumlah siswa, proporsi siswa) memakai Chart.js.

### Fitur antarmuka
Ganti basemap (Street, Dark, Satellite), nyalakan atau matikan tiap layer, input waktu isochrone, tombol analisis lokal dan global, serta panel dashboard.

### Struktur Final Project
```
Final Project/
├── Index.html                      # Halaman utama (layout dan sidebar)
├── src/app.js                      # Logika peta dan analisis
├── data/                           # Batas_Kota, Jalan_SMG, SD, SMP, SMA, SPPG (GeoJSON)
└── Dokumentasi WebGIS Academy.pdf  # Dokumentasi resmi proyek
```

### Versi alternatif
`Final Project - Versi Alternatif/` berisi versi analisis memakai Python (`Final Project_Dika.ipynb`), QGIS (`.qgz`), dan ArcGIS (`.aprx`), lengkap dengan flowchart dan laporan HTML. Versi ini dipakai sebagai pembanding dan bahan analisis awal (isochrone SPPG, fasilitas terlayani dan tidak terlayani).

### Teknologi
MapLibre GL JS 4.7.1, Turf.js 7, Chart.js, Tailwind CSS, API basemap dan isochrone MAPID.

---

## Catatan Penting untuk Penyerahan atau Publikasi

1. **API key tertulis langsung di kode** (`app.js` di Final Project, Day 14-18, serta URL `api_key` di notebook Day 5-7). Jika repositori GitHub bersifat publik, sebaiknya kunci dirotasi dan dipindahkan ke konfigurasi terpisah.
2. **Folder `Database/`** berisi banyak arsip besar (`.zip`, `.rar`) dan ribuan berkas shapefile. Sebaiknya tidak diunggah ke GitHub.
3. **Virtual environment Python** (`Include/`, `Lib/`, `Scripts/`) tidak perlu diunggah. Cukup kecualikan dari repositori.
4. **Kerapian kode Final Project:** `app.js` belum diberi indentasi, dan `Index.html` memuat CSS di dalam berkas yang sama. `Index.html` memuat `./app.js` padahal berkasnya ada di `src/app.js`, jadi periksa versi di GitHub.
5. **Folder kosong yang sengaja dibiarkan:** `Day 10`, `Day 11`, `Day 13`, `Day 16 - MapLibre 3`, `Final Project/docs`.

---

## Riwayat Perbaikan

Ringkasan perbaikan tahap Day 1 sampai Final Project Versi Alternatif (Final Project utama dan Dashboard Referensi tidak diubah):

| Area | Perbaikan |
|---|---|
| Struktur folder | Nama folder diseragamkan; Day 4-7 dipindahkan ke `Day 04-07 - Python/`; folder bernama `HandsonDay8.html` menjadi `HandsonDay8`; typo nama berkas (`Locataion`, `Acrgis`, `non-sementik`) diperbaiki |
| Berkas macOS | `__MACOSX` dan `.DS_Store` dipindahkan keluar proyek |
| QGIS (Day 1-3, Final Alternatif) | Semua proyek `.qgz` menunjuk ke folder lama `E:/.../Qgis/` atau salah tingkat folder (`./` seharusnya `../`); kini seluruh 81 referensi data relatif dan valid |
| Python (Day 4-7) | Path absolut `C:/Users/ASUS/...` pada notebook diganti path relatif; notebook Final Alternatif diberi judul dan struktur bagian |
| HTML (Day 8, 9, 12) | DOCTYPE, `lang`, charset; tag `<lebel>` salah ketik; id ganda; Day 9 kini benar-benar berisi CSS inline, internal, dan eksternal (`style.css`) |
| MapLibre (Day 14-17) | Day 14: skrip ganda dan titik tidak tampil; Day 15-17: tombol toggle layer, layer hilang saat ganti basemap, `index_smg.html` memuat skrip yang salah |
| Pengujian langsung (browser) | Semua peta dan 9 halaman HTML diuji di browser. Data drainase Bandung sudah dihapus dari server sumber, sehingga di Day 17 dan Hands-On layer centroid dan buffer tidak termuat; kegagalan itu kini tidak fatal. Task Semarang: popup rumah sakit gagal karena variabel di luar scope (dihapus), dan data jalan Overpass diubah dari format OSM menjadi GeoJSON |
| Sumber drainase diganti | Layer drainase Bandung sudah dihapus dari server sumbernya. Day 15, Day 17 dan Hands-On kini memakai drainase Kota Yogyakarta dari Geoportal Kota Yogyakarta (WFS GeoServer, 3 layer sungai Code, Gajahwong, Winongo, total 1.070 ruas) yang digabung dan atributnya diseragamkan. Letaknya di Yogyakarta, jadi ditambahkan tombol "Lihat Drainase (Yogyakarta)" yang memindahkan tampilan peta ke sana. Popup memakai kolom Sungai menggantikan Pembangun |
| Notebook dijalankan ulang | 10 notebook dijalankan ulang dan outputnya diperbarui. Tambahan: `makedirs` pada Day 5 Hands On, sel teks di sel kode pada Task day 5, dan `hue='geometry'` pada Task Day 4 |
| Virtual environment | `MAPID_WEBGIS_BOOTCAMP` dibuat ulang di lokasi barunya; skrip aktivasi tidak lagi menunjuk ke `C:\Users\ASUS\` |

