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
