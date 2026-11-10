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
