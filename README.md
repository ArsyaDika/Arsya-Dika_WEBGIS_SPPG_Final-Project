# WebGIS Keterjangkauan SPPG Kota Semarang

Peta interaktif untuk menjawab satu pertanyaan: **sekolah mana di Kota Semarang yang belum terjangkau oleh Satuan Pelayanan Pemenuhan Gizi (SPPG) dalam waktu tempuh berkendara tertentu, dan di mana SPPG baru sebaiknya dibangun?**

Proyek akhir bootcamp WebGIS Developer, kemudian disempurnakan.

## Fitur

- Peta 553 SD, 200 SMP, 70 SMA, dan 128 SPPG di Kota Semarang.
- Area jangkauan (isochrone) 5, 10, atau 15 menit berkendara, untuk satu SPPG atau seluruh kota.
- Ringkasan cakupan: jumlah sekolah terjangkau, belum terjangkau, dan persentasenya per jenjang.
- Rekomendasi 5 lokasi kandidat SPPG baru.
- Heatmap kepadatan sekolah dan tiga pilihan basemap (street, dark, satelit).

## Metode

1. **Isochrone** dihitung dengan [OpenRouteService](https://openrouteservice.org) (profil `driving-car`, data OpenStreetMap) oleh `scripts/build_isochrones.py` dan disimpan sebagai `data/isochrones.geojson`. Peta hanya membaca file ini, jadi tidak ada API key di browser.
2. **Cakupan:** sebuah sekolah dianggap terjangkau jika titiknya berada di dalam isochrone salah satu SPPG (`turf.booleanPointInPolygon`).
3. **Kandidat lokasi:** seluruh kota dibagi menjadi grid 1 km. Sel diurutkan berdasarkan jumlah sekolah yang belum terjangkau, lalu 5 sel teratas dipilih. Titik kandidat diletakkan di pusat sekolah-sekolah tersebut.

### Keterbatasan

- Data tidak memuat jumlah siswa, sehingga analisis menghitung **jumlah sekolah**, bukan jumlah siswa.
- Jika `data/isochrones.geojson` belum dibuat, peta memakai **perkiraan radius garis lurus** (20 km/jam). Peta menampilkan peringatan saat mode ini aktif.
- Waktu tempuh tidak memperhitungkan kemacetan.

## Teknologi

MapLibre GL JS · Turf.js · Chart.js · OpenRouteService · Python · GitHub Actions

Basemap tanpa API key: [OpenFreeMap](https://openfreemap.org) (street), CARTO Dark Matter (dark), Esri World Imagery (satelit).

## Struktur

```
index.html                      Halaman peta
src/app.js                      Logika peta dan analisis
src/style.css                   Tampilan
data/*.geojson                  Data sekolah, SPPG, dan isochrone
scripts/build_isochrones.py     Pembuat isochrone dari OpenRouteService
.github/workflows/isochrones.yml  Menjalankan script di atas secara otomatis
```

## Menjalankan

Buka lewat web server lokal, karena browser memblokir `fetch` dari `file://`:

```bash
python -m http.server 8000
# buka http://localhost:8000
```

### Membuat ulang isochrone

1. Daftar API key gratis di [openrouteservice.org](https://openrouteservice.org/dev/#/signup).
2. Simpan key sebagai secret repo bernama `ORS_API_KEY` (Settings → Secrets and variables → Actions).
3. Jalankan workflow **Build isochrones** dari tab Actions. Hasilnya otomatis di-commit.

Atau secara lokal: `ORS_API_KEY=... python scripts/build_isochrones.py`.

## Data

Titik sekolah (SD/MI, SMP/MTs, SMA/MA) dan SPPG Kota Semarang dari materi bootcamp WebGIS. Basemap © OpenStreetMap contributors.

## Penulis

**Arsya Dika** · [GitHub](https://github.com/ArsyaDika)
