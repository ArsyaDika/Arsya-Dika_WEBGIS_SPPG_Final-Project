// App.js basemap dasar dari API MAPID
const basemapStreet = 'https://basemap.mapid.io/styles/street-2d-building/style.json?key=69a8edeffdb1d3dbc8b3022c';
const basemapDark = 'https://basemap.mapid.io/styles/dark/style.json?key=69a8edeffdb1d3dbc8b3022c';
const basemapSatellite = 'https://basemap.mapid.io/styles/satellite/style.json?key=69a8edeffdb1d3dbc8b3022c';

// Container id harus sama dengan yang ada di index.html
// style dari API yang ada di const diatas
// center adalah koordinat yang diinginkan untuk ditampilkan, formatnya [longitude, latitude]
// zoom adalah tingkat zoom yang diinginkan, semakin besar semakin detail
const map = new maplibregl.Map({
    container:'map',
    style: basemapStreet,
    center: [110.407609, -6.982276],
    zoom: 12
})
// Menambahkan url rumah sakit di kota semarang dari API MApID
const url_rs= 'https://geoserver.mapid.io/layers_new/get_layer?api_key=fb6e2780711141a0a171dd398b5be6f8&layer_id=697b23c047aaef41cdd4df6b&project_id=69776f93e21f36c17f9c7004'
// Menambahkan url polygon batas adminsitrasi bandung dari API MAPID
const url_administrasi = 'https://geoserver.mapid.io/layers_new/get_layer?api_key=fb6e2780711141a0a171dd398b5be6f8&layer_id=69ad12cd02854d1dfe4d287f&project_id=69776f93e21f36c17f9c7004'
const url_jalan = 'https://overpass.kumi.systems/api/interpreter?data=[out:json][timeout:25];area[name="Semarang"]["boundary"="administrative"]->.a;(way["highway"~"primary|secondary|tertiary"](area.a););out geom;'

// style.load dipicu saat pertama kali dan setiap setStyle(), sehingga layer tidak hilang saat basemap diganti
map.on('style.load', () =>{
    async function loadData(){
        // Mengambil data rumah sakit dari API menggunakan fetch
        const rsResponse = await fetch(url_rs);
        // Mengubah response menjadi format JSON
        const rsData = await rsResponse.json();

        //Menampilkan data rumah sakit di console untuk memastikan data sudah berhasil diambil
        console.log(rsResponse);
        console.log(rsData);
        
        // Menambahkan data rumah sakit ke peta
        map.addSource('rumah-sakit', {
            type: 'geojson',
            data: rsData
        });

         // Menambahkan layer untuk menampilkan rumah sakit
        map.addLayer({
            id: 'rumah-sakit-layer',
            source: 'rumah-sakit',
            type: 'circle',
            paint : {
                'circle-radius': 6,
                'circle-color': '#22ff7e',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#FFFFFF'
            }
        })

        // DATA ADMINISTRASI
        // Mengambil data administrasi dari API
        const administrasiResponse = await fetch(url_administrasi);
        // Mengonversi respons menjadi format JSON
        const administrasiData = await administrasiResponse.json();

        // Menambahkan data administrasi ke peta
        map.addSource('administrasi', {
            type: 'geojson',
            data: administrasiData
        });

        // Menambahkan layer untuk menampilkan administrasi
        map.addLayer({
            id: 'administrasi-layer',
            source: 'administrasi',
            type: 'fill',
            paint:{
                'fill-color': '#732d81',
                'fill-opacity': 0.5
            }
        }, 'rumah-sakit-layer') // Menambahkan layer administrasi di bawah layer rumah sakit

        // DATA Jalan
        // Source dan layer dibuat lebih dulu dengan data kosong, supaya tombol toggle tetap berfungsi
        // walaupun server Overpass lambat. Data diisi setelah Overpass menjawab.
        map.addSource('jalan', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Menambahkan layer untuk menampilkan jalan
        map.addLayer({
            id: 'jalan-layer',
            source: 'jalan',
            type: 'line',
            paint:{
                'line-color': '#732d81',
                'line-width': 2
            }
        }, 'rumah-sakit-layer') // Menambahkan layer jalan di bawah layer rumah sakit

        // Mengambil data jalan dari Overpass API.
        // Overpass membalas format JSON OSM (elements), bukan GeoJSON, jadi diubah dulu menjadi LineString.
        try {
            const jalanResponse = await fetch(url_jalan);
            const osm = await jalanResponse.json();
            const jalanData = {
                type: 'FeatureCollection',
                features: (osm.elements || [])
                    .filter(e => e.type === 'way' && e.geometry)
                    .map(e => ({
                        type: 'Feature',
                        properties: e.tags || {},
                        geometry: { type: 'LineString', coordinates: e.geometry.map(p => [p.lon, p.lat]) }
                    }))
            };
            // Source bisa sudah hilang bila basemap diganti saat menunggu; pastikan masih ada
            if (map.getSource('jalan')) map.getSource('jalan').setData(jalanData);
        } catch (err) {
            console.warn('Data jalan tidak tersedia:', err);
        }
    }
    loadData();
})

// Menambahkan event listener untuk menangani klik pada layer rumah sakit
map.on('click', 'rumah-sakit-layer', (event)=>{

    // Mendapatkan koordinat klik dan properti fitur yang diklik
    const coordinates = event.lngLat;
    const features = event.features[0].properties;

    // Menampilkan informasi fitur yang diklik di konsol untuk verifikasi
    console.log('FEATURES', features);
    console.log('COORDINATES', coordinates);
    console.log('HASIL EVEN CLICK', event);

    // Membuat konten HTML untuk popup berdasarkan properti fitur
    const html = `
        <div>
            <h1> Informasi Rumah Sakit </h1>
            <p> Nama Rumah Sakit : ${features.NAMA}</p>
            <p> Desa : ${features.DESA}</p>
            <p> Kecamatan : ${features.KECAMATAN}</p>
            <p> Alamat : ${features.ALAMAT}</p>
        </div>
    `

    new maplibregl.Popup() // Membuat popup baru
    .setHTML(html) // Mengatur konten HTML untuk popup
    .setLngLat(coordinates) // Mengatur posisi popup berdasarkan koordinat klik
    .addTo(map); // Menambahkan popup ke peta
});

// Fungsi untuk mengubah gaya peta ke gaya satelit
window.updateStyleToSatellite = ()=>{
    map.setStyle(basemapSatellite, { diff: false })
}
// Fungsi untuk mengubah gaya peta ke gaya dark
window.updateStyleToDark = ()=>{
    map.setStyle(basemapDark, { diff: false })
}
// Fungsi untuk mengubah gaya peta ke gaya street
window.updateStyleToStreet = ()=>{
    map.setStyle(basemapStreet, { diff: false })
}

// Fungsi toggle layer rumah sakit
window.toggleLayerRumahSakit = () =>{
    const visibility = map.getLayoutProperty('rumah-sakit-layer', 'visibility')
   
    // ketika diklik keadaannya mati, maka layer dibuat nyala, begitu juga sebaliknya
    const nextState = visibility !== 'none' ? 'none' : 'visible'; // Menentukan status berikutnya berdasarkan status saat ini

    console.log('visibility', visibility);
    console.log('nextState', nextState);
    map.setLayoutProperty('rumah-sakit-layer', 'visibility', nextState); // Mengubah properti layout untuk layer rumah sakit sesuai dengan status berikutnya
}

// Fungsi toggle layer Administrasi
window.toggleLayerAdministrasi = () =>{
    const visibility = map.getLayoutProperty('administrasi-layer', 'visibility')
   
    // ketika diklik keadaannya mati, maka layer dibuat nyala, begitu juga sebaliknya
    const nextState = visibility !== 'none' ? 'none' : 'visible'; // Menentukan status berikutnya berdasarkan status saat ini

    console.log('visibility', visibility);
    console.log('nextState', nextState);
    map.setLayoutProperty('administrasi-layer', 'visibility', nextState); // Mengubah properti layout untuk layer administrasi sesuai dengan status berikutnya
}

// Fungsi toggle layer Jalan
window.toggleLayerJalan = () =>{
    const visibility = map.getLayoutProperty('jalan-layer', 'visibility')
   
    // ketika diklik keadaannya mati, maka layer dibuat nyala, begitu juga sebaliknya
    const nextState = visibility !== 'none' ? 'none' : 'visible'; // Menentukan status berikutnya berdasarkan status saat ini

    console.log('visibility', visibility);
    console.log('nextState', nextState);
    map.setLayoutProperty('jalan-layer', 'visibility', nextState); // Mengubah properti layout untuk layer jalan sesuai dengan status berikutnya
}