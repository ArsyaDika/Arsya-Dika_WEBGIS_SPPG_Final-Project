// app.js
const basemapStreet = 'https://basemap.mapid.io/styles/street-2d-building/style.json?key=69a8edeffdb1d3dbc8b3022c';
const basemapDark = 'https://basemap.mapid.io/styles/dark/style.json?key=69a8edeffdb1d3dbc8b3022c';
const basemapSatellite = 'https://basemap.mapid.io/styles/satellite/style.json?key=69a8edeffdb1d3dbc8b3022c';








// Inisialisasi peta dengan gaya street dan koordinat awal di Bandung
const map = new maplibregl.Map({
    container:'map', // ID elemen HTML tempat peta akan ditampilkan
    style: basemapStreet, // Gaya peta yang digunakan
    center: [107.605743, -6.916823], // Koordinat pusat peta (longitude, latitude)
    zoom: 12 // Tingkat zoom awal peta
})








// URL basemap API data
const url_apartemen = 'https://geoserver.mapid.io/layers_new/get_layer?api_key=7b8019aa264248e89e3fd5b27253132f&layer_id=69ace1b8643f7636a769ce7c&project_id=69ab9fb96c69e6252868efaf'
const url_administrasi = 'https://geoserver.mapid.io/layers_new/get_layer?api_key=7b8019aa264248e89e3fd5b27253132f&layer_id=69ace7646c69e62528aa09c5&project_id=69ab9fb96c69e6252868efaf'
// Sumber drainase: Geoportal Kota Yogyakarta (GeoNode/GeoServer, WFS terbuka dan CORS diizinkan)
// Datanya terbagi 3 layer per sungai (Code, Gajahwong, Winongo), lalu digabung jadi satu FeatureCollection
const url_wfs_yogyakarta = 'https://geoportal.jogjakota.go.id/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=json&srsName=EPSG%3A4326&typename=geonode%3A'
const layer_drainase = [
    { layer: 'drainase_code_kota_yogyakarta', sungai: 'Code' },
    { layer: 'drainase_gajahwong_kota_yogyakarta', sungai: 'Gajahwong' },
    { layer: 'drainase_winongo_kota_yogyakarta', sungai: 'Winongo' }
]

// Mengambil ketiga layer, menyeragamkan atribut (nama kolom tiap layer berbeda), lalu menggabungkannya.
// Jika satu layer gagal dimuat, layer lain tetap dipakai
async function ambilDrainase(){
    const hasil = await Promise.all(layer_drainase.map(({ layer, sungai }) =>
        fetch(url_wfs_yogyakarta + layer).then(r => r.json()).then(data => data.features.map(f => ({
            ...f,
            properties: {
                NAMA_JALAN: f.properties.nama || f.properties.nama_jalan || f.properties.lokasi || '-',
                JENIS: f.properties.tbk_ttp || f.properties.tipe || '-',
                SUNGAI: sungai
            }
        }))).catch(err => {
            console.warn('Layer drainase ' + sungai + ' tidak tersedia:', err);
            return [];
        })
    ));
    return { type: 'FeatureCollection', features: hasil.flat() };
}


let hasilApartemenData;


async function loadData(){
    // Mengambil data apartemen dari API
    const apartemenResponse = await fetch(url_apartemen);
    // Mengonversi respons menjadi format JSON
    const apartemenData = await apartemenResponse.json();


    // Menyimpan data apartemen ke variabel global
    hasilApartemenData = apartemenData;




    // Menampilkan data apartemen di konsol untuk verifikasi
    console.log(apartemenResponse);
    console.log(apartemenData);








    // Menambahkan data apartemen ke peta
    map.addSource('apartemen', {
        type: 'geojson',
        data: apartemenData,
    });




    // Menambahkan source untuk cluster apartemen
    map.addSource('apartemen-cluster', {
        type: 'geojson',
        data: apartemenData,
        cluster: true, // Aktifkan clustering
        clusterMaxZoom: 14, // Tingkat zoom maksimum untuk clustering
        clusterRadius: 100 // Radius cluster dalam piksel
    });












    // Menambahkan layer untuk menampilkan apartemen
    map.addLayer({
        id: 'apartemen-layer',
        source: 'apartemen',
        type: 'circle',
        paint:{
            'circle-color': '#F227F5',
            'circle-radius': 5,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#000000'
        },
        layout:{
            'visibility': 'none'
        }
    })




    //MENAMAKAN LAYER APARTEMEN DALAM BENTUK HEATMAP
    // map.addLayer({
    //     id: 'apartemen-heatmap',
    //     source: 'apartemen',
    //     type: 'heatmap', // Mengubah tipe layer menjadi heatmap
    //     maxzoom: 14, // Menentukan tingkat zoom maksimum untuk menampilkan heatmap
    // })




    //MENAMPILKAN LAYER APARTEMEN DALAM BENTUK CLUSTER
    map.addLayer({
        id: 'apartemen-cluster-layer',
        type: 'circle',
        source: 'apartemen-cluster',
        filter: ['has', 'point_count'], // Hanya menampilkan fitur yang merupakan cluster
        paint:{
            'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51d698ff', // Warna jika di bawah 10 titik
                    5,
                    '#f2f244ff', // Warna jika antara 10 - 20 titik
                    10,
                    '#f35415ff'  // Warna jika di atas 20 titik
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    15,  // Radius default
                    7, 30, // Jika titik > 10, radius jadi 30
                    10, 40  // Jika titik > 20, radius jadi 40
                ],
        }
    })




    // menampilkan label jumlah apartemen dalam cluster
    map.addLayer({
        id: 'apartemen-cluster-count',
        type: 'symbol',
        source: 'apartemen-cluster',
        filter: ['has', 'point_count'], // Hanya menampilkan fitur yang merupakan cluster
        layout:{
            'text-field': '{point_count_abbreviated}', // Menampilkan jumlah fitur dalam cluster
            'text-size': 12, // Ukuran teks untuk jumlah fitur dalam cluster
        }
    })




    map.addLayer({
        id: 'unclustered-apartemen-layer',
        type: 'circle',
        source: 'apartemen-cluster',
        filter: ['!', ['has', 'point_count']], // Hanya menampilkan fitur yang bukan merupakan cluster
        paint:{
            'circle-color': '#2779f5',
            'circle-radius': 5,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#000000'
        }
    })








    // DATA ADMINISTRASI
    // Mengambil data apartemen dari API
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
            'fill-color': '#27B4F5',
            'fill-opacity': 0.5
        },
                    layout:{
            'visibility': 'visible'
        }
    }, 'apartemen-layer') // Menambahkan layer administrasi di bawah layer apartemen








    // DATA DRAINASE
    // Mengambil data apartemen dari API
    // Data drainase diambil dari Geoportal Kota Yogyakarta (3 layer digabung, lihat ambilDrainase di atas)
    const drainaseData = await ambilDrainase();








    // Menambahkan data administrasi ke peta
    map.addSource('drainase', {
        type: 'geojson',
        data: drainaseData
    });








    // Menambahkan layer untuk menampilkan drainase
    map.addLayer({
        id: 'drainase-layer',
        source: 'drainase',
        type: 'line',
        paint:{
            'line-color': '#2749F5',
            'line-width': 2
        },
        layout:{
            'visibility': 'visible'
        }
    }, 'apartemen-layer') // Menambahkan layer administrasi di bawah layer apartemen




    // SESI 4
    //TURF JS
    // menghitung luas kota bandung dengan geojson administrasiData
    const luas_kota_bandung = turf.area(administrasiData);
    console.log('Luas Kota Bandung', luas_kota_bandung);


    // mengubah satuan luas kota bandung dari meter persegi ke kilometer persegi
    const luas_kota_bandung_km = turf.convertArea(luas_kota_bandung, 'meters', 'kilometers'); // meters = satuan luas awal, kilometers = satuan luas akhir
    console.log('Luas Kota Bandung KM2', luas_kota_bandung_km);


    // Mencari titik centroid kota bandung
    const centroid_kota_bandung = turf.centroid(administrasiData);


    console.log('CENTROID KOTA BANDUNG', centroid_kota_bandung);




    // Menambahkan layer centroid kota bandung
    map.addSource('centroid-kota-bandung',{
        type: 'geojson',
        data: centroid_kota_bandung
    })


    // menampilkan titik centroid kota bandung
    map.addLayer({
        id: 'centroid-kota-bandung-layer',
        source:'centroid-kota-bandung',
        type: 'circle',
        paint: {
            'circle-color': '#ffffff',
            'circle-radius': 5,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#000000'
        }
    })




    // menghitung panjang data drainase
    const panjang_drainase = turf.length(drainaseData);
    console.log('Panjang Drainase', panjang_drainase);


    // melakukan simplify untuk data administrasi
    const administrasi_simplified = turf.simplify(administrasiData, {tolerance: 0.001}); // tolerance = 0.01


    // // Menambahkan layer administrasi simplified
    // map.addSource('administrasi-simplified',{
    //     type: 'geojson',
    //     data: administrasi_simplified
    // })


    // // menampilkan  administrasi simplified
    // map.addLayer({
    //     id: 'administrasi-simplified-layer',
    //     source:'administrasi-simplified',
    //     type: 'fill',
    //     paint: {
    //         'fill-color': '#f52727ff',
    //         'fill-opacity': 0.5
    //     }
    // })


    // melakukan buffer untuk data apartemen
    const buffer_apartemen = turf.buffer(apartemenData, 500, {units: 'meters'});


    // Menambahkan source buffer apartemen
    map.addSource('buffer-apartemen',{
        type: 'geojson',
        data: buffer_apartemen
    })


    // menampilkan  buffer apartemen
    map.addLayer({
        id: 'buffer-apartemen-layer',
        source:'buffer-apartemen',
        type: 'fill',
        paint: {
            'fill-color': '#f52727ff',
            'fill-opacity': 0.5
        }
    })




    // // MENAMPILKAN ISOCHRONE DARI GEOMAPID
    // const baseurl = 'https://routing.mapid.io/isochrone';
    // const apiKey = '68da7e7d06823ed3f510cc48';
    // const point = '-6.920944367032465,107.60962174356382'; // titik koordinat
    // const time = '300'; // detik
    // const profile = 'motorcycle'; // foot, motorcycle
    // const url = `${baseurl}?key=${apiKey}&time_limit=${time}&point=${point}&profile=${profile}`;
    // console.log(url);


    // //hit api dengan fetch
    // const isochroneResponse = await fetch(url);
    // const isochroneData = await isochroneResponse.json();


    // console.log('HASIL ISOCHRONE', isochroneData);


    // // Mengambil data isochrone dari response API
    // const isochoneGeojson = isochroneData.polygons[0];


   
    // // Menambahkan source isochrone
    // map.addSource('isochrone',{
    //     type: 'geojson',
    //     data: isochoneGeojson
    // })


    // // menampilkan  isochrone
    // map.addLayer({
    //     id: 'isochrone-layer',
    //     source:'isochrone',
    //     type: 'fill',
    //     paint: {
    //         'fill-color': '#e7f527ff',
    //         'fill-opacity': 0.5
    //     }
    // })


}


// style.load dipicu saat pertama kali dan setiap setStyle(), jadi data dimuat ulang setelah style baru siap
map.on('style.load', () =>{
    loadData();
})








// Menambahkan event listener untuk menangani klik pada layer apartemen
map.on('click', 'apartemen-layer', (event)=>{








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
            <h1> Informasi Apartemen </h1>
            <p> Nama Apartemen : ${features.NAMA}</p>
            <p> Alamat : ${features.ALAMAT}</p>
        </div>
    `








    new maplibregl.Popup() // Membuat popup baru
    .setHTML(html) // Mengatur konten HTML untuk popup
    .setLngLat(coordinates) // Mengatur posisi popup berdasarkan koordinat klik
    .addTo(map); // Menambahkan popup ke peta
});








// Menambahkan event listener untuk menangani klik pada layer administrasi
map.on('click', 'administrasi-layer', (event)=>{








    // Mendapatkan koordinat klik dan properti fitur yang diklik
    const coordinates = event.lngLat;
    const features = event.features[0].properties;








    // Menampilkan informasi fitur yang diklik di konsol untuk verifikasi
    console.log('FEATURES', features);
















    // Membuat konten HTML untuk popup berdasarkan properti fitur
    const html = `
        <div>
            <h1> Informasi Administrasi </h1>
            <p> Kabupaten/Kota : ${features['KABUPATEN/KOTA']}</p>
            <p> Provinsi : ${features.PROVINSI}</p>
        </div>
    `








    new maplibregl.Popup() // Membuat popup baru
    .setHTML(html) // Mengatur konten HTML untuk popup
    .setLngLat(coordinates) // Mengatur posisi popup berdasarkan koordinat klik
    .addTo(map); // Menambahkan popup ke peta
});








// Menambahkan event listener untuk menangani klik pada layer drainase
map.on('click', 'drainase-layer', (event)=>{








    // Mendapatkan koordinat klik dan properti fitur yang diklik
    const coordinates = event.lngLat;
    const features = event.features[0].properties;








    // Menampilkan informasi fitur yang diklik di konsol untuk verifikasi
    console.log('FEATURES', features);
















    // Membuat konten HTML untuk popup berdasarkan properti fitur
    const html = `
        <div>
            <h1> Informasi Drainase </h1>
            <p> Nama Drainase : ${features['NAMA_JALAN']}</p>
            <p> Jenis Drainase : ${features['JENIS']}</p>
            <p> Sungai : ${features['SUNGAI']}</p>
        </div>
    `








    new maplibregl.Popup() // Membuat popup baru
    .setHTML(html) // Mengatur konten HTML untuk popup
    .setLngLat(coordinates) // Mengatur posisi popup berdasarkan koordinat klik
    .addTo(map); // Menambahkan popup ke peta
});








// Fungsi untuk mengubah gaya peta ke gaya satelit
window.updateStyleToSatellite = ()=>{
    map.setStyle(basemapSatellite, { diff: false });
}
// Fungsi untuk mengubah gaya peta ke gaya dark
window.updateStyleToDark = ()=>{
    map.setStyle(basemapDark, { diff: false })








}
// Fungsi untuk mengubah gaya peta ke gaya street
window.updateStyleToStreet = ()=>{
    map.setStyle(basemapStreet, { diff: false })








}




// Fungsi toggle layer apartemen
window.toggleLayerApartemen = () =>{
    const visibility = map.getLayoutProperty('apartemen-layer', 'visibility')
   
    // ketika diklik keadaannya mati, maka layer dibuat nyala, begitu juga sebaliknya
    const nextState = visibility !== 'none' ? 'none' : 'visible'; // Menentukan status berikutnya berdasarkan status saat ini








    console.log('visibility', visibility);
    console.log('nextState', nextState);
    map.setLayoutProperty('apartemen-layer', 'visibility', nextState); // Mengubah properti layout untuk layer apartemen sesuai dengan status berikutnya
}








// Fungsi toggle layer administrasi
window.toggleLayerAdministrasi = () =>{
    const visibility = map.getLayoutProperty('administrasi-layer', 'visibility')
   
    // ketika diklik keadaannya mati, maka layer dibuat nyala, begitu juga sebaliknya
    const nextState = visibility !== 'none' ? 'none' : 'visible'; // Menentukan status berikutnya berdasarkan status saat ini








    console.log('visibility', visibility);
    console.log('nextState', nextState);
    map.setLayoutProperty('administrasi-layer', 'visibility', nextState); // Mengubah properti layout untuk layer administrasi sesuai dengan status berikutnya
}








// Fungsi toggle layer drainase
window.toggleLayerDrainase = () =>{
    const visibility = map.getLayoutProperty('drainase-layer', 'visibility')
   
    // ketika diklik keadaannya mati, maka layer dibuat nyala, begitu juga sebaliknya
    const nextState = visibility !== 'none' ? 'none' : 'visible'; // Menentukan status berikutnya berdasarkan status saat ini








    console.log('visibility', visibility);
    console.log('nextState', nextState);
    map.setLayoutProperty('drainase-layer', 'visibility', nextState); // Mengubah properti layout untuk layer drainase sesuai dengan status berikutnya
}




// Fungsi untuk mengubah warna layer apartemen
window.setPaintApartemen = (value)=> { // Mengubah properti paint untuk layer apartemen dengan warna yang dipilih
    map.setPaintProperty('apartemen-layer', 'circle-color', value);
}




// Fungsi untuk mengubah warna layer administrasi
window.setPaintAdministrasi = (value)=> { // Mengubah properti paint untuk layer administrasi dengan warna yang dipilih
    map.setPaintProperty('administrasi-layer', 'fill-color', value);
}




// Fungsi untuk mengubah warna layer drainase
window.setPaintDrainase = (value)=> { // Mengubah properti paint untuk layer apartemen dengan warna yang dipilih
    map.setPaintProperty('drainase-layer', 'line-color', value);
}




// Fungsi untuk mengubah opacity layer apartemen
window.setPaintOpacityApartemen = (value)=>{
    map.setPaintProperty('apartemen-layer', 'circle-opacity', value);
}




// Fungsi untuk mengubah opacity layer administrasi
window.setPaintOpacityAdministrasi = (value)=>{
    map.setPaintProperty('administrasi-layer', 'fill-opacity', value);
}




// Fungsi untuk filter data apartemen berdasarkan kecamatan
window.filterApartemenKecamatan = (value)=>{
        if (value === 'all') map.setFilter('apartemen-layer', null);
        else map.setFilter('apartemen-layer', [
            '==',
            ['get', 'KECAMATAN'], // Mengambil nilai properti 'KECAMATAN' dari properti apartemen
            value // Nilai kecamatan yang dipilih untuk filter
        ],
    )
}




const buttonRun = document.getElementById('button-run');


buttonRun.addEventListener('click', ()=> execute());


// fungsi event listener untuk button run
async function execute(){
    const transportasi = document.getElementById('transportasi').value;
    const waktu = document.getElementById('waktu').value;


    // MENAMPILKAN ISOCHRONE DARI GEOMAPID
    const baseurl = 'https://routing.mapid.io/isochrone';
    const apiKey = '68da7e7d06823ed3f510cc48';
    const point = '-6.920944367032465,107.60962174356382'; // titik koordinat
    const time = waktu;
    const profile = transportasi
    const url = `${baseurl}?key=${apiKey}&time_limit=${time}&point=${point}&profile=${profile}`;
    console.log(url);


    //hit api dengan fetch
    const isochroneResponse = await fetch(url);
    const isochroneData = await isochroneResponse.json();


    console.log('HASIL ISOCHRONE', isochroneData);


    // Mengambil data isochrone dari response API
    const isochoneGeojson = isochroneData.polygons[0];




    // cek apakah layer isochrone sudah ada, karena maplibre tidak memungkinkan untuk menambahkan layer & sourceyang sama
    if(map.getSource('isochrone')){
        // sebelum hapus source, hapus layer terlebih dahulu baru source nya
        map.removeLayer('isochrone-layer'); // Menghapus layer isochrone
        map.removeSource('isochrone'); // Menghapus source isochrone
    }


    // Menambahkan source isochrone
    map.addSource('isochrone',{
        type: 'geojson',
        data: isochoneGeojson
    })


    // menampilkan  isochrone
    map.addLayer({
        id: 'isochrone-layer',
        source:'isochrone',
        type: 'fill',
        paint: {
            'fill-color': '#e7f527ff',
            'fill-opacity': 0.5
        }
    })


    // MENAMPILKAN HASIL ANALISIS
    let resultString= "";


    // looping data apartemen
    for (let index = 0; index < hasilApartemenData.features.length; index++) {
        // mengambil data apartemen
       const element = hasilApartemenData.features[index];


       console.log('DATA APARTEMEN', element);


       // mengambil koordinat apartemen
       const lat = element.geometry.coordinates[1];
       const lng = element.geometry.coordinates[0];
     
       // membuat point dan polygon
       const point  = turf.point([lng, lat]); // longitude, latitude
       const poly = turf.polygon(isochoneGeojson.geometry.coordinates);
       
       console.log('APAKAH APARTEMEN BERADA DALAM ISOCHRONE', turf.booleanPointInPolygon(point, poly))
       // cek apakah apartemen berada dalam jangkauan isochrone
       if(turf.booleanPointInPolygon(point, poly)){


           // jika iya, menambahkan data apartemen yang berada dalam jangkauan isochrone
            resultString += `<li>Apartemen ${element.properties.NAMA}</li>`;
       }


       console.log('HASIL STRING', resultString);


       // menampilkan hasil analisis pada HTML
       document.getElementById('hasil').innerHTML = resultString;
    }


}


// Fungsi untuk memindahkan tampilan peta ke area data drainase (Kota Yogyakarta)
window.zoomKeDrainase = () => {
    map.fitBounds([[110.345, -7.845], [110.405, -7.755]], { padding: 40, duration: 1500 });
}
