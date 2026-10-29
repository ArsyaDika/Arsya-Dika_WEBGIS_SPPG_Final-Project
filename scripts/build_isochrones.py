"""Hitung isochrone berkendara untuk setiap SPPG lewat OpenRouteService.

Hasilnya disimpan sebagai data/isochrones.geojson sehingga peta tidak perlu
memanggil API (dan tidak perlu API key) di browser.

Pemakaian:
    ORS_API_KEY=xxxx python scripts/build_isochrones.py

Kuota paket gratis ORS: 500 permintaan isochrone/hari, 20/menit.
Satu permintaan memuat maksimal 5 titik, jadi 128 SPPG = 26 permintaan.
"""

import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "SPPG.geojson"
OUT = ROOT / "data" / "isochrones.geojson"

URL = "https://api.openrouteservice.org/v2/isochrones/driving-car"
RANGES = [300, 600, 900]  # detik: 5, 10, 15 menit
BATCH = 5
PAUSE = 3.5  # detik antar permintaan, aman di bawah 20/menit


def request(key, coords):
    body = json.dumps({"locations": coords, "range": RANGES, "range_type": "time"}).encode()
    req = urllib.request.Request(
        URL,
        data=body,
        headers={"Authorization": key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def main():
    key = os.environ.get("ORS_API_KEY")
    if not key:
        sys.exit("ORS_API_KEY belum di-set")

    sppg = json.loads(SRC.read_text(encoding="utf-8"))["features"]
    features = []

    for i in range(0, len(sppg), BATCH):
        batch = sppg[i : i + BATCH]
        coords = [f["geometry"]["coordinates"][:2] for f in batch]
        result = request(key, coords)

        for iso in result["features"]:
            src = batch[iso["properties"]["group_index"]]["properties"]
            iso["properties"] = {
                "sppg_id": src["No SPPG"],
                "nama": src["Nama SPPG"],
                "menit": int(iso["properties"]["value"] // 60),
            }
            features.append(iso)

        print(f"{min(i + BATCH, len(sppg))}/{len(sppg)} SPPG selesai")
        time.sleep(PAUSE)

    OUT.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Tersimpan: {OUT.relative_to(ROOT)} ({len(features)} poligon)")


if __name__ == "__main__":
    main()
