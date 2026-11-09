# Catatan Belajar - SPPG Smart Dashboard

Satu entri per perbaikan. Setiap entri punya satu commit yang sesuai di riwayat git.

---

## 1. Path script app.js salah (peta kosong, dashboard 0)

**Masalah**
Peta kosong dan dashboard menampilkan 0. Console menampilkan `GET http://127.0.0.1:5500/app.js 404 (Not Found)` dengan initiator `(index):107`.

**Perubahan**
`Index.html` baris 107:
```diff
-<script type="module" src="./app.js"></script>
+<script type="module" src="src/app.js"></script>
```

**Alasan**
- Path pada `src` dihitung dari lokasi halaman HTML, yaitu `Index.html` di root proyek. Browser jadi mencari `/app.js`, padahal file ada di `/src/app.js`, sehingga hasilnya 404.
- Karena `app.js` tidak termuat, `new maplibregl.Map(...)` tidak pernah jalan (peta kosong) dan `analyze()` tidak pernah mengisi angka (dashboard tetap 0). Tombol yang memakai `onclick="setStyle(...)"` juga mati karena `window.setStyle` didefinisikan di `app.js`.
- `./src/app.js` dan `src/app.js` artinya sama (relatif terhadap halaman).
- Path `./data/*.geojson` di dalam `app.js` tetap benar karena fetch juga dihitung dari URL halaman, bukan dari lokasi `app.js`.

**Hasil**
Setelah diperbaiki dan dibuka dengan Live Server, peta tampil.

**Pelajaran**
Saat ada error 404 pada script, buka tab Network, lihat URL yang diminta browser, lalu bandingkan dengan lokasi file sebenarnya. Path relatif di HTML selalu dihitung dari halaman HTML.

---

## 2. `init` terpanggil dua kali (event `load` dan `style.load`)

**Masalah**
`init` didaftarkan ke dua event sekaligus (`map.on('load',init)` dan `map.on('style.load',init)`). Pada pemuatan pertama keduanya menyala, sehingga source dan layer bisa ditambahkan dua kali dan memicu error `Source "sd" already exists`.

**Perubahan**
`src/app.js` baris 20: hanya `map.on('style.load',init);` yang dipertahankan, baris `map.on('load',init);` dihapus (dikerjakan sendiri oleh Arsya). Ditambahkan komentar penjelas di atasnya.

**Alasan**
- `style.load` menyala setiap kali style selesai dimuat: saat pertama kali dan setiap `map.setStyle(...)`. Satu event ini sudah mencakup semua kasus, jadi `load` tidak diperlukan.
- `init` bersifat async (menunggu fetch GeoJSON), sehingga dua pemanggilan bersamaan bisa balapan: keduanya lolos `clear()` lalu sama-sama `addSource`.

**Hasil**
Belum diverifikasi di browser. Cara cek: muat ulang halaman lewat Live Server, buka Console (F12), dan pastikan tidak ada error `Source "sd" already exists`.

**Pelajaran**
Event handler yang didaftarkan lewat `map.on` akan dijalankan untuk setiap event yang cocok. Jangan daftarkan fungsi yang sama ke dua event yang menyala bersamaan.

---

## 3. `toggleLayer` butuh dua klik untuk menyembunyikan layer

**Masalah**
Klik pertama pada tombol SD/SMP/SMA/SPPG/Candidate/Heatmap tidak terlihat berubah. Layer baru hilang pada klik kedua.

**Perubahan**
`src/app.js` baris 344:
```diff
-map.setLayoutProperty(id,'visibility',v==='visible'?'none':'visible');
+map.setLayoutProperty(id,'visibility',v==='none'?'visible':'none');
```

**Alasan**
- Layer yang baru dibuat tidak punya properti `visibility` di layout, jadi `getLayoutProperty` mengembalikan `undefined`, bukan `'visible'`.
- Kode lama: `undefined === 'visible'` bernilai salah, sehingga diset ke `'visible'` (tidak ada perubahan terlihat). Baru klik kedua menyembunyikan.
- Kode baru hanya menganggap layer tersembunyi kalau nilainya persis `'none'`. Nilai lain (`undefined` atau `'visible'`) berarti terlihat, sehingga klik pertama langsung menyembunyikan.

**Hasil**
Belum diverifikasi di browser. Cara cek: klik tombol SD sekali, titik biru harus langsung hilang. Klik lagi, harus muncul kembali.

**Pelajaran**
Nilai default properti MapLibre bisa `undefined`. Saat membuat toggle, uji kondisi "mati" yang pasti (`'none'`), bukan kondisi "hidup" yang bisa punya banyak bentuk.

---

## 4. Popup SPPG selalu menampilkan "Tidak ada nama"

**Masalah**
Klik titik SPPG memunculkan popup "Tidak ada nama", padahal data punya nama.

**Perubahan**
`src/app.js` baris 65 (setelah baris komentar):
```diff
-const nama=p.NAMA || p.nama || "Tidak ada nama";
+const nama=p.NAMA || p.nama || p['Nama SPPG'] || "Tidak ada nama";
```

**Alasan**
- Hasil pemeriksaan `data/*.geojson`: SD/SMP/SMA memakai kolom `NAMA`, tetapi SPPG memakai kolom `Nama SPPG` (ada spasi). Ke-128 fitur SPPG tidak punya `NAMA` maupun `nama`.
- Nama properti yang mengandung spasi tidak bisa ditulis `p.Nama SPPG`. Harus memakai kurung siku: `p['Nama SPPG']`.
- Urutan `||` dipertahankan agar sekolah tetap memakai `NAMA`, dan teks "Tidak ada nama" menjadi pilihan terakhir.

**Hasil**
Belum diverifikasi di browser. Cara cek: klik satu titik hitam (SPPG), popup harus menampilkan nilai kolom `Nama SPPG`.

**Pelajaran**
Selalu cek nama kolom asli di data (buka GeoJSON atau lihat console `e.features[0].properties`) sebelum menulis kode yang membacanya. Data dari sumber berbeda sering punya skema berbeda.

---

## 5. Handler klik menumpuk (popup muncul ganda)

**Masalah**
Setelah ganti basemap atau menjalankan analisis lebih dari sekali, satu klik pada titik bisa memunculkan beberapa popup sekaligus.

**Perubahan**
`src/app.js`:
- `bindPopup()` diberi penanda `let popupBound=false;` dan di awal fungsi `if(popupBound) return; popupBound=true;`.
- Di `generateCandidate()` handler `map.on('click','candidate-layer',...)` dibungkus `if(!candidatePopupBound){ candidatePopupBound=true; ... }`, dengan `let candidatePopupBound=false;` dideklarasikan di atas fungsi.

**Alasan**
- Setiap `map.on(...)` menambah satu pendengar baru, tidak menggantikan yang lama. `bindPopup()` dipanggil dari `init`, yang jalan setiap `style.load` (termasuk ganti basemap). `generateCandidate()` jalan setiap analisis. Jadi jumlah pendengar terus bertambah.
- Pendengar yang diikat ke nama layer (`map.on('click', 'sd-layer', ...)`) tetap bekerja walau layernya dihapus lalu dibuat ulang dengan id yang sama. Karena itu cukup didaftarkan sekali.

**Hasil**
`node --check src/app.js` lolos (tidak ada error sintaks). Belum diverifikasi di browser. Cara cek: ganti basemap beberapa kali, lalu klik satu titik sekolah, hanya boleh muncul satu popup. Jalankan Run Isochrone dua kali, klik satu kandidat merah, juga hanya satu popup.

**Pelajaran**
Jangan menaruh `map.on(...)` di dalam fungsi yang dipanggil berulang. Daftarkan sekali (di luar fungsi, atau dijaga penanda).

---

## 6. `getIso` tanpa pengecekan dan tombol Global mengabaikan input waktu

**Masalah**
- Kalau API isochrone gagal (API key salah, kuota habis, jaringan), kode langsung mengakses `data.polygons[0]` dan error yang muncul membingungkan (`Cannot read properties of undefined`).
- Tombol Run Global selalu memakai 600 detik, mengabaikan isi kotak "Isochrone".

**Perubahan**
`src/app.js`:
```diff
 const res=await fetch(url);
+if(!res.ok) throw new Error('API isochrone gagal: HTTP '+res.status);
 const data=await res.json();
+if(!data.polygons || data.polygons.length===0) throw new Error('API isochrone tidak mengembalikan polygon');
 return data.polygons[0];
```
```diff
-const iso=await getIso(sppgData[0],600);
+const iso=await getIso(sppgData[0],document.getElementById('waktu').value);
```

**Alasan**
- `fetch` tidak melempar error untuk respons HTTP 4xx/5xx, jadi `res.ok` harus dicek sendiri.
- Pesan error yang menyebut penyebab sebenarnya (status HTTP atau polygon kosong) jauh lebih mudah dilacak daripada `TypeError`.
- Nilai waktu diambil dari input yang sama dengan tombol Run Isochrone supaya perilaku kedua tombol konsisten.

**Hasil**
`node --check src/app.js` lolos. Belum diverifikasi di browser. Cara cek: isi waktu 300 lalu tekan Run Global, area hijau harus lebih kecil dari 600. Untuk uji error, ubah sementara key API di URL lalu lihat pesan di Console.
Catatan: error masih muncul sebagai "Uncaught (in promise)" di Console. Pesan sudah jelas, tetapi belum ada `try/catch` yang menampilkan alert ke pengguna.

**Pelajaran**
`fetch` hanya gagal untuk masalah jaringan. Respons 404/500 tetap dianggap berhasil, jadi cek `res.ok`. Validasi bentuk data dari API luar sebelum dipakai.

---

## 7. Grid kandidat SPPG hanya menutupi area isochrone

**Masalah**
Rekomendasi lokasi SPPG baru sering kosong atau meleset.

**Perubahan**
`src/app.js` di `generateCandidate`:
```diff
-turf.bbox(geo),
+turf.bbox(turf.featureCollection(sekolahData)),
```

**Alasan**
- Algoritmanya: ambil sekolah yang tidak terlayani (di luar isochrone), bagi area menjadi sel 1 km, hitung kebutuhan siswa per sel, lalu ambil 5 sel teratas.
- Kode lama membuat grid dari `bbox` isochrone. Sekolah yang tidak terlayani justru berada di luar isochrone, jadi sebagian besar tidak jatuh ke sel mana pun dan hanya yang kebetulan berada di sudut kotak isochrone yang terhitung.
- Kode baru membuat grid dari `bbox` seluruh sekolah sehingga semua sekolah yang belum terlayani masuk perhitungan.

**Hasil**
`node --check src/app.js` lolos. Belum diverifikasi di browser. Cara cek: jalankan Run Isochrone, harus muncul sampai 5 titik merah kandidat di area yang tidak tertutup hijau, dengan popup "Sekolah belum terlayani" yang terisi.
Catatan performa: grid jadi lebih besar (lihat perkiraan jumlah sel di hasil perhitungan bbox saat perbaikan ini dibuat). Jika terasa lambat, langkah lanjutan adalah mengelompokkan sekolah ke sel dengan perhitungan indeks, tanpa `booleanPointInPolygon` per sel.

**Pelajaran**
Saat membuat grid analisis, tentukan dulu area yang ingin dianalisis. Di sini area itu adalah tempat kebutuhan berada (sekolah belum terlayani), bukan area layanan (isochrone).

---

## 8. Hasil analisis hilang saat ganti basemap

**Masalah**
Setelah menjalankan isochrone lalu menekan Street/Dark/Satellite, area hijau, titik kandidat, dan heatmap hilang. Pengguna harus mengulang analisis.

**Perubahan**
`src/app.js`:
- Variabel baru `let lastIso=null;`.
- `drawIso(geo)` menyimpan `lastIso=geo;`.
- Di akhir `init()` ditambah: jika `lastIso` ada, panggil `drawIso(lastIso)`, `generateCandidate(lastIso)`, dan `generateHeatmap()`.

**Alasan**
- `map.setStyle(...)` mengganti seluruh style, jadi semua source dan layer buatan kita ikut terhapus. Event `style.load` kemudian menjalankan `init`, yang hanya menggambar sekolah dan SPPG.
- Dengan menyimpan isochrone terakhir, `init` bisa menggambar ulang tiga layer analisis dari data yang sama tanpa memanggil API lagi. Angka dashboard tidak ikut hilang karena elemen HTML-nya tidak diganti.
- `sekolahData` sudah terisi sebelum bagian ini dijalankan, sehingga `generateCandidate` dan `generateHeatmap` aman dipanggil.

**Hasil**
`node --check src/app.js` lolos. Belum diverifikasi di browser. Cara cek: jalankan Run Isochrone, lalu ganti basemap. Area hijau, titik merah, dan heatmap harus tetap tampil.
Keterbatasan: status tombol toggle (layer yang sebelumnya disembunyikan) kembali ke tampil setelah ganti basemap.

**Pelajaran**
Kalau data hasil kerja hidup di dalam style peta, simpan salinannya di variabel JavaScript. Style bisa diganti kapan saja, tetapi variabel tidak ikut hilang.

---

## 9. Angka siswa tidak konsisten (dashboard, heatmap, kandidat)

**Masalah**
Data GeoJSON tidak punya kolom `siswa`, sehingga semua angka siswa berasal dari tebakan di kode, dan tebakannya berbeda-beda:
- dashboard: 200 untuk semua jenjang,
- kandidat: 200 (SD) / 300 (SMP) / 400 (SMA),
- heatmap: bobot 1.

**Perubahan**
`src/app.js`: ditambah `SISWA_DEFAULT={SD:200,SMP:300,SMA:400}` dan fungsi `getSiswa(s)`. Tiga tempat dipakaikan fungsi ini:
```diff
-const siswa=s.properties.siswa || 200;
+const siswa=getSiswa(s);
```
```diff
-properties:{weight:s.properties.siswa || 1}
+properties:{weight:getSiswa(s)/SISWA_DEFAULT.SMA}
```
```diff
-const siswa = s.properties.siswa || (j==='SD'?200:(j==='SMP'?300:400));
+const siswa = getSiswa(s);
```

**Alasan**
- Satu sumber kebenaran: kalau nanti ada data siswa asli (kolom `siswa`) atau estimasi diubah, cukup ubah di satu fungsi.
- Bobot heatmap dibagi 400 supaya nilainya 0,5 sampai 1. Bobot ratusan membuat peta panas jenuh (semua area menjadi warna maksimum).
- Angka tetap estimasi. Dashboard "Total Siswa Terlayani" bukan data asli dan sebaiknya diberi label "estimasi" bila dipublikasikan.

**Hasil**
`node --check src/app.js` lolos. Belum diverifikasi di browser. Cara cek: jalankan Run Isochrone. Total siswa di dashboard harus kelipatan estimasi per jenjang (mis. 3 SD + 1 SMP = 900), dan popup kandidat memakai angka dari estimasi yang sama.

**Pelajaran**
Angka yang dipakai di banyak tempat harus berasal dari satu fungsi atau konstanta. Kalau tidak, perubahan di satu tempat membuat hasil di tempat lain bertentangan.

---

## 10. API key tersebar di kode

**Masalah**
Dua API key MapID (basemap dan routing) tertulis langsung di empat URL di `src/app.js`. Kalau kunci perlu diganti, harus mencari di banyak baris, dan repo ini publik di GitHub.

**Perubahan**
`src/app.js`:
```diff
+const MAPID_BASEMAP_KEY='...';
+const MAPID_ROUTING_KEY='...';
-street:'https://basemap.mapid.io/styles/street-2d-building/style.json?key=69a8...',
+street:`https://basemap.mapid.io/styles/street-2d-building/style.json?key=${MAPID_BASEMAP_KEY}`,
 (dark, sat dan URL isochrone diubah dengan cara yang sama)
```

**Alasan**
- Satu tempat untuk mengganti kunci mengurangi risiko ada yang terlewat.
- Perubahan ini hanya merapikan. Kunci tetap terbaca siapa pun, karena JavaScript di browser selalu bisa dilihat lewat "View source" dan kunci lama juga masih ada di riwayat commit git.

**Hasil**
`node --check src/app.js` lolos. Belum diverifikasi di browser. Cara cek: basemap dan tombol Street/Dark/Satellite tetap memuat peta, dan Run Isochrone tetap mendapat respons.

**Yang masih harus dikerjakan manual (tidak bisa dilakukan lewat kode)**
1. Masuk ke dashboard MapID, buat kunci baru, dan cabut kunci yang lama (rotasi).
2. Jika MapID menyediakannya, batasi kunci baru hanya untuk domain situs ini (domain restriction).
3. Untuk aplikasi frontend murni, kunci memang tidak bisa disembunyikan. Pembatasan domain dan kuota adalah pengamannya. Menyembunyikan kunci sepenuhnya butuh server perantara (proxy).

**Pelajaran**
Kunci di sisi browser selalu publik. Yang melindungi bukan menyembunyikannya, melainkan membatasi apa yang bisa dilakukan kunci itu.

---

## 11. README tidak sesuai isi proyek

**Masalah**
- README menyebut data "Batas kota Semarang", padahal folder `data/` hanya berisi `SD`, `SMP`, `SMA`, dan `SPPG`.
- README menyuruh membuka `index.html` (huruf kecil), padahal file aslinya `Index.html`.

**Perubahan**
`README.md`:
```diff
-- Batas kota Semarang
-Buka file `index.html` menggunakan Live Server
+Buka file `Index.html` menggunakan Live Server
```
Baris yang diperbaiki diberi keterangan sebagai komentar HTML `<!-- ... -->` agar tidak tampil di halaman GitHub.

**Alasan**
- Dokumentasi yang menyebut data yang tidak ada menyesatkan orang yang mengkloning repo.
- Windows tidak membedakan huruf besar-kecil nama file, tetapi Linux dan GitHub Pages membedakan. `index.html` dan `Index.html` bisa dianggap file berbeda sehingga halaman 404 saat dipublikasikan.
- Catatan: GitHub Pages dan sebagian server mencari `index.html` huruf kecil sebagai halaman awal. Jika nanti dipublikasikan di sana, ganti nama file menjadi `index.html` (perubahan ini belum saya lakukan karena Anda bisa saja memakai Live Server saja).

**Hasil**
README sekarang cocok dengan isi folder. Hasil render bisa dicek di halaman repo GitHub.

**Pelajaran**
Dokumentasi adalah bagian dari kode: perbarui bersamaan dengan perubahan. Hindari perbedaan huruf besar-kecil nama file agar proyek berjalan sama di semua sistem operasi.

---

## 12. Library CDN tanpa versi di Index.html

**Masalah**
`chart.js` dan Tailwind dimuat tanpa nomor versi:
```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```
Tanpa versi, browser selalu mengambil rilis terbaru, sehingga tampilan atau grafik bisa rusak sewaktu-waktu tanpa kita mengubah kode.

**Perubahan**
`Index.html` baris 10-11 (sekarang 11-14 karena ada komentar):
```diff
-<script src="https://cdn.tailwindcss.com"></script>
-<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
+<script src="https://cdn.tailwindcss.com/3.4.17"></script>
+<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>
```

**Alasan**
- Versi 3.4.17 sama dengan yang terlihat di tab Network saat ini, jadi tampilan tidak berubah.
- Chart.js dikunci ke 4.4.1 dengan berkas `dist/chart.umd.js` yang menyediakan global `Chart` untuk dipakai `app.js`.
- Dua URL baru diuji dengan `curl`: keduanya merespons HTTP 200.
- `cdn.tailwindcss.com` memang ditujukan untuk pengembangan, bukan produksi. Untuk produksi, build Tailwind menjadi berkas CSS. Itu di luar cakupan perbaikan ini.
- `maplibre-gl@4.7.1` dan `@turf/turf@7` sudah berversi, jadi tidak diubah.

**Hasil**
URL diverifikasi (HTTP 200). Belum diverifikasi di browser. Cara cek: muat ulang, panel samping harus tampil sama seperti sebelumnya, dan setelah Run Isochrone tiga grafik muncul tanpa error di Console.

**Pelajaran**
Selalu kunci versi library yang dimuat dari CDN. Perilaku yang berubah tiba-tiba tanpa perubahan kode sering berasal dari versi library yang ikut berubah.

---

## 13. Ganti basemap MapID dengan penyedia gratis tanpa API key

**Masalah**
Langganan MapID sudah berhenti, jadi tiga basemap (Street, Dark, Satellite) bergantung pada layanan berbayar dan API key di kode.

**Perubahan**
`src/app.js`: `styles` sekarang berisi:
- `street`: OpenFreeMap Liberty (`https://tiles.openfreemap.org/styles/liberty`)
- `dark`: CARTO Dark Matter (`https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`)
- `sat`: Esri World Imagery, ditulis sebagai objek style MapLibre dengan sumber `raster` dan atribusi Esri.
Konstanta `MAPID_BASEMAP_KEY` dihapus. Kode dibagi per sesi dengan komentar `// ===== KUNCI API =====` dan `// ===== BASEMAP =====`.

**Alasan**
- OpenFreeMap dan CARTO adalah style vektor yang bisa langsung diberikan ke MapLibre lewat URL, tanpa key.
- Esri World Imagery hanya menyediakan tile gambar (raster). MapLibre menerima style berbentuk objek, jadi satelit ditulis sebagai satu sumber raster dan satu layer raster.
- Atribusi wajib ditampilkan; OpenFreeMap dan CARTO sudah menyertakannya di style, sedangkan untuk Esri ditambahkan lewat properti `attribution`.

**Hasil**
Diuji di browser (Live Server): Street tampil dengan titik sekolah/SPPG dan tidak ada error "already exists" di Console. Dark dan Satellite memuat tile dengan benar (semua permintaan HTTP 200).
**Masalah yang ditemukan saat uji:** setelah klik Dark atau Satellite, titik sekolah/SPPG hilang. Ini tidak terkait penyedia basemap; penyebab dan perbaikannya ada di entri 14.

**Pelajaran**
Uji di browser, jangan hanya membaca kode. Dua catatan sebelumnya menandai hasil sebagai "belum diverifikasi" dan memang ada bug yang baru ketahuan saat dijalankan.

---

## 14. Titik sekolah/SPPG hilang setelah ganti basemap (`setStyle` mode diff)

**Masalah**
Setelah klik Dark atau Satellite, basemap berubah tetapi semua titik sekolah dan SPPG hilang. Di tab Network tidak ada permintaan `SD.geojson` baru, artinya `init` tidak jalan lagi.

**Perubahan**
`src/app.js`:
```diff
-window.setStyle=(t)=>map.setStyle(styles[t]);
+window.setStyle=(t)=>map.setStyle(styles[t],{diff:false});
```

**Alasan**
- Secara bawaan `map.setStyle` memakai mode **diff**: MapLibre membandingkan style lama dengan yang baru lalu mengubahnya di tempat. Layer buatan kita (`sd-layer`, `sppg-layer`, dll.) tidak ada di style baru, jadi ikut dihapus. Karena style tidak dibuat ulang, event `style.load` tidak menyala sehingga `init` tidak menggambar ulang.
- `{diff:false}` memaksa style dimuat penuh dari nol. Event `style.load` menyala setiap kali, dan `init` menggambar ulang semuanya.
- Perbaikan ini juga membuat entri 8 (menggambar ulang isochrone/kandidat/heatmap setelah ganti basemap) benar-benar bisa bekerja. Tanpa `diff:false`, `init` tidak pernah dijalankan ulang.

**Hasil**
Diuji di browser: halaman dimuat ulang, lalu `setStyle('dark')` dan `setStyle('sat')`. Permintaan GeoJSON (SD, SMP, SMA, SPPG) terjadi tiga putaran (awal + dua kali ganti), dan titik tampil di atas citra satelit. Console hanya berisi 404 `favicon.ico` dan satu peringatan MapLibre dari style basemap.
Belum diuji: pemulihan isochrone/kandidat/heatmap setelah ganti basemap (menunggu isochrone dari API baru).

**Pelajaran**
Cara menyelidiki: lihat tab Network untuk memastikan apakah kode yang dikira jalan memang jalan. Dan baca dokumentasi opsi bawaan fungsi (`diff`). Perilaku bawaan tidak selalu sesuai asumsi.

---

## 15. Isochrone 10 menit untuk semua SPPG disimpan sebagai berkas statis

**Masalah**
Isochrone sebelumnya dihitung saat tombol ditekan lewat API MapID (berbayar, langganan sudah berhenti). Hasilnya hanya untuk satu SPPG, dan setiap pemakaian menghabiskan kuota API.

**Perubahan**
- Berkas baru `scripts/fetch-isochrones.mjs`: membaca `data/SPPG.geojson`, memanggil OpenRouteService (`/v2/isochrones/driving-car`, `range=[600]`, `range_type=time`) untuk setiap SPPG, lalu menulis `data/isochrone-600.geojson`.
- Berkas hasil `data/isochrone-600.geojson`: 128 poligon dengan properti `sppg_idx`, `sppg_no`, `sppg_nama`, `waktu_detik`.
- API key dibaca dari `.env` (diabaikan git) dan tidak pernah dicetak.

**Alasan**
- Jaringan jalan hampir tidak berubah, jadi isochrone cukup dihitung sekali (offline), lalu dimuat seperti data biasa. Halaman web tidak butuh API key dan tidak kena batas kuota.
- Skrip memberi jeda 3,5 detik antar permintaan (batas gratis 20 per menit), mengulang otomatis jika kena batas (HTTP 429), menyimpan bertahap, dan bisa dilanjutkan jika terputus.
- Alamat bawaan `api.heigit.org/openrouteservice` dipilih karena ada kabar alamat lama `api.openrouteservice.org` akan ditutup (belum terkonfirmasi resmi). Kedua alamat saya uji dan sama-sama berhasil dengan key yang sama.

**Hasil**
Diverifikasi: 128/128 isochrone tersimpan, 0 gagal, semua bertipe `Polygon` dengan cincin tertutup, 62 sampai 239 titik per poligon, ukuran berkas sekitar 506 KB.
Belum dipakai di peta (langkah berikutnya).

**Temuan data (penting untuk analisis berikutnya)**
- Dari 128 SPPG hanya 49 koordinat unik. 22 SPPG berbagi satu titik yang sama (`110.4108585,-7.098096`) walau kelurahannya tersebar di banyak kecamatan, tanda geokoding gagal. Isochrone dari titik-titik itu identik.
- 10 SPPG berstatus Kabupaten Semarang (di luar Kota Semarang).
- Konsekuensi: persentase cakupan yang dihitung dari koordinat ini tidak mencerminkan kondisi lapangan sampai koordinat diperbaiki.

**Pelajaran**
Hasil yang tidak berubah-ubah (isochrone dari titik tetap) sebaiknya dihitung sekali dan disimpan sebagai data statis. Dan periksa kualitas data masukan (keunikan, sebaran) sebelum membangun analisis di atasnya.
