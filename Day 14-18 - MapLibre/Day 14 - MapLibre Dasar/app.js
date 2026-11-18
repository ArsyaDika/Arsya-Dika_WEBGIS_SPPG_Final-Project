// ================= PETA DASAR =================
// Container id harus sama dengan id elemen di index.html
// center: [longitude, latitude], zoom: semakin besar semakin detail
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemap.mapid.io/styles/street-2d-building/style.json?key=69ab999f514f4bbe5e82a74a',
  center: [110.277197, -7.809780],
  zoom: 12
})

// ================= DATA =================
// Data titik (Point)
const dataTitik = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [110.2942039424517, -7.806849695521322] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [110.29552783117475, -7.817597288848418] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [110.28755401349673, -7.829796808355255] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [110.3115434303586, -7.785016456877628] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [110.23099686007379, -7.824184337631763] } }
  ]
}

// Data jalan (LineString). Sama dengan isi berkas Jalan.geojson
const dataJalan = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [110.27714729201045, -7.81129991341038],
          [110.29952470936962, -7.805097358436512],
          [110.29939780530157, -7.812012363153414]
        ]
      }
    }
  ]
}

// ================= LAYER =================
// Layer ditambahkan setelah peta selesai dimuat
map.on('load', () => {
  // Layer titik
  map.addSource('titik', { type: 'geojson', data: dataTitik })
  map.addLayer({
    id: 'titik-layer',
    type: 'circle',
    source: 'titik',
    paint: {
      'circle-radius': 5,
      'circle-color': '#51A7FC',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  })

  // Layer jalan
  map.addSource('jalan', { type: 'geojson', data: dataJalan })
  map.addLayer({
    id: 'jalan-layer',
    type: 'line',
    source: 'jalan',
    paint: {
      'line-width': 3,
      'line-color': '#ff0000',
      'line-dasharray': [2, 4]
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    }
  })
})
