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
