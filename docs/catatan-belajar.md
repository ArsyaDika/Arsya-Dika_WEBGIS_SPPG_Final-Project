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

---

## 16. Perbaikan koordinat SPPG lewat geocoding kelurahan

**Masalah**
Dari 128 SPPG hanya 49 koordinat unik. 22 SPPG berbagi satu titik (`110.4108585,-7.098096`) walau kelurahannya berbeda-beda. Kolom `Latitude`/`Longitude` di properti ternyata sama persis dengan geometri, jadi tidak ada sumber koordinat benar di berkas aslinya.

**Perubahan**
- Berkas baru `scripts/geocode-sppg.mjs`: mencari 93 kombinasi kelurahan unik ke Nominatim (OpenStreetMap), lalu memeriksa silang hasilnya dengan titik tengah sekolah di kelurahan yang sama (dari data `DESA`/`KECAMATAN` pada SD/SMP/SMA). Jika Nominatim meleset lebih dari 3 km atau gagal, dipakai titik tengah sekolah.
- Keluaran baru (berkas asli `data/SPPG.geojson` tidak diubah): `data/SPPG_geocoded.geojson` (properti tambahan `geo_sumber`, `geo_akurasi`, `geo_jarak_cek_km`, `lng_lama`, `lat_lama`) dan `data/SPPG_geocode_laporan.csv` untuk diperiksa di Excel.

**Alasan**
- Satu pencarian per kelurahan (bukan per SPPG) menghemat permintaan dan sesuai kebijakan Nominatim (maksimal 1 permintaan per detik, memakai identitas klien).
- Pemeriksaan silang dengan data sekolah memakai informasi yang sudah ada di proyek untuk menangkap hasil geocoding yang salah daerah.
- Titik yang dihasilkan adalah titik pusat kelurahan, bukan lokasi gedung SPPG. Ini jauh lebih baik daripada titik cadangan yang salah, tetapi tetap perkiraan.

**Hasil**
Diverifikasi dari keluaran skrip:
- Sumber koordinat per SPPG: Nominatim 122, titik tengah sekolah 5, tidak ditemukan 1.
- Koordinat unik naik dari 49 menjadi 93 (maksimal 4 SPPG per titik, yaitu SPPG di kelurahan yang sama).
- Kota Semarang: 118 SPPG, semuanya terselesaikan, semua berada di dalam kotak kota (lng 110,291 sampai 110,494; lat -7,096 sampai -6,958).
- Jarak pemeriksaan silang Nominatim ke titik tengah sekolah: median 0,27 km, maksimum 1,45 km, tidak ada yang melewati batas 3 km.
- Kabupaten Semarang (10 SPPG): 1 tidak ditemukan (`SPPG Semarang Suruh Plumbon 2`) dan masih memegang koordinat lama yang salah, sehingga harus dikeluarkan dari analisis. Dari 9 sisanya, 5 berada dalam 8 km dari sekolah terdekat (Ungaran), sedangkan 4 lainnya berada 11 sampai 31 km dari kota dan tidak mungkin menjangkau sekolah dalam 10 menit.
Menunggu pemeriksaan pengguna sebelum dipakai untuk isochrone.

**Pelajaran**
Saat satu sumber data tidak bisa dipercaya, cari sumber kedua yang independen untuk memeriksa silang (di sini: data sekolah), dan catat dengan jelas mana yang diperbaiki dan mana yang masih perkiraan.

---

## 17. Menandai SPPG yang dipakai dalam analisis (123 dari 128)

**Masalah**
Lima SPPG tidak layak dipakai untuk analisis cakupan kota: satu tidak ditemukan koordinatnya (masih memegang titik lama yang salah) dan empat berada jauh di luar Kota Semarang.

**Perubahan**
- Berkas baru `scripts/tandai-analisis.mjs`: menambah properti `dipakai_analisis` (true/false) dan `alasan_dikeluarkan` ke setiap fitur di `data/SPPG_geocoded.geojson`.
- Aturan: koordinat tidak ditemukan dikeluarkan; SPPG di luar kota dan lebih dari 8 km dari sekolah terdekat dikeluarkan; sisanya dipakai.

**Alasan**
- Menyimpan keputusan sebagai data (bukan hanya di kode peta) membuat alasannya bisa ditelusuri dan dipakai ulang oleh skrip isochrone dan peta.
- SPPG yang berjarak 11 sampai 31 km tidak mungkin menjangkau sekolah dalam 10 menit berkendara, jadi memanggil API untuk mereka hanya membuang kuota.
- Ambang 8 km adalah angka kerja yang aman untuk 10 menit berkendara; bisa diubah di konstanta `BATAS_LUAR_KOTA_KM`.

**Hasil**
Diverifikasi dari keluaran: 123 dari 128 dipakai. Lima yang dikeluarkan: Plumbon 2 (koordinat tidak ditemukan), Bedono 2, Krandon Lor, Candirejo, dan Jambu (jauh dari kota).

**Pelajaran**
Tulis keputusan penyaringan data beserta alasannya ke dalam data itu sendiri, supaya semua langkah berikutnya memakai aturan yang sama dan bisa diaudit.

---

## 18. Parameter SPPG berdekatan (berubah merah + alasan)

**Masalah / permintaan**
Menambah parameter: SPPG yang berdekatan dengan SPPG lain ditandai merah, lengkap dengan alasannya.

**Perubahan**
- `Index.html`: panel baru "SPPG Berdekatan" berisi kotak angka `#jarakDekat` (meter, awal 500) dan penghitung `#jumlahDekat` dari `#jumlahSppg`; legenda menambah "SPPG berdekatan" dan warna kandidat dibedakan.
- `src/app.js`, sesi baru `// ===== SPPG BERDEKATAN =====`:
  - `terapkanSppgBerdekatan()`: untuk tiap SPPG mencari SPPG lain dalam jarak `#jarakDekat` memakai `turf.distance(..., {units:'meters'})`, lalu menulis properti `dekat` (1/0) dan `alasan`.
  - Warna lingkaran SPPG memakai ekspresi data `['case',['==',['get','dekat'],1],'#ef4444','#000']`.
  - Popup SPPG menampilkan alasan (dengan `esc()` agar teks data aman di HTML).
  - Pendengar `input` pada kotak jarak, sehingga warna berubah langsung saat angka diganti.
- Sumber SPPG diganti dari `SPPG.geojson` ke `SPPG_geocoded.geojson` yang disaring `dipakai_analisis` (123 SPPG).
- Warna kandidat dari merah ke pink (`#ec4899`) supaya tidak sama dengan SPPG berdekatan.

**Alasan**
- Warna berbasis properti (data-driven) lebih ringan daripada membuat layer baru, dan tetap bekerja setelah ganti basemap karena `init` memanggil ulang `terapkanSppgBerdekatan()`.
- Jarak dibuat parameter karena tidak ada angka standar tunggal. Nilai awal 500 m dipilih dari hitungan: dengan 100 m, 500 m, 1000 m, dan 2000 m berturut-turut 62, 66, 90, dan 115 dari 123 SPPG ditandai.
- Alasan di popup membedakan "titik/kelurahan yang sama" dari jarak sebenarnya karena posisi SPPG masih setingkat kelurahan. 62 dari 123 SPPG berbagi titik yang persis sama dengan SPPG lain, jadi banyak tanda merah pada jarak kecil berasal dari ketelitian koordinat, bukan jarak nyata di lapangan.

**Hasil**
Diuji di browser (Live Server):
- Awal 66 dari 123 merah; saat jarak diubah ke 100 m menjadi 62, ke 1000 m menjadi 90, kembali ke 500 m menjadi 66. Angka sama dengan hitungan offline.
- Klik SPPG merah memunculkan popup alasan, mis. "Berdekatan dengan 1 SPPG lain dalam radius 500 m: ... (titik/kelurahan yang sama). Layanan berpotensi tumpang tindih."
- Console hanya berisi 404 `favicon.ico` dan peringatan dari style basemap.

**Pelajaran**
Parameter yang memengaruhi banyak titik sebaiknya diubah lewat satu input yang langsung memperbarui peta. Dan sebelum menetapkan angka bawaan, hitung dulu sebaran hasilnya (di sini 54% pada 500 m) agar tanda tidak menjadi sekadar "semua merah".

---

## 19. Isochrone 10 menit dihitung ulang dari koordinat yang sudah diperbaiki

**Masalah**
Isochrone pertama (entri 15) dihitung dari koordinat SPPG yang salah (22 SPPG di satu titik), sehingga cakupan yang diturunkan darinya menyesatkan.

**Perubahan**
- `scripts/fetch-isochrones.mjs`: sumber diganti ke `data/SPPG_geocoded.geojson` dan hanya SPPG ber-`dipakai_analisis`; SPPG di titik yang sama dikelompokkan sehingga satu titik dipanggil ke API sekali lalu hasilnya dibagi ke semua SPPG di titik itu; keluaran ke `data/isochrone-sppg-600.geojson`.
- Berkas baru `data/isochrone-sppg-600.geojson`: 123 poligon dengan `sppg_idx` (urutan di `SPPG_geocoded.geojson`), `sppg_no`, `sppg_nama`, `waktu_detik=600`.

**Alasan**
- Mengelompokkan titik kembar menghemat kuota API (93 titik unik dibanding 123 SPPG) tanpa mengubah hasil, karena isochrone dari titik yang sama identik.
- Nama keluaran dibedakan agar berkas lama tidak tertimpa dan tidak ikut dilanjutkan oleh mekanisme resume skrip. Berkas lama `data/isochrone-600.geojson` masih ada di repo (masih berdasarkan koordinat lama) dan sebaiknya dihapus setelah pemilik repo mengizinkan.

**Hasil**
Diverifikasi: 123/123 isochrone, 0 gagal, tipe semuanya `Polygon`, cincin tertutup semua, 437 KB. Seluruh 123 SPPG yang dipakai punya isochrone dan tidak ada SPPG yang dikeluarkan ikut tersimpan. Satu poligon tidak memuat titik SPPG-nya sendiri (titik pusat kelurahan berada di luar jaringan jalan terdekat); ini wajar untuk titik perkiraan.

**Pelajaran**
Saat menghitung ulang data turunan karena data induknya diperbaiki, beri nama keluaran baru supaya hasil lama tidak tercampur dengan yang baru.

---

## 20. Aplikasi memakai isochrone statis; Run Global = gabungan semua SPPG

**Masalah**
`getIso` memanggil API MapID tiap klik (berbayar, langganan sudah berhenti) dan hanya untuk satu SPPG. Tombol Run Global memakai `sppgData[0]`, bukan semua SPPG.

**Perubahan**
`src/app.js`:
- Konstanta `MAPID_ROUTING_KEY` dihapus; kode sekarang tidak memuat API key apa pun.
- Sesi baru `muatIsochrone()`: memuat `data/isochrone-sppg-600.geojson` sekali.
- `getIso(point)` kini mencari isochrone SPPG terpilih berdasarkan `No SPPG` (= `sppg_no`) di data statis.
- Sesi baru `gabungIsochrone()`: `turf.union` isochrone semua SPPG (satu poligon per bentuk unik agar cepat).
- Run Isochrone memakai isochrone satu SPPG; Run Global memakai gabungan semua; keduanya dibungkus `try/catch` dengan `alert`.
`Index.html`: kotak waktu dikunci (`readonly`) di 600 detik dengan keterangan.

**Alasan**
- Isochrone dihitung sekali (offline) dan dibaca seperti data biasa; tidak ada key, kuota, atau biaya saat aplikasi dipakai.
- Cakupan sebenarnya adalah gabungan area semua SPPG. Memakai satu SPPG membuat hampir semua sekolah terlihat "belum terlayani".
- Kotak waktu dikunci agar tidak menipu: mengubah angka tidak akan mengubah data.

**Hasil**
Diuji di browser: Run Global menghasilkan 818 dari 823 sekolah (SD 549/553, SMP 200/200, SMA 69/70), estimasi 197.400 siswa; tidak ada alert error dan Console hanya berisi 404 `favicon.ico`.

**Pelajaran**
Pisahkan pekerjaan berat dan jarang berubah (menghitung isochrone) dari aplikasi yang dipakai berulang. Dan definisikan "terlayani" dari gabungan semua sumber layanan, bukan satu.

---

## 21. Isochrone terlalu kecil di 3 titik SPPG (ruas jalan terpencil)

**Masalah**
Klik SPPG Ngesrep lalu Run Isochrone menampilkan 0 sekolah. Pemeriksaan luas: dari 88 isochrone unik, median 76 km², tetapi Randugarut (0,7 km²), Ngesrep (0,9 km²), dan Jangli (5,3 km²) hanya beberapa km². Titik pusat kelurahan mereka jatuh di ruas jalan kecil yang tidak terhubung ke jaringan jalan utama, sehingga 10 menit berkendara hanya mencakup beberapa ratus meter.

**Perubahan**
`scripts/fetch-isochrones.mjs`:
- Fungsi `luasKm2` dan `jarakKm`.
- Jika isochrone < 10 km² (`LUAS_MIN_KM2`), dicoba ulang dari sampai 3 sekolah terdekat (<= 3 km) dan dipilih yang terluas; diberi tanda `isochrone_dialihkan`.
- Opsi `--perbaiki-kecil`: membuang isochrone kecil dari hasil lama agar dihitung ulang; kolom `luas_km2` ditambahkan ke setiap fitur.
- `data/isochrone-sppg-600.geojson` diperbarui.

**Alasan**
Titik pusat kelurahan hanyalah perkiraan. Sekolah selalu berada di jalan yang bisa dilalui, sehingga titik sekolah terdekat lebih mungkin terhubung ke jaringan jalan. Pemeriksaan luas minimum menangkap kasus ini otomatis, tidak hanya tiga yang kebetulan ditemukan.

**Hasil**
Diverifikasi: Ngesrep 0,9 -> 67,1 km², Randugarut 0,7 -> 85,6 km², Jangli 5,3 -> 24,4 km² (sekitar 9 permintaan API tambahan). Diuji di browser: Run Isochrone Ngesrep kini mencakup 275 sekolah (SD 182, SMP 63, SMA 30; estimasi 67.300 siswa), Run Global tetap 818 dari 823 sekolah.

**Pelajaran**
Setelah menghasilkan data dari layanan eksternal, periksa sebaran nilainya (di sini luas poligon) untuk menemukan hasil janggal, jangan hanya memeriksa jumlahnya.

---

## 22. Hapus berkas isochrone lama (koordinat salah)

**Masalah**
`data/isochrone-600.geojson` berasal dari koordinat SPPG yang salah (entri 15) dan sudah digantikan `data/isochrone-sppg-600.geojson` (entri 19-21). Berkas lama tidak dipakai kode mana pun tetapi bisa menyesatkan.

**Perubahan**
Berkas `data/isochrone-600.geojson` dihapus dari repo (dengan izin pemilik repo). Riwayatnya tetap ada di commit `391f526` bila perlu dilihat.

**Alasan**
Data turunan yang usang sebaiknya dihapus setelah ada penggantinya, supaya tidak ada yang memakainya tanpa sengaja. Git menyimpan riwayat, jadi tidak ada informasi yang benar-benar hilang.

**Hasil**
Berkas hilang dari folder `data/`. Aplikasi hanya membaca `isochrone-sppg-600.geojson`, jadi tidak ada yang berubah di tampilan.

**Pelajaran**
Saat memberi nama baru pada hasil perhitungan ulang, catat berkas lama yang perlu dibersihkan, lalu hapus setelah ada konfirmasi.

---

## 23. KPI cakupan 10 menit dan beban per SPPG (kapasitas 3.000)

**Masalah**
Cakupan isochrone gabungan sudah 99,4% sekolah, sehingga "cakupan" tidak lagi menjadi pembeda. Yang perlu dilihat adalah beban: berapa siswa yang harus dilayani tiap SPPG dibanding kapasitasnya (3.000 penerima/hari).

**Perubahan**
`src/app.js`, sesi baru `// ===== CAKUPAN & BEBAN SPPG =====`:
- `kelompokSppg()`: SPPG di titik yang sama digabung; kapasitas titik = kapasitas x jumlah SPPG di titik itu.
- `hitungBeban()`: tiap sekolah dialokasikan ke titik SPPG terdekat (haversine meter), lalu dihitung beban dan total kelebihan di atas kapasitas.
- `hitungCakupan()`: sekolah di dalam/luar gabungan isochrone, per jenjang (sekolah dan estimasi siswa).
- `gambarCakupan()` (area hijau muda), `gambarBeban()` (halo coklat pada titik yang melebihi kapasitas), `infoBebanSppg()` (beban di popup SPPG), `perbaruiKpi()` (panel).
- Daftar `clear()` ditambah `cover` dan `beban`.
`Index.html`: panel "Cakupan & Beban SPPG" (kapasitas bisa diubah), tombol layer "Cakupan 10 menit" dan "Beban Berlebih", legenda baru.

**Alasan**
- Alokasi ke SPPG terdekat memperlihatkan di mana permintaan lokal melebihi pasokan lokal, tanpa asumsi tambahan.
- Titik kembar digabung karena SPPG di kelurahan yang sama secara posisi tidak bisa dibedakan.
- Jarak haversine ditulis langsung (bukan `turf.distance`) karena dipanggil puluhan ribu kali.
- Kapasitas dijadikan input supaya bisa diuji (mis. 2.000) tanpa mengubah kode.

**Hasil**
Diuji di browser dan dicocokkan dengan hitungan offline (node): cakupan 10 menit SD 99,3% siswa (549/553 sekolah), SMP 100% (200/200), SMA 98,6% (69/70), belum terjangkau 5 sekolah (~1.200 siswa); kapasitas total 369.000, permintaan estimasi 198.600 (54%); 12 dari 88 titik melebihi kapasitas, kelebihan 13.400 siswa (terpadat: Sawah Besar 243%). Dengan kapasitas 2.000 menjadi 29 titik dan 36.100 siswa; kembali ke 3.000 menjadi 12 titik. Console bersih.

**Pelajaran**
Saat satu ukuran (cakupan) sudah jenuh, cari ukuran lain yang masih membedakan (beban/kapasitas). Dan cocokkan hasil di browser dengan hitungan terpisah di Node agar kesalahan rumus ketahuan.

---

## 24. Kandidat SPPG baru berbasis beban (greedy, kapasitas 3.000)

**Masalah**
Rekomendasi lokasi lama (`generateCandidate`) membagi area satu isochrone menjadi grid 1 km dan mengambil 5 sel dengan siswa terbanyak. Hasilnya tidak mempertimbangkan SPPG yang sudah ada, kapasitas, atau jalan, dan ditumpuk di satu area. Karena cakupan 10 menit sudah 99,4%, kandidat berbasis cakupan nyaris tidak berguna.

**Perubahan**
`src/app.js`, sesi baru `// ===== KANDIDAT SPPG BARU (BERBASIS BEBAN) =====` (fungsi lama dihapus, 139 baris):
- `cariKandidat(K)`: metode greedy. Calon lokasi = titik sekolah. Tiap putaran, untuk setiap calon: semua sekolah yang lebih dekat ke calon daripada ke pemberi layanan saat ini berpindah ke calon; skor = pengurangan kelebihan beban di titik asal - kelebihan baru di calon (kapasitas 3.000) + siswa sekolah belum tercakup dalam radius 2 km. Dipilih skor tertinggi, penugasan diperbarui, lalu putaran berikutnya. Berhenti jika skor tidak positif.
- Aturan jarak: calon minimal 300 m dari SPPG ada/kandidat lain dan 1 km dari kandidat lain.
- `gambarKandidat()` (titik pink dengan popup), `teksKandidat()`, `tampilkanHasilKandidat()` (ringkasan sebelum/sesudah dan daftar), tombol "Cari Lokasi SPPG Baru" dan input jumlah (1 sampai 20).
- Kandidat disimpan di `kandidatTerakhir` dan digambar ulang setelah ganti basemap; dihapus jika kapasitas diubah.
`Index.html`: panel "Kandidat SPPG Baru".

**Alasan**
- Ukuran yang membedakan di kota ini adalah beban terhadap kapasitas, bukan cakupan waktu tempuh. Greedy memilih lokasi yang paling banyak mengurangi kelebihan beban, cepat, dan hasilnya mudah dijelaskan.
- Titik sekolah dipakai sebagai calon karena pasti berada di jalan yang bisa dilalui.
- Kandidat tidak dibatasi jumlah sekolah, hanya kapasitas 3.000 siswa (kelebihan di atasnya dihitung sebagai biaya), sesuai permintaan.
- Alokasi ke terdekat memakai jarak garis lurus, bukan waktu tempuh; isochrone kandidat belum dihitung.

**Hasil**
Diuji di browser (waktu sekitar 0,45 detik): 5 kandidat menurunkan kelebihan beban 13.400 -> 3.400 siswa (Tambakrejo, Jatisari, Sekayu, Srondol Wetan, Kaligawe); 10 kandidat menurunkannya menjadi 500 siswa dan siswa belum tercakup 1.200 -> 200. Kandidat tetap tampil setelah ganti basemap. Satu cacat tampilan ("kelebihan -0") ditemukan dan diperbaiki. Console bersih.

**Keterbatasan**
- Siswa per sekolah masih estimasi (SD 200, SMP 300, SMA 400).
- Lokasi kandidat adalah titik sekolah acuan, belum dicek lahan, harga, atau akses.
- Kandidat berikut tidak memperhitungkan waktu tempuh nyata dan isochrone-nya belum dihitung.

**Pelajaran**
Algoritma greedy cocok untuk masalah "pilih k lokasi terbaik": ulangi (pilih yang manfaat tambahannya terbesar, perbarui keadaan). Pastikan skor mengukur manfaat tambahan, bukan manfaat total.

---

## 25. Popup SPPG menampilkan sekolah yang dilayani dan area layanannya

**Masalah / permintaan**
Saat SPPG diklik, popup perlu menunjukkan area dan nama sekolah yang dilayani.

**Perubahan**
`src/app.js`, sesi baru `// ===== LAYANAN SPPG (AREA & SEKOLAH YANG DILAYANI) =====`:
- `sekolahDilayani(f)`: sekolah yang dialokasikan ke titik SPPG itu (SPPG terdekat; konsisten dengan hitungan beban).
- `teksSekolahDilayani(f)`: jumlah sekolah, estimasi siswa, dan nama sekolah per jenjang (SD/SMP/SMA) dalam kotak yang bisa digulir.
- `gambarLayanan(f)` / `hapusLayanan()`: poligon cembung (convex hull) dari sekolah yang dilayani, diperlebar 150 m, ditambah lingkaran biru di tiap sekolah. Klik di luar SPPG menghapusnya; `clear()` juga menghapusnya saat ganti basemap.
- Perbaikan bug: `kelompokSppg()` kini menyimpan `nos` (daftar No SPPG) dan fungsi `idxGrupFitur(f)` mencari titik SPPG lewat `No SPPG`.
`Index.html`: popup dilebarkan (`max-width` 380 px).

**Alasan**
- Bug yang ditemukan saat pengujian: koordinat dari `queryRenderedFeatures` dibulatkan oleh MapLibre (kuantisasi tile), jadi tidak sama persis dengan koordinat di data. Pencocokan lewat koordinat gagal, sehingga bagian "Beban titik ini" (dari entri 23) ternyata tidak pernah muncul di popup. Properti fitur (`No SPPG`) tidak berubah, jadi dipakai sebagai kunci.
- Area layanan memakai hull sekolah yang dilayani agar terlihat sebaran wilayahnya, bukan isochrone 10 menit (yang seluas sekitar 76 km² dan memuat ratusan sekolah).

**Hasil**
Diuji di browser (server statis sementara di port 5510 karena Live Server di 5500 sedang tidak aktif): klik SPPG Lamper Lor 2 menampilkan "Beban titik ini: 1.900 dari 3.000 (63%)", "Sekolah yang dilayani: 7 sekolah (~1.900 siswa)" beserta 3 SD, 3 SMP, 1 SMA berikut namanya, dan area biru muncul di peta. Console bersih (hanya 404 favicon).

**Pelajaran**
Jangan mencocokkan fitur peta dengan data asli lewat koordinat; pakai properti pengenal (id/nomor) yang tetap utuh. Dan uji setiap bagian popup, jangan hanya angka KPI.

---

## 26. Gambar usulan tata letak dashboard (hanya rancangan, belum diterapkan)

**Masalah / permintaan**
Panel di sisi kiri yang memanjang ke bawah membuat area bawah peta terasa kosong, kurang interaktif, dan sulit dibaca. Pengguna meminta ide tata letak dashboard dalam bentuk gambar.

**Perubahan**
Folder baru `docs/ide-dashboard/`: tiga gambar PNG (`opsi-1-sidebar-bertab.png`, `opsi-2-panel-lebar-dua-kolom.png`, `opsi-3-dock-bawah-peta.png`), halaman sumber `mockup.html` (buka dengan `?opsi=1`, `2`, atau `3`), dan `peta.png` (tangkapan peta yang dipakai sebagai latar). Tidak ada perubahan pada aplikasi.

**Alasan**
Mockup memakai angka nyata dari data (cakupan 99,4%, utilisasi 54%, 12 dari 88 SPPG melebihi kapasitas, kelebihan 13.400 siswa) agar pengguna bisa menilai keterbacaan sebelum kode ditulis. Dua angka tidak nyata ditandai: tabel kecamatan di Opsi 2 hanya contoh tata letak.

**Hasil**
Tiga gambar 1440x810 dibuat dari halaman `mockup.html` dan diperiksa secara visual.

**Pelajaran**
Memutuskan tata letak dari gambar lebih murah daripada dari kode. Perubahan tata letak yang sudah dikodekan lebih mahal diubah.

---

## 27. Dashboard Opsi 3: rel ikon, KPI melayang, dock grafik, laci kontrol

**Masalah / permintaan**
Sidebar kiri yang memanjang ke bawah membuat bagian bawah peta kosong dan sulit dibaca. Pengguna memilih tata letak Opsi 3 (gambar di `docs/ide-dashboard/`).

**Perubahan**
`Index.html` disusun ulang (semua `id` lama dipertahankan):
- Rel ikon kiri (`#rail`): Dash, Layer, Param, Kandidat, Data.
- Laci kontrol (`#drawer`): panel lama dikelompokkan per tab (Layer: basemap/layer/legenda; Param: isochrone, SPPG berdekatan, kapasitas, Run Global, hasil Run; Kandidat; Data: kualitas data).
- Kartu KPI melayang (`#kpiStrip`) dan dock grafik (`#dock`) di bawah peta.
- Peta memenuhi layar (`position:absolute`); atribusi peta digeser di atas dock.
`src/app.js`, sesi `// ===== DASHBOARD (REL IKON, KPI MELAYANG, DOCK GRAFIK) =====`:
- `pilihTab()`: tombol Dash menampilkan/menyembunyikan KPI dan dock; tab lain membuka laci dan menggeser KPI/dock; klik tab yang sama menutup laci.
- `renderDashboard()`: kartu KPI, 6 SPPG terpadat (bar dengan garis kapasitas 100%), sebaran utilisasi (3 kelompok), kurva manfaat kandidat (SVG, dihitung tertunda 60 ms), dan kartu kualitas data. Dipanggil dari `perbaruiKpi()`.

**Alasan**
- Isi per tab dan dock horizontal membuat semua informasi utama terlihat tanpa scroll panjang, dan area bawah peta terpakai.
- Kurva manfaat memakai `cariKandidat(20)` untuk melihat kelebihan beban setelah 0 sampai N lokasi; dihitung dengan jeda agar tidak berat saat kapasitas diketik.
- Panel Kualitas Data memperlihatkan keterbatasan (koordinat SPPG, siswa asli 0%) langsung di dashboard.

**Hasil**
Diuji di browser (port 5510): KPI 99,4% / 54% / 12 dari 88 / 13.400; 6 bar SPPG terpadat, histogram 45/31/12 (3 kelompok), kurva 13.400 -> 3.400 (5 lokasi) -> 500 (10) -> 0 (14); semua tab laci dan tombol Dash bekerja; Console tanpa pesan.

**Pelajaran**
Kelompokkan kontrol menurut tugas (lihat peta, atur parameter, cari kandidat) dan tampilkan ringkasan di tempat yang selalu terlihat (dock). Itu lebih terbaca daripada satu kolom panjang.

---

## 28. Koordinat SPPG diperhalus dari titik kelurahan ke titik jalan (alamat)

**Masalah**
Titik kelurahan (entri 16) hanyalah perbaikan darurat: 62 dari 123 SPPG berbagi titik yang sama dengan SPPG lain. Pengguna meminta titik SPPG yang lebih andal.

**Perubahan**
- `scripts/ambil-alamat-sppg.mjs`: mengambil 195 SPPG Kota Semarang (nama, ID, alamat) dari direktori publik infosppg.id ke `data/SPPG_alamat.json`. ID direktori tidak sama dengan `No SPPG`, jadi pencocokan memakai nama (115 dari 123 cocok persis).
- `scripts/geocode-alamat-sppg.mjs`: mengambil nama jalan dari alamat, mencarinya ke Nominatim (tiga variasi kueri), lalu menerima hasil terdekat dengan titik kelurahan lama asalkan <= 2,5 km. Memperbarui `data/SPPG_geocoded.geojson` (`geo_akurasi` = `jalan`; titik kelurahan lama tersimpan di `lng_kelurahan`/`lat_kelurahan`) dan menulis `data/SPPG_alamat_laporan.csv`.

**Alasan**
Alamat jalan jauh lebih spesifik daripada nama kelurahan. Syarat jarak <= 2,5 km mencegah hasil salah tempat (nama jalan yang sama di wilayah lain). Titik kelurahan lama tetap disimpan agar bisa dibandingkan dan dipulihkan.

**Hasil**
Dari 123 SPPG yang dipakai: 77 berkoordinat jalan, 44 tetap titik kelurahan, 2 perkiraan. Selisih titik jalan terhadap titik kelurahan: median 0,35 km, persentil 90 = 1,35 km, maksimum 2,32 km. Titik unik 88 -> 113; 19 SPPG di 9 titik masih berbagi koordinat yang sama (mis. beberapa SPPG di jalan yang sama).
**Keterbatasan:** sumber alamat adalah direktori pihak ketiga (bukan BGN), dan geocoder memberi titik di ruas jalan, bukan titik GPS dapur. Koordinat resmi BGN tidak tersedia untuk publik.

**Pelajaran**
Gunakan sumber paling spesifik yang tersedia, tetapi periksa kewajarannya (jarak ke titik yang sudah diketahui) dan simpan nilai lama agar perubahan bisa diaudit.

---

## 29. Isochrone dihitung ulang dari titik jalan; perbaikan cache data

**Masalah**
Isochrone di entri 19-21 dihitung dari titik kelurahan, padahal koordinat SPPG sudah diperhalus ke titik jalan (entri 28). Setelah berkas data diperbarui, aplikasi juga masih menampilkan angka lama (titik unik 88, koordinat jalan 0).

**Perubahan**
- `scripts/fetch-isochrones.mjs`: opsi `--ulang` mengabaikan hasil lama; keluaran diperbarui di `data/isochrone-sppg-600.geojson` (113 titik unik -> 123 isochrone).
- `src/app.js`: semua `fetch` data memakai `{cache:'no-cache'}` (SD, SMP, SMA, SPPG_geocoded, isochrone).

**Alasan**
- Isochrone harus dihitung dari titik SPPG yang sama dengan yang tampil di peta.
- Tanpa opsi cache, browser menyajikan berkas lama dari cache heuristik sehingga data baru tidak terlihat. `no-cache` membuat browser memeriksa versi terbaru ke server sebelum memakai cache.

**Hasil**
Diverifikasi: 123/123 isochrone, 0 cincin tidak valid, 0 poligon di bawah 10 km2, 2 titik dialihkan otomatis (luas 16 sampai 131 km2, median 76 km2). Satu titik sempat gagal (kegagalan jaringan sesaat) lalu berhasil lewat fitur resume. Dampak di aplikasi: titik SPPG unik 88 -> 113, cakupan 10 menit 99,4% -> 99,5% (820 dari 823 sekolah; belum terjangkau 3 sekolah), titik melebihi kapasitas 12 dari 88 -> 13 dari 113, kelebihan 13.400 -> 14.700 siswa, SPPG berdekatan (500 m) 66 -> 54, kurva kandidat menjadi nol di 16 lokasi. Console tanpa error selain 404 favicon.

**Pelajaran**
Saat data dihasilkan skrip dan sering berubah, jangan lupa lapisan cache: periksa bahwa aplikasi benar-benar memakai berkas terbaru, bukan hanya bahwa berkasnya sudah berubah di disk.

---

## 30. Data jumlah murid resmi BPS per kecamatan (tahun ajaran 2025/2026)

**Masalah**
Jumlah siswa di aplikasi hanyalah estimasi (SD 200, SMP 300, SMA 400 per sekolah), dan jenjang SMK serta madrasah tidak ada. Pengguna menyediakan PDF "Kota Semarang Dalam Angka 2026" (BPS).

**Perubahan**
- Teks PDF diekstrak per halaman (pustaka `pdf-parse` dipasang di folder sementara, di luar proyek; alat `pdftotext`/`pdftoppm` tidak bisa dipakai di lingkungan ini).
- `scripts/parse-bps-murid.mjs`: mengurai tabel 4.1.3 sampai 4.1.9 (SD, MI, SMP, MTs, SMA, SMK, MA), mengambil kolom tahun ajaran 2025/2026 (negeri, swasta, jumlah) untuk 16 kecamatan, dan memeriksa konsistensi.
- Berkas baru `data/murid_bps_2025.json`.

**Alasan**
Ini sumber resmi yang bisa diperiksa: jumlah murid per kecamatan dan per status (negeri/swasta) untuk semua jenjang. Dipakai untuk menggantikan angka tebakan, dengan total per kecamatan tetap sama persis dengan BPS.

**Hasil**
Pemeriksaan otomatis lolos untuk ketujuh jenjang: 16 kecamatan, jumlah kecamatan = total kota BPS, dan negeri + swasta = jumlah. Total Kota Semarang 2025/2026: SD 124.968, MI 19.469, SMP 64.306, MTs 9.298, SMA 30.742, SMK 36.100, MA 6.842 (total 291.725 murid). Bandingkan dengan estimasi lama 198.600 untuk 823 sekolah: estimasi lama kurang sekitar 32%.
**Keterbatasan:** BPS hanya memberi total per kecamatan dan status, bukan per sekolah. Jumlah murid per sekolah nanti dibagi merata dalam satu kecamatan, jenjang, dan status (negeri/swasta), sehingga total per kecamatan akurat tetapi variasi antar sekolah tidak.

**Pelajaran**
Cek total hasil parsing terhadap baris total sumber (jumlah kecamatan = total kota). Itu cara murah untuk menangkap salah baca kolom atau baris yang hilang.

---

## 31. Dashboard dinamis (menurut titik yang diklik) dan popup disederhanakan

**Masalah / permintaan**
KPI melayang dan grafik dock selalu menampilkan ringkasan kota. Pengguna ingin keduanya berubah sesuai titik yang diklik (sekolah atau SPPG). Popup juga disederhanakan: sekolah hanya nama dan jumlah siswa; SPPG hanya jumlah porsi dan jumlah sekolah per jenjang (daftar menurun, tanpa nama sekolah).

**Perubahan**
- `Index.html`: kartu KPI dan dock dibuat generik (`kL/kV/kS 1-4` dan `dJ/dC 1-4`), ditambah tombol `#btnKota` "Kembali ke ringkasan kota".
- `src/app.js`:
  - `JENJANG`: daftar tujuh jenjang (SD, MI, SMP, MTs, SMA, SMK, MA) dengan id layer dan warna; layer, popup, dan `clear()` memakainya.
  - Tiap sekolah diberi nomor `sidx` sebelum menjadi sumber layer, sehingga klik titik langsung menunjuk data sekolahnya (tanpa mencocokkan koordinat).
  - `popupSekolah()` dan `popupSppg()`: isi popup sesuai permintaan. Alasan SPPG berdekatan dipindah ke kartu "Catatan SPPG" di dashboard.
  - Penyaji dashboard: `renderDashboard()` memilih `renderDashKota()` (ringkasan), `renderDashSppg(f)`, atau `renderDashSekolah(idx)` menurut variabel `pilihan`; klik peta kosong atau tombol mengembalikannya ke kota.
  - `hitungCakupan()` kini membuat hitungan per jenjang secara dinamis (tidak lagi tetap SD/SMP/SMA).

**Alasan**
- Satu daftar `JENJANG` menghindari tiga daftar tetap yang tersebar di banyak tempat; menambah jenjang (data sekolah resmi) tinggal menambah data.
- Dashboard yang berganti menurut pilihan menjawab pertanyaan pengguna saat itu (mis. "SPPG ini melayani siapa?") tanpa panel tambahan.
- Satu bug ditemukan saat uji: deklarasi `kurvaTimer` ikut terhapus bersama blok lama sehingga muncul `ReferenceError`; dikembalikan.

**Hasil**
Diuji di browser: ringkasan kota (cakupan 99,5%, utilisasi 54%, 13 dari 113 SPPG di atas kapasitas); klik SMP -> popup "SMP PUTRA NUSANTARA / Jumlah siswa: 300", dashboard berisi siswa, jenjang, SPPG pelayan (utilisasi 123%), jarak 1,8 km; klik SPPG Karangayu -> popup "Jumlah porsi: 2.800 / hari" dengan daftar SD: 7, SMP: 2, SMA: 2, dashboard berisi sekolah dan siswa per jenjang (SD 1.400, SMP 600, SMA 800), beban 2.800 dari 3.000; tombol kembali dan klik peta kosong mengembalikan ringkasan kota. Console bersih (hanya 404 favicon).
**Keterbatasan:** jumlah siswa per sekolah masih estimasi lama (SD 200, SMP 300, SMA 400) sampai data sekolah resmi dan murid BPS digabung.

**Pelajaran**
Pisahkan "data yang dipilih" dari "cara menampilkannya": satu variabel `pilihan` dan satu penyaji yang memilih tampilan membuat dashboard mudah diperluas.

---

## 32. Aplikasi memakai sekolah resmi dan murid BPS (tujuh jenjang)

**Masalah**
Data murid BPS sudah dibaca (entri 30), tetapi aplikasi masih membaca tiga berkas lama (SD, SMP, SMA tanpa data siswa) dan memakai tebakan 200/300/400, sehingga angka siswa di dashboard tidak berubah. Pengguna menanyakan hal ini. Penyebabnya langkah penyambungan ke aplikasi belum dikerjakan.

**Perubahan**
- `scripts/ambil-sekolah-kemendikdasmen.mjs`: mengambil 1.072 sekolah resmi Kota Semarang (NPSN, nama, bentuk, status, alamat, kelurahan, kecamatan, koordinat) dari halaman referensi Kemendikdasmen ke `data/sekolah_resmi.json`.
- `scripts/bangun-data-sekolah.mjs`: menggabungkan sekolah resmi dengan murid BPS menjadi `data/sekolah.geojson` (+ `data/sekolah_laporan.json`). Murid BPS per (jenjang, kecamatan, negeri/swasta) dibagi rata ke sekolah resmi di kelompok itu. Koordinat dengan tanda lintang terbalik diperbaiki (1), koordinat hilang diselamatkan dari data lama lewat nama (5).
- `src/app.js`: membaca `data/sekolah.geojson`; `getSiswa` memakai properti `siswa` (tebakan hanya cadangan); `analyze` dan `drawChart` kini per jenjang untuk SD, MI, SMP, MTs, SMA, SMK, MA; panel cakupan dan hasil Run dibuat dinamis; bobot heatmap dinormalisasi dengan acuan 600 siswa; label diganti "BPS 2025/2026, dibagi rata".
- `Index.html`: tombol layer dan legenda untuk tujuh jenjang.

**Alasan**
Jenjang ditulis apa adanya (tidak digabung) sesuai permintaan pengguna. Pembagian rata per kelompok membuat total per kecamatan dan status persis sama dengan BPS, satu-satunya cara jujur tanpa data per sekolah.

**Hasil**
Diverifikasi: murid yang dialokasikan = total BPS untuk ketujuh jenjang (SD 124.968, MI 19.469, SMP 64.306, MTs 9.298, SMA 30.742, SMK 36.100, MA 6.842). Di peta: 1.004 dari 1.042 sekolah (38 tanpa koordinat, sekitar 3,6%). Dampak di aplikasi: sekolah 823 -> 1.004; murid 198.600 -> 285.338; utilisasi 54% -> 77%; SPPG di atas kapasitas 13 -> 40 dari 113; kelebihan 14.700 -> 48.327 siswa; cakupan 10 menit 99,1% (992 dari 1.004). Kandidat: 10 lokasi menurunkan kelebihan menjadi 23.759 dan 20 lokasi menjadi 9.021. Run Global menampilkan ketujuh jenjang. Console bersih.
**Keterbatasan:** jumlah murid per sekolah tetap hasil bagi rata, bukan data per sekolah; satu sekolah tanpa bagian (0) memakai nilai cadangan 300; 38 sekolah belum terpetakan; batas jumlah kandidat 20 belum cukup untuk menutup kelebihan.

**Pelajaran**
Memperbarui data tidak selesai saat berkas data dibuat; ia selesai saat aplikasi benar-benar memakainya dan angkanya terbukti berubah. Jangan hanya melaporkan "data sudah masuk".

---

## 33. Geocoding 38 sekolah tanpa koordinat; semua 1.042 sekolah terpetakan

**Masalah**
38 dari 1.042 sekolah resmi (sekitar 3,6%) tidak punya koordinat di data Kemendikdasmen, sehingga tidak muncul di peta dan muridnya tidak dihitung dalam beban SPPG.

**Perubahan**
- `scripts/geocode-sekolah-tanpa-koordinat.mjs`: mencari koordinat sekolah tanpa Lintang/Bujur lewat Nominatim (nama sekolah, lalu nama jalan dari alamat), memeriksa hasil terhadap titik tengah sekolah lain di kelurahan yang sama (maks 2,5 km), dan memakai titik tengah kelurahan jika tidak ditemukan. Keluaran: `data/sekolah_geocode_tambahan.json`.
- `scripts/bangun-data-sekolah.mjs`: memakai hasil itu sebagai cadangan terakhir (`koordinat_sumber` = `geocode_nama_sekolah`, `geocode_jalan`, atau `geocode_kelurahan_perkiraan`); `data/sekolah.geojson` dibangun ulang.

**Alasan**
Sekolah yang tidak terpetakan membuat permintaan terhitung terlalu rendah. Titik tengah kelurahan lebih baik daripada tidak ada, asalkan ditandai sebagai perkiraan.

**Hasil**
Dari 43 sekolah yang diproses: 23 ditemukan lewat Nominatim (1 nama sekolah, 22 jalan; selisih median 0,68 km dari titik tengah kelurahan, maksimum 2,13 km) dan 20 memakai titik tengah kelurahan (perkiraan). 0 gagal. 38 di antaranya memang tidak punya koordinat resmi dan kini terpetakan. Sekarang 1.042 dari 1.042 sekolah ada di peta dan murid yang dialokasikan sama persis dengan total BPS (SD 124.968, MI 19.469, SMP 64.306, MTs 9.298, SMA 30.742, SMK 36.100, MA 6.842). Dampak di aplikasi: utilisasi kota 79% (292.425 dari 369.000), SPPG di atas kapasitas 41 dari 113, kelebihan 52.372 siswa, cakupan 10 menit 99,2% (1.030 dari 1.042; 12 sekolah belum terjangkau). Console bersih.
**Keterbatasan:** 20 sekolah masih berupa titik tengah kelurahan; dua sekolah yang mendapat bagian murid 0 dari pembagian BPS memakai nilai cadangan (selisih 700 siswa dari total BPS).

**Pelajaran**
Selalu catat tingkat kepastian tiap koordinat (resmi, jalan, kelurahan) agar pengguna tahu mana yang bisa dipercaya penuh.

---

## 34. Toggle layer ringkas per jenjang setara dan tab Analisis terpisah

**Masalah / permintaan**
Daftar layer terlalu panjang (tujuh jenjang) dan mencampur titik data dengan hasil perhitungan (heatmap, kandidat, cakupan, beban berlebih). Pengguna meminta titik tetap dibedakan per bentuk (SD, MI, SMP, MTs, SMA, SMK, MA) tetapi toggle diringkas per jenjang setara, dan hasil analisis dipisah dari layer titik.

**Perubahan**
- `Index.html`: tab Layer kini hanya berisi basemap dan toggle titik: "SD / MI", "SMP / MTs", "SMA / SMK / MA", "SPPG"; legenda titik. Tab baru **Analisis** (rel ikon ke-3) berisi toggle Cakupan isochrone, Beban berlebih, Heatmap siswa, Kandidat SPPG baru, beserta legenda analisis.
- `src/app.js`: `toggleLayer()` menerima beberapa id dipisah koma (mis. `'sd-layer,mi-layer'`); status ditentukan dari layer pertama yang ada.

**Alasan**
Titik dan nama tiap bentuk tetap terpisah di peta dan popup (data lebih akurat), sedangkan toggle per jenjang setara cukup untuk mengatur tampilan. Memisahkan "titik data" dari "hasil perhitungan" membuat pengguna tahu mana fakta dan mana penilaian.

**Hasil**
Diuji di browser: rel berisi Dash, Layer, Analisis, Param, Kandidat, Data; tab Layer berisi Street, Dark, Satellite, SD / MI, SMP / MTs, SMA / SMK / MA, SPPG; tab Analisis berisi empat toggle; satu klik "SD / MI" menyembunyikan titik SD dan MI sekaligus (diperiksa pada tangkapan layar). Console bersih (hanya 404 favicon).

**Pelajaran**
Satu tombol bisa mengendalikan beberapa layer bila fungsi toggle menerima daftar id. Pisahkan fakta (titik) dari penilaian (hasil model) di antarmuka.

---

## 35. Alasan pemilihan lokasi kandidat berbasis fakta dan data

**Masalah / permintaan**
Kandidat SPPG baru hanya menampilkan angka hasil (sekolah diambil alih, siswa). Pengguna meminta penjelasan "mengapa di titik ini" yang harus berdasarkan fakta dan data.

**Perubahan**
`src/app.js`:
- `cariKandidat()` kini menyimpan fakta pendukung per kandidat: jarak ke SPPG terdekat sebelum dibangun, utilisasi tiap SPPG yang diringankan (sebelum -> sesudah), jumlah sekolah per jenjang yang diambil alih, jumlah siswa dalam radius 2 km dan jumlah serta kapasitas SPPG dalam radius itu, dan jumlah sekolah di luar isochrone yang terjangkau.
- `alasanKandidat()` menyusun daftar alasan dari fakta itu; dipakai di popup kandidat ("Mengapa di sini:") dan di daftar kandidat (bagian "Mengapa di sini?" yang bisa dibuka).

**Alasan**
Penjelasan harus bisa diperiksa: tiap kalimat memuat angka yang dihitung dari data (BPS, titik SPPG, isochrone), bukan asumsi. Pengguna bisa menilai apakah alasannya masuk akal.

**Hasil**
Diuji di browser. Contoh kandidat #1 (Srondol Wetan, Banyumanik): meringankan 3 SPPG yang melebihi kapasitas (Srondol Wetan 241% -> 148%, Banyumanik 140% -> 108%, Gedawang 140% -> 134%); mengambil alih 15 sekolah (SD 8, SMP 4, SMA 1, SMK 2) dengan 3.909 siswa (130% dari kapasitas 3.000); dalam radius 2 km ada 17.215 siswa sedangkan 4 SPPG yang ada berkapasitas 12.000 (permintaan 143%); jarak ke SPPG terdekat 0,3 km. Console bersih.
**Keterbatasan:** jarak masih garis lurus dan alokasi ke SPPG terdekat; alasan akan diperbarui setelah alokasi berbasis waktu tempuh diterapkan.

**Pelajaran**
Hasil model sebaiknya selalu disertai bukti yang bisa diperiksa. Simpan fakta saat menghitung, bukan merangkai alasan sesudahnya.

---

## 36. Alokasi sekolah ke SPPG berdasarkan waktu tempuh; alokasi berkapasitas dan skenario kapasitas

**Masalah / permintaan**
Alokasi sekolah ke SPPG memakai jarak garis lurus. Pengguna meminta waktu tempuh, dengan catatan "di luar isochrone 10 menit", kriteria kelayakan BGN (30 menit) dan skenario kapasitas.

**Perubahan**
- `scripts/fetch-matriks-waktu.mjs`: menghitung matriks waktu tempuh berkendara (detik) dari 113 titik SPPG ke 1.042 sekolah lewat OpenRouteService Matrix API (45 permintaan, potongan 50 x 70 rute) ke `data/waktu-tempuh.json`.
- `src/app.js`:
  - `hitungBeban()` memilih SPPG tercepat menurut waktu tempuh (jarak garis lurus hanya cadangan).
  - `alokasiBerkapasitas()`: sekolah diurut menurut regret (selisih waktu ke pilihan terbaik dan kedua), dilayani SPPG tercepat yang masih punya sisa kapasitas dan <= 30 menit; yang tidak tertampung dicatat; yang dilayani melewati 10 menit dicatat "di luar isochrone 10 menit".
  - Dashboard sekolah: waktu tempuh ke SPPG pelayan, lima SPPG tercepat (waktu), dan peringatan jika SPPG pelayan lebih dari 10 menit.
  - Panel Param: KPI alokasi berkapasitas (tertampung, tidak tertampung, di luar 10 menit, rata-rata waktu) dan tombol skenario kapasitas 2.000 / 2.500 / 3.000.

**Alasan**
Waktu tempuh mencerminkan jaringan jalan, sedangkan garis lurus mengabaikan sungai, jalan tol, dan jalan buntu. Aturan BGN yang ditemukan memakai ukuran waktu (maks 30 menit) dan radius, sehingga waktu lebih sahih. Alokasi berkapasitas menunjukkan kekurangan nyata: berapa siswa tidak tertampung saat kapasitas SPPG habis.

**Hasil**
Matriks: 45 permintaan, 0 pasangan tidak terhubung, semua 1.042 sekolah punya SPPG terjangkau; waktu ke SPPG tercepat median 2,6 menit, persentil 90 = 5,5 menit, maksimum 17,4 menit.
Diuji di browser (alokasi berkapasitas, batas 30 menit):
- kapasitas 3.000: tertampung 292.425 siswa (100%), tidak tertampung 0, di luar 10 menit 8.900 siswa, rata-rata 3,9 menit;
- kapasitas 2.500: tertampung 292.183 (100%), tidak tertampung 242, di luar 10 menit 32.972, rata-rata 5,1 menit;
- kapasitas 2.000: tertampung 242.431 (83%), tidak tertampung 49.994, di luar 10 menit 29.481, rata-rata 5,7 menit.
Tekanan permintaan (alokasi ke SPPG tercepat tanpa batas kapasitas): 37 dari 113 titik melebihi kapasitas 3.000 dan kelebihan 103.716 siswa (dengan garis lurus: 41 titik, 52.372). Sekolah SD Negeri Gajahmungkur 02: dilayani SPPG Gajahmungkur 2 dalam 1,4 menit (0,9 km lurus). Console bersih.
**Keterbatasan:** (1) SPPG yang koordinatnya titik kelurahan (46 dari 123) mungkin tersnap ke jalan yang kurang representatif sehingga memengaruhi waktu tempuhnya; (2) hasil tekanan permintaan sangat sensitif terhadap model (garis lurus vs waktu); (3) evaluasi kandidat masih memakai jarak garis lurus sebagai pendekatan dan belum memakai waktu tempuh dari titik kandidat.

**Pelajaran**
Uji sensitivitas: dua definisi "terdekat" menghasilkan beban yang sangat berbeda. Itu sebabnya hasil model harus disertai keterbatasannya, dan keputusan penting sebaiknya diperiksa dengan lebih dari satu cara.

---

## 37. Isochrone dinamis: slider waktu tempuh 1 sampai 10 menit

**Masalah / permintaan**
Isochrone statis di 600 detik. Pengguna ingin bisa memilih waktu tempuh, dengan batas maksimum 600 detik, agar dashboard lebih interaktif.

**Perubahan**
- `scripts/fetch-isochrones-multi.mjs`: menarik isochrone untuk 113 titik SPPG pada sepuluh waktu sekaligus (60, 120, ..., 600 detik) dalam satu permintaan per titik, dengan perbaikan otomatis untuk isochrone terlalu kecil. Keluaran `data/isochrone-multi.geojson` (1.130 poligon, 1,9 MB; properti `titik` dan `waktu_detik`).
- `src/app.js`: `waktuIso` (detik) menyimpan pilihan pengguna; `gabungIsochrone(waktu)` menggabungkan poligon pada waktu itu dengan cache per waktu; `getIso()` mencari poligon SPPG terpilih pada `waktuIso`; `terapkanCakupan()` menghitung ulang cakupan, layer, dan KPI tanpa menghitung ulang alokasi; label KPI dan kartu dashboard mengikuti waktu terpilih.
- `Index.html`: slider `#waktuMenit` (1 sampai 10 menit) menggantikan kotak waktu terkunci.

**Alasan**
Waktu tempuh yang berbeda tidak bisa diturunkan dari satu poligon 600 detik, tetapi satu permintaan ORS dapat memuat banyak interval, sehingga cukup 113 permintaan. Dengan data statis per menit, slider bekerja cepat tanpa memanggil API dan tanpa menaruh API key di browser. Alokasi dan beban tidak diulang saat slider digeser karena tidak bergantung pada waktu yang dipilih.

**Hasil**
Diverifikasi: 113/113 titik, 10 waktu, 1.130 poligon valid. Di browser, cakupan gabungan: 1 menit 29,4% (270 dari 1.042 sekolah), 3 menit 81,4% (814), 5 menit 94,5% (974), 10 menit 99,3% (1.032); pertama kali sekitar 4,5 detik per waktu, berikutnya lebih cepat karena cache. Run Isochrone untuk SPPG Karangayu: 3 menit = 15 sekolah (5.693 siswa), 10 menit = 425 sekolah (124.611 siswa). Console bersih.
**Catatan:** berkas lama `data/isochrone-sppg-600.geojson` kini tidak dipakai aplikasi.

**Pelajaran**
Hitung sekali di belakang (offline) hal yang berat dan berulang, lalu sajikan secara interaktif di depan. Interaktivitas tidak harus berarti perhitungan langsung.

---

## 38. Opsi D: dijangkau vs dilayani vs tumpang tindih pada hasil Run

**Masalah / permintaan**
Hasil Run Isochrone menyebut sekolah "terlayani" padahal itu jangkauan isochrone yang tumpang tindih antar SPPG; menjumlahkannya antar SPPG akan menghitung ganda. Pengguna menyetujui Opsi D: tampilkan dijangkau dan dilayani sekaligus beserta ukuran tumpang tindih.

**Perubahan**
`src/app.js`, sesi `// ===== OPSI D =====`:
- `jumlahPenjangkau(waktu)`: jumlah titik SPPG yang menjangkau tiap sekolah pada waktu terpilih (cache per waktu).
- `sekolahDalam(poligon)` dan `ringkasanD(f,iso)` (Run Isochrone): **dijangkau** (tidak eksklusif), **dilayani** (alokasi waktu tempuh, eksklusif) beserta berapa yang dilayani di luar isochrone, dan **tumpang tindih** (persen sekolah yang juga dijangkau SPPG lain dan rata-rata titik SPPG per sekolah).
- `ringkasanGlobal()` (Run Global): sekolah dijangkau minimal satu SPPG (dihitung sekali) dan tumpang tindihnya.
`Index.html`: istilah "Terlayani" diganti "dijangkau" dan ditambah wadah `#hasilD`.

**Alasan**
"Dijangkau" dan "dilayani" adalah dua pertanyaan berbeda. Jangkauan menjawab "siapa yang masuk waktu tempuh", alokasi menjawab "siapa yang benar-benar dilayani SPPG ini". Memisahkannya mencegah penghitungan ganda dan memperlihatkan redundansi.

**Hasil**
Diuji di browser (waktu 10 menit): SPPG Karangayu dijangkau 425 sekolah (124.611 siswa) tetapi dilayani 3 sekolah (831 siswa); 100% sekolah yang dijangkau juga dijangkau SPPG lain, rata-rata 49,2 titik per sekolah. Global: 1.032 dari 1.042 sekolah dijangkau (290.355 siswa, dihitung sekali), 99% dijangkau lebih dari satu titik SPPG, rata-rata 34,0 titik per sekolah. Console bersih.
**Makna:** isochrone 10 menit terlalu longgar untuk menjadi ukuran kecukupan SPPG; hampir setiap sekolah dijangkau puluhan titik SPPG. Ukuran yang lebih bermakna adalah alokasi berkapasitas dan waktu tempuh ke SPPG pelayan.

**Pelajaran**
Satu kata ("terlayani") yang dipakai untuk dua konsep menyesatkan. Beri nama berbeda, dan sertakan ukuran tumpang tindih agar pembaca tahu angka mana yang boleh dijumlahkan.

---

## 39. Tiga usulan tema warna (hanya rancangan, belum diterapkan)

**Permintaan**
Pengguna meminta tiga template warna yang sesuai untuk tema SPPG, dalam bentuk gambar, untuk dipilih sendiri.

**Perubahan**
Folder baru `docs/ide-tema/`: `tema-1-hijau-gizi.png`, `tema-2-terakota-hangat.png`, `tema-3-malam-analitik.png`, halaman sumber `mockup-tema.html` (buka dengan `?tema=1`, `2`, atau `3`), serta `peta-terang.png` dan `peta-gelap.png` (peta bersih dari aplikasi sebagai latar). Tidak ada perubahan pada aplikasi.

**Alasan**
Tiap mockup memakai tata letak Opsi 3 yang sudah dipilih, dengan angka nyata dari data, dan menyertakan palet (primer, sekunder, aksen, rel, latar, kartu, baik, waspada, bahaya) beserta kode warna titik untuk ketujuh jenjang, SPPG, SPPG berdekatan, halo beban berlebih, kandidat, dan area cakupan. Warna "baik/waspada/bahaya" konsisten di tiap tema agar makna status tidak berubah.

**Hasil**
Tiga gambar dibuat dan diperiksa visual. Satu cacat teks palet pada tema gelap (teks gelap di atas warna gelap) ditemukan dan diperbaiki dengan pemilihan warna teks otomatis menurut kecerahan.
**Catatan:** titik pada peta mockup adalah ilustrasi tata warna (posisi acak tetap), bukan data.

**Pelajaran**
Uji keterbacaan teks pada setiap latar warna; kontras mudah terlewat saat membuat varian tema.

---

## 40. Menerapkan Tema 3 (Malam Analitik) ke aplikasi

**Permintaan**
Pengguna memilih Tema 3 dari tiga usulan pada entri 39 dan meminta tema itu dipakai pada aplikasi.

**Perubahan**
`Index.html`: variabel warna (rel, laci, kartu KPI, dock, popup, kontrol) diganti ke palet Tema 3, dan legenda memakai warna jenjang serta SPPG yang baru. `src/app.js`: warna titik dan lapisan peta disesuaikan, dan basemap awal kini gelap.

**Alasan**
Warna status dipertahankan konsisten (hijau baik, kuning waspada, oranye bahaya) agar makna tidak berubah antar tema. Titik SPPG putih, SPPG berdekatan merah muda terang, halo beban berlebih oranye, kandidat merah muda, area cakupan hijau, sehingga tiap lapisan mudah dibedakan di atas basemap gelap.

**Hasil**
Diuji di browser, tampilan sesuai mockup Tema 3 dan Console bersih (hanya peringatan CDN Tailwind dan 404 `favicon.ico`, keduanya tidak berpengaruh).

**Pelajaran**
Memusatkan warna pada variabel membuat pergantian tema cukup satu tempat; warna yang ditulis langsung di kode JavaScript tetap harus disamakan secara terpisah.

---

## 41. Memperbaiki titik SPPG lewat nama jalan di OpenStreetMap

**Permintaan**
Sebanyak 31 SPPG masih memakai titik pusat kelurahan, sehingga posisinya kurang tepat untuk isochrone dan alokasi.

**Perubahan**
Skrip baru `scripts/geocode-sppg-overpass.mjs` mencari ruas jalan atau nama tempat dari alamat lewat Overpass API (kata kunci dari nama jalan, nomor rumah, kata cadangan), lalu mengambil titik pada ruas itu yang terdekat dengan titik kelurahan. `scripts/ambil-alamat-sppg.mjs` kini ikut mengambil alamat Kabupaten Semarang (`data/SPPG_alamat_kab.json`, untuk SPPG Ungaran). Hasil: `data/SPPG_geocoded.geojson` dan laporan `data/SPPG_overpass_laporan.csv`.

**Alasan**
1. Nominatim tidak menemukan banyak jalan (ejaan berbeda, gang, perumahan), jadi dipakai pencocokan kata kunci yang longgar.
2. Server Overpass sering penuh, jadi permintaan diulang bertahap (8, 16, 32, 60 detik) dan memakai dua server.
3. Hasil kosong akibat "runtime error" atau `fetch failed` bukan berarti alamat tidak ada, jadi tidak dihitung sebagai hasil.

**Hasil**
Tiga putaran: 12 dari 31 SPPG mendapat titik lebih akurat (8 ruas jalan, 4 tempat). 19 SPPG tetap di titik kelurahan karena gagal jaringan atau tidak ditemukan; ini dicatat sebagai batasan data. Titik SPPG unik: 120.
**Catatan:** koordinat 19 SPPG itu masih perkiraan tingkat kelurahan.

**Pelajaran**
Bedakan "tidak ditemukan" dari "gagal bertanya". Hasil kosong dari layanan luar harus diperiksa penyebabnya sebelum dipercaya.

---

## 42. Menghitung ulang isochrone dan matriks waktu tempuh dengan titik SPPG baru

**Permintaan**
Setelah titik SPPG diperbaiki (entri 41), isochrone dan matriks waktu tempuh harus dihitung ulang agar sesuai posisi baru.

**Perubahan**
`data/isochrone-multi.geojson` dan `data/waktu-tempuh.json` dihasilkan ulang dari OpenRouteService dengan `scripts/fetch-isochrones-multi.mjs` dan `scripts/fetch-matriks-waktu.mjs` (kode skrip tidak diubah).

**Alasan**
1. Skrip isochrone bisa dilanjutkan dan hanya menarik titik yang belum ada, sehingga hemat kuota API; titik yang sudah tidak dipakai menyisakan 19 titik (190 poligon) usang yang dibuang secara manual.
2. Matriks dihitung penuh karena satu perubahan titik mengubah baris waktu tempuhnya.

**Hasil**
1.200 poligon (120 titik x 10 waktu), semua cocok dengan titik SPPG. Matriks 120 SPPG x 1.042 sekolah, tidak ada yang tidak terhubung; waktu ke SPPG tercepat: median 2,5 menit, persentil 90 5,2 menit, maksimum 17,4 menit. Diuji di browser: cakupan 10 menit 99,3% (1.032 dari 1.042 sekolah), 36 dari 120 titik SPPG melebihi kapasitas, Console bersih.

**Pelajaran**
Data turunan (isochrone, matriks) harus dibangun ulang setiap kali data sumbernya (titik SPPG) berubah, dan kunci datanya (koordinat) perlu dicocokkan agar tidak tersisa data usang.

---

## 43. Langkah A: kandidat SPPG baru dinilai dengan waktu tempuh dari 150 calon lokasi

**Permintaan**
Kandidat lokasi SPPG baru masih dinilai dengan jarak garis lurus, padahal alokasi sekolah ke SPPG sudah memakai waktu tempuh dan kapasitas. Pengguna meminta penilaian kandidat diselaraskan (Langkah A).

**Perubahan**
1. `scripts/pilih-kandidat.mjs` (baru): memilih 150 calon lokasi dari titik sekolah ke `data/kandidat-lokasi.json`. Skor calon = kelebihan siswa dalam 2 km di atas kapasitas SPPG sekitar + 2 x siswa dalam 2 km yang waktu tempuh ke SPPG tercepatnya lebih dari 10 menit; jarak minimal 300 m ke SPPG dan 1 km antar calon.
2. `scripts/fetch-matriks-kandidat.mjs` (baru): matriks waktu tempuh 150 calon x 1.042 sekolah dari OpenRouteService ke `data/waktu-kandidat.json` (45 permintaan, 156.300 rute, semuanya terhubung).
3. `src/app.js`: `cariKandidat(K)` kini memakai `cariKandidatWaktu` (sekolah pindah ke calon hanya bila waktunya lebih cepat dan tidak lebih dari 30 menit, batas BGN; cakupan "belum tercakup" diukur dalam 10 menit, bukan radius 2 km). Versi garis lurus diganti nama `cariKandidatLurus` dan tetap dipakai sebagai cadangan bila `waktu-kandidat.json` tidak termuat. Teks alasan kandidat kini memuat rata-rata waktu tempuh yang dihemat sekolah yang diambil alih.

**Alasan**
1. Memilih 150 calon dahulu membuat matriks cukup 150 baris, bukan 1.042, dan hitungan di browser jauh lebih ringan (20 kandidat dalam sekitar 0,1 detik).
2. Pemilihan calon tidak memakai kapasitas yang diketik pengguna (kapasitas acuan 3.000 hanya untuk mengurutkan); keputusan akhir tetap di aplikasi dengan kapasitas yang sedang dipakai. Calon berskor 0 diurutkan menurut kepadatan siswa agar tetap berguna bila kapasitas diturunkan.
3. Cadangan dipertahankan agar aplikasi tetap berjalan bila berkas data tidak ada.

**Hasil**
Diuji di browser, Console bersih (hanya 404 `favicon.ico`). Kurva manfaat (kelebihan beban 95.627 siswa) berubah dari 80.627 / 65.627 / 38.879 untuk 5 / 10 / 20 lokasi (jarak garis lurus) menjadi 81.800 / 68.917 / 48.393 (waktu tempuh). Jalur cadangan diuji dengan menyembunyikan berkas data: angkanya sama dengan sebelum Langkah A.
**Makna:** penilaian waktu tempuh lebih hati-hati; manfaat kandidat lebih kecil daripada perkiraan garis lurus. Selisih berasal dari dua hal sekaligus (waktu tempuh dan pembatasan ke 150 calon), tidak dipisahkan satu per satu.
**Catatan:** 69 dari 150 calon berskor 0 pada kapasitas acuan 3.000; mereka hanya berguna bila kapasitas diturunkan.

**Pelajaran**
Ukuran yang dipakai untuk menilai usulan harus sama dengan ukuran yang dipakai untuk menghitung kondisi sekarang. Bila tidak, perbaikan yang tampak di peta belum tentu terjadi saat alokasi dihitung ulang.

---

## 44. Menyiapkan proyek sebagai portfolio: README baru dan tangkapan layar

**Permintaan**
Pengguna meminta penilaian kesiapan proyek sebagai portfolio dan menjalankan langkah yang disarankan.

**Perubahan**
1. `README.md` ditulis ulang: pertanyaan yang dijawab, tautan demo, temuan utama dengan angka, fitur, cara kerja, bagian "Keterbatasan data", teknologi, cara menjalankan dan menghitung ulang data, serta nama penulis.
2. `docs/screenshot/dashboard.png` dan `docs/screenshot/kandidat.png` (diambil dari aplikasi yang berjalan).
3. `.gitignore` ditambah `.vscode/` agar pengaturan editor tidak muncul terus di status git.

**Alasan**
1. README lama hanya menyebut SD/SMP/SMA, tidak punya tangkapan layar, tautan demo, atau penjelasan metode, dan penulisnya masih "Nama Kamu". Reviewer hanya punya README dan tampilan repo untuk menilai.
2. Keterbatasan (siswa hasil bagi rata, kapasitas dari berita, 19 titik SPPG setingkat kelurahan, kandidat dari 150 calon) ditulis terbuka karena membuat angka lebih dapat dipercaya, bukan lebih lemah.
3. Angka di README diambil dari aplikasi dan log hitungan, bukan diketik dari ingatan.

**Hasil**
README mengikuti isi aplikasi saat ini. Tautan demo bergantung pada GitHub Pages yang diaktifkan di pengaturan repo (belum dapat diperiksa dari lingkungan kerja ini).

**Pelajaran**
Proyek yang kuat secara teknis tetap perlu ditulis agar terbaca: temuan di bagian atas, metode ringkas, dan batasan yang jujur.

## 45. Alokasi berkapasitas, sekolah jauh, warna Template A, dan KPI lebih ringkas

**Masalah**
Popup SPPG menampilkan "porsi" yang timpang (Mijen 8.640, Mijen 2 hanya 389) dan 14 dari 120 titik bernilai 0. Penyebabnya aturan pemenang tunggal: tiap sekolah dilayani SPPG tercepat tanpa batas kapasitas, dan "porsi" sebenarnya hanya jumlah siswa di area terdekat (1 siswa = 1 porsi).

**Perubahan**
1. `hitungBeban` memakai `alokasiBerkapasitas` (batas 30 menit BGN): sekolah dilayani SPPG tercepat yang masih punya sisa kapasitas; yang tidak muat ditandai `tertampung:false`. Bentuk hasilnya tidak berubah, jadi popup, dashboard, dan kandidat ikut.
2. Popup SPPG: "Siswa dialokasikan", titik berisi beberapa SPPG menampilkan angka per SPPG.
3. Lapisan `status`: cincin merah untuk sekolah di luar isochrone 10 menit, cincin lebih besar untuk yang tidak tertampung; tombol "Hanya sekolah jauh / tidak tertampung".
4. Warna Template A: SD/MI biru, SMP/MTs kuning, SMA/SMK/MA ungu, madrasah berpinggiran putih; SPPG hitam.
5. Kartu KPI dan dock grafik diperkecil.
6. Kurva manfaat kandidat kini memakai siswa tidak tertampung + di luar 10 menit.

**Alasan**
Kapasitas 3.000 mengikuti aturan BGN. Batas 10 menit dipertahankan sebagai ukuran ketat, karena tidak ada sekolah lebih dari 17,4 menit dari SPPG terdekat (jauh di bawah batas BGN 20-30 menit).

**Hasil**
Pada kapasitas 3.000: utilisasi kota 79%, 0 siswa tidak tertampung, titik SPPG kosong turun dari 14 ke 4, 10 sekolah di luar 10 menit. Lima kandidat sudah menghabiskan sisa masalah (2.070 siswa menjadi 0). Console bersih.

**Pelajaran**
Angka "beban" bergantung pada aturan alokasi: pemenang tunggal mengukur kebutuhan area terdekat, bukan kapasitas yang terpakai. Label dan aturan harus sejalan. Dua penanda yang sama-sama merah (SPPG berdekatan dan sekolah jauh) membingungkan, jadi satu warna satu arti.

## 46. Aturan alokasi SPPG-sentris dan koordinat SPPG baru

**Permintaan**
Aturan resmi (maks 3.000 porsi/hari, waktu tempuh <= 30 menit) dan prioritas: tiap SPPG mengutamakan sekolah terdekatnya sampai kuota penuh, baru sekolah yang tersisa diambil SPPG terdekat lain. Lalu hitung ulang titik SPPG yang koordinatnya berubah.

**Perubahan**
1. `alokasiBerkapasitas` kini mengurutkan semua pasangan SPPG-sekolah dari waktu tempuh terpendek, lalu menerima pasangan bila sekolah belum dilayani dan kuota SPPG masih muat (sebelumnya: sekolah dengan pilihan paling sedikit didahulukan).
2. Koordinat 6 SPPG diganti hasil geocoding lanjutan (3 tingkat jalan, 3 tingkat tempat); titik kelurahan turun dari 19 menjadi 13.
3. Dihitung ulang: isochrone 6 titik baru (poligon lama dihapus, skrip yang bisa dilanjutkan hanya menarik yang hilang), matriks waktu SPPG-sekolah, pilihan 150 kandidat, dan matriks kandidat-sekolah.

**Alasan**
Urutan berbasis waktu terpendek membuat tiap SPPG menyerap sekolah terdekatnya lebih dulu, sesuai aturan pengguna. Matriks harus dihitung ulang karena baris SPPG yang pindah tidak berlaku lagi.

**Hasil**
Semua siswa tertampung pada 3.000 (utilisasi kota 79%), rata-rata waktu tempuh 3,53 menit dari 3,79, Mijen 2 naik dari 607 ke sekitar 1.700 siswa. Harganya: sekolah yang dilayani SPPG lebih dari 10 menit naik dari 21 ke 38 (terjauh 23,2 menit, masih di bawah 30). Perhitungan ulang: 0 pasangan tidak terhubung, waktu tercepat median 2,5 menit, maksimum 17,4 menit.

**Pelajaran**
Aturan urutan penugasan menentukan siapa mendapat apa; angka per SPPG tidak punya satu jawaban "benar" sampai aturannya disepakati. Skrip yang bisa dilanjutkan (melewati hasil yang sudah ada) membuat pembaruan sebagian murah.

## 47. Memperbaiki dashboard dari sudut pandang pengguna pertama kali

**Masalah**
Ditinjau seperti orang yang belum pernah melihatnya: tidak ada judul atau penjelasan, legenda tersembunyi di tab, temuan utama (10 sekolah jauh, 5 lokasi baru) harus dicari sendiri, istilah teknis (isochrone, Run Global, Param), kartu "SPPG terpadat" semua 100%, teks tab tidak sinkron dengan tampilan (masih menyebut "SPPG merah" dan "halo coklat"), label "data asli/BPS 100%" menyesatkan, dan tampilan ponsel belum diuji.

**Perubahan**
1. Kartu pengantar di sudut peta: judul, pertanyaan yang dijawab, legenda permanen, kalimat temuan otomatis, tombol tur 5 langkah; bisa diciutkan dan otomatis menciut di ponsel.
2. Usulan lokasi baru langsung dihitung dan digambar saat data siap (jumlah paling sedikit yang membuat siswa di luar area 10 menit dan tidak tertampung menjadi nol), tanpa perlu membuka tab Usulan.
3. KPI: "Terjangkau 10 menit", "Kapasitas terpakai", "Di luar 10 menit", "Tidak tertampung", masing-masing dengan penjelasan saat kursor di atas kartu.
4. Kartu "SPPG terpadat" diganti "Sekolah terjauh dari SPPG pelayannya"; kurva kandidat diberi judul dan kalimat penjelas.
5. Istilah: menu Ringkas/Layer/Analisis/Atur/Usulan/Data, tombol "Tampilkan area ...", singkatan SPPG dan isochrone dijelaskan lewat tooltip.
6. Teks yang tidak sinkron diperbaiki; label siswa menjadi "estimasi (BPS kecamatan, dibagi rata)".
7. Ukuran titik sekolah mengikuti jumlah siswa dan zoom, dengan sedikit transparansi.
8. Tata letak ponsel: KPI 2x2, laci selebar layar, dock bisa digeser, tanpa gulir menyamping (diuji pada lebar 390 px).

**Alasan**
Pengunjung portfolio hanya punya beberapa detik; angka yang benar tidak berguna bila cerita utamanya tersembunyi.

**Hasil**
Layar pertama langsung menyatakan temuan: 79% kapasitas terpakai, 0 siswa tidak tertampung, 10 sekolah (2.070 siswa) di luar area 10 menit, dan 5 lokasi baru cukup menutupnya. Console bersih (hanya favicon 404). README dan tangkapan layar diperbarui.

**Pelajaran**
Setiap kali tampilan atau aturan berubah, cari teks lama yang masih menjelaskan versi sebelumnya (di sini "SPPG merah"). Menguji sebagai orang asing menemukan masalah yang tidak terlihat oleh pembuatnya.
