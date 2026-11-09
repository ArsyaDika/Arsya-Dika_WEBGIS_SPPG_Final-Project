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
