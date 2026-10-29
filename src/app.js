// ================= BASEMAP =================
// Semua basemap gratis dan tanpa API key.
const styles = {
  street: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  sat: {
    version: 8,
    sources: {
      esri: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics'
      }
    },
    layers: [{ id: 'esri', type: 'raster', source: 'esri' }]
  }
};

const JENJANG = {
  sd: { label: 'SD', color: '#3b82f6' },
  smp: { label: 'SMP', color: '#f59e0b' },
  sma: { label: 'SMA', color: '#8b5cf6' }
};

// Dipakai hanya jika data/isochrones.geojson belum dibuat:
// radius garis lurus = menit x kecepatan rata-rata kota.
const APPROX_SPEED_KMH = 20;

const map = new maplibregl.Map({
  container: 'map',
  style: styles.street,
  center: [110.42, -7.02],
  zoom: 11.5
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

const data = { sd: null, smp: null, sma: null, sppg: null, iso: null };
let sekolah = [];
let isoPrecomputed = false;
let selectedSPPG = null;
let result = { iso: empty(), candidate: empty() };
let chart = null;

// ================= LOAD DATA (sekali saja) =================
const ready = loadData();

async function loadData() {
  const get = (f) => fetch(`data/${f}.geojson`).then((r) => (r.ok ? r.json() : null));
  [data.sd, data.smp, data.sma, data.sppg, data.iso] = await Promise.all(
    ['SD', 'SMP', 'SMA', 'SPPG', 'isochrones'].map(get)
  );

  for (const k of Object.keys(JENJANG)) {
    data[k].features.forEach((f) => (f.properties.jenjang = JENJANG[k].label));
  }
  sekolah = [...data.sd.features, ...data.smp.features, ...data.sma.features];
  isoPrecomputed = !!data.iso;

  if (!isoPrecomputed) {
    const note = document.getElementById('iso-note');
    note.hidden = false;
    note.textContent = 'Isochrone jalan belum dibuat. Sementara memakai perkiraan radius garis lurus '
      + `(${APPROX_SPEED_KMH} km/jam), jadi hasilnya lebih kasar.`;
  }
}

// Dipanggil setiap kali style dimuat, termasuk saat ganti basemap.
map.on('style.load', async () => {
  await ready;
  addLayers();
});

// ================= LAYER =================
function empty() {
  return { type: 'FeatureCollection', features: [] };
}

function addLayers() {
  const visible = (id, def) => {
    const box = document.querySelector(`[data-layer="${id}"]`);
    return (box ? box.checked : def) ? 'visible' : 'none';
  };

  map.addSource('sekolah', { type: 'geojson', data: { type: 'FeatureCollection', features: sekolah } });
  map.addLayer({
    id: 'heatmap-layer',
    type: 'heatmap',
    source: 'sekolah',
    layout: { visibility: visible('heatmap-layer', false) },
    paint: { 'heatmap-radius': 22, 'heatmap-intensity': 0.8, 'heatmap-opacity': 0.7 }
  });

  map.addSource('iso', { type: 'geojson', data: result.iso });
  map.addLayer({
    id: 'iso-layer',
    type: 'fill',
    source: 'iso',
    layout: { visibility: visible('iso-layer', true) },
    paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.18, 'fill-outline-color': '#15803d' }
  });

  for (const [k, j] of Object.entries(JENJANG)) {
    map.addSource(k, { type: 'geojson', data: data[k] });
    map.addLayer({
      id: `${k}-layer`,
      type: 'circle',
      source: k,
      layout: { visibility: visible(`${k}-layer`, true) },
      paint: { 'circle-color': j.color, 'circle-radius': 4, 'circle-stroke-color': '#fff', 'circle-stroke-width': 0.8 }
    });
  }

  map.addSource('sppg', { type: 'geojson', data: data.sppg });
  map.addLayer({
    id: 'sppg-layer',
    type: 'circle',
    source: 'sppg',
    layout: { visibility: visible('sppg-layer', true) },
    paint: {
      'circle-color': '#111827',
      'circle-radius': 6,
      'circle-stroke-color': ['case', ['==', ['get', 'No SPPG'], selectedSPPG?.properties['No SPPG'] ?? ''], '#22c55e', '#fff'],
      'circle-stroke-width': 2
    }
  });

  map.addSource('candidate', { type: 'geojson', data: result.candidate });
  map.addLayer({
    id: 'candidate-layer',
    type: 'circle',
    source: 'candidate',
    layout: { visibility: visible('candidate-layer', true) },
    paint: { 'circle-color': '#ef4444', 'circle-radius': 10, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 }
  });
}

// ================= POPUP (didaftarkan sekali) =================
function popup(lngLat, title, lines) {
  const el = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = title;
  el.append(b);
  lines.forEach((l) => el.append(document.createElement('br'), l));
  new maplibregl.Popup().setLngLat(lngLat).setDOMContent(el).addTo(map);
}

for (const k of Object.keys(JENJANG)) {
  map.on('click', `${k}-layer`, (e) => {
    const p = e.features[0].properties;
    popup(e.lngLat, p.NAMA || 'Tanpa nama', [`${p.jenjang} ${p.TIPE_3 || ''}`.trim(), p.KECAMATAN || '']);
  });
}

map.on('click', 'sppg-layer', (e) => {
  const f = e.features[0];
  selectedSPPG = data.sppg.features.find((s) => s.properties['No SPPG'] === f.properties['No SPPG']);
  const p = selectedSPPG.properties;
  popup(e.lngLat, p['Nama SPPG'], [`Kec. ${p['Kecamatan SPPG']}`, `Kel. ${p['Desa/Kelurahan SPPG']}`]);

  document.getElementById('selected').textContent = `Terpilih: ${p['Nama SPPG']}`;
  document.getElementById('run-local').disabled = false;
  map.setPaintProperty('sppg-layer', 'circle-stroke-color',
    ['case', ['==', ['get', 'No SPPG'], p['No SPPG']], '#22c55e', '#fff']);
});

map.on('click', 'candidate-layer', (e) => {
  const p = e.features[0].properties;
  popup(e.lngLat, `Kandidat SPPG baru #${p.rank}`, [
    `${p.sekolah} sekolah belum terjangkau dalam sel 1 km ini`,
    `SD ${p.sd} · SMP ${p.smp} · SMA ${p.sma}`
  ]);
});

for (const id of ['sd-layer', 'smp-layer', 'sma-layer', 'sppg-layer', 'candidate-layer']) {
  map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
}

// ================= ISOCHRONE =================
function isochrones(sppgList, menit) {
  if (isoPrecomputed) {
    const ids = new Set(sppgList.map((s) => s.properties['No SPPG']));
    return data.iso.features.filter((f) => f.properties.menit === menit && ids.has(f.properties.sppg_id));
  }
  const km = (APPROX_SPEED_KMH * menit) / 60;
  return sppgList.map((s) => turf.circle(s.geometry.coordinates.slice(0, 2), km, { units: 'kilometers', steps: 48 }));
}

// ================= ANALYSIS =================
function analyze(polygons) {
  const count = { SD: [0, 0], SMP: [0, 0], SMA: [0, 0] }; // [terjangkau, belum]
  const gap = [];

  for (const s of sekolah) {
    const pt = s.geometry.coordinates.slice(0, 2);
    const served = polygons.some((poly) => turf.booleanPointInPolygon(pt, poly));
    count[s.properties.jenjang][served ? 0 : 1]++;
    if (!served) gap.push(s);
  }

  const served = Object.values(count).reduce((a, c) => a + c[0], 0);
  document.getElementById('served').textContent = served;
  document.getElementById('unserved').textContent = sekolah.length - served;
  document.getElementById('pct').textContent = `${Math.round((served / sekolah.length) * 100)}%`;
  drawChart(count);
  return gap;
}

// Kandidat: sel grid 1 km di seluruh kota dengan sekolah belum terjangkau terbanyak.
function candidates(gap, top = 5) {
  const grid = turf.squareGrid(turf.bbox({ type: 'FeatureCollection', features: sekolah }), 1, { units: 'kilometers' });

  const cells = grid.features.map((cell) => {
    const inside = gap.filter((s) => turf.booleanPointInPolygon(s.geometry.coordinates.slice(0, 2), cell));
    const by = (j) => inside.filter((s) => s.properties.jenjang === j).length;
    return { cell, sekolah: inside.length, sd: by('SD'), smp: by('SMP'), sma: by('SMA') };
  });

  return cells
    .filter((c) => c.sekolah > 0)
    .sort((a, b) => b.sekolah - a.sekolah)
    .slice(0, top)
    .map((c, i) => {
      // Titik kandidat di rata-rata posisi sekolah yang belum terjangkau, bukan sekadar pusat sel.
      const pts = gap.filter((s) => turf.booleanPointInPolygon(s.geometry.coordinates.slice(0, 2), c.cell));
      const center = turf.center({ type: 'FeatureCollection', features: pts });
      center.properties = { rank: i + 1, sekolah: c.sekolah, sd: c.sd, smp: c.smp, sma: c.sma };
      return center;
    });
}

function show(polygons, cand) {
  result.iso = { type: 'FeatureCollection', features: polygons };
  result.candidate = { type: 'FeatureCollection', features: cand };
  // Saat basemap sedang berganti, source belum ada; addLayers() akan memakai `result`.
  map.getSource('iso')?.setData(result.iso);
  map.getSource('candidate')?.setData(result.candidate);
  if (polygons.length) map.fitBounds(turf.bbox(result.iso), { padding: 40, maxZoom: 14 });
}

// ================= CHART =================
function drawChart(count) {
  const labels = Object.keys(count);
  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Terjangkau', data: labels.map((l) => count[l][0]), backgroundColor: '#22c55e' },
        { label: 'Belum', data: labels.map((l) => count[l][1]), backgroundColor: '#ef4444' }
      ]
    },
    options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } }
  };
  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('chartSekolah'), cfg);
}

// ================= EVENT =================
const menit = () => Number(document.getElementById('waktu').value);

document.getElementById('run-local').onclick = async () => {
  await ready;
  if (!selectedSPPG) return;
  const polys = isochrones([selectedSPPG], menit());
  analyze(polys);
  show(polys, []);
};

document.getElementById('run-global').onclick = async () => {
  await ready;
  const polys = isochrones(data.sppg.features, menit());
  const gap = analyze(polys);
  show(polys, candidates(gap));
};

document.querySelectorAll('[data-layer]').forEach((box) => {
  box.onchange = () => {
    if (map.getLayer(box.dataset.layer)) {
      map.setLayoutProperty(box.dataset.layer, 'visibility', box.checked ? 'visible' : 'none');
    }
  };
});

document.querySelectorAll('[data-style]').forEach((btn) => {
  btn.onclick = () => {
    document.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('active', b === btn));
    map.setStyle(styles[btn.dataset.style], { diff: false });
  };
});
