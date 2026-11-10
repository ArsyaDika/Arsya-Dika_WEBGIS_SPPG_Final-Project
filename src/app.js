// ================= KUNCI API =================
// ================= memperbaiki MAPID_ROUTING_KEY (dan MAPID_BASEMAP_KEY) menjadi dihapus agar kode tidak lagi memuat API key apa pun: basemap memakai penyedia tanpa key, isochrone dibaca dari data statis data/isochrone-sppg-600.geojson =================

// ================= BASEMAP =================
// ================= pembuatan daftar basemap gratis tanpa API key (pengganti MapID) agar peta tetap tampil setelah langganan berhenti =================
const styles={
// Street: OpenFreeMap (vektor, data OpenStreetMap)
street:'https://tiles.openfreemap.org/styles/liberty',
// Dark: CARTO Dark Matter (vektor)
dark:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
// Satellite: Esri World Imagery (tile raster), ditulis sebagai objek style MapLibre
sat:{
version:8,
sources:{
esri:{
type:'raster',
tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
tileSize:256,
maxzoom:19,
attribution:'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
}
},
layers:[{id:'esri-satellite',type:'raster',source:'esri'}]
}
};

const map=new maplibregl.Map({
container:'map',
style:styles.street,
center:[110.42,-6.99],
zoom:12
});

let sekolahData=[], sppgData=[];
let chartSekolah, chartSiswa, chartPie;
let selectedSPPG=null;
// ================= memperbaiki hasil analisis yang tidak tersimpan menjadi disimpan di lastIso agar bisa digambar ulang setelah ganti basemap =================
let lastIso=null;

// ================= INIT =================
// ================= memperbaiki map.on('load',init)+map.on('style.load',init) menjadi hanya map.on('style.load',init) agar init tidak jalan dua kali dan layer tidak terdaftar ganda =================
map.on('style.load',init);

async function init(){

clear();

const sd=await fetch('./data/SD.geojson').then(r=>r.json());
const smp=await fetch('./data/SMP.geojson').then(r=>r.json());
const sma=await fetch('./data/SMA.geojson').then(r=>r.json());
// ================= memperbaiki fetch SPPG.geojson (koordinat salah, 128 SPPG) menjadi SPPG_geocoded.geojson yang disaring dipakai_analisis (123 SPPG) agar peta dan analisis memakai koordinat yang sudah diperbaiki =================
const sppgSemua=await fetch('./data/SPPG_geocoded.geojson').then(r=>r.json());
const sppg={type:'FeatureCollection',features:sppgSemua.features.filter(f=>f.properties.dipakai_analisis)};

sekolahData=[
...sd.features.map(f=>({...f,properties:{...f.properties,jenjang:'SD'}})),
...smp.features.map(f=>({...f,properties:{...f.properties,jenjang:'SMP'}})),
...sma.features.map(f=>({...f,properties:{...f.properties,jenjang:'SMA'}}))
];

sppgData=sppg.features;

// layer
addLayer('sd',sd,'#3b82f6');
addLayer('smp',smp,'#f59e0b');
addLayer('sma',sma,'#8b5cf6');
// ================= pembuatan warna SPPG berdasarkan properti dekat: merah jika berdekatan dengan SPPG lain, hitam jika tidak =================
addLayer('sppg',sppg,['case',['==',['get','dekat'],1],'#ef4444','#000']);

bindPopup();

// ================= penghitungan SPPG berdekatan setelah layer SPPG ada (juga saat ganti basemap) =================
terapkanSppgBerdekatan();

// ================= memperbaiki init yang hanya menggambar layer dasar menjadi juga menggambar ulang isochrone, kandidat, dan heatmap dari lastIso agar hasil analisis tidak hilang saat ganti basemap =================
if(lastIso){
drawIso(lastIso);
generateCandidate(lastIso);
generateHeatmap();
}
}

// ================= LAYER =================
function addLayer(id,data,color){
map.addSource(id,{type:'geojson',data});
map.addLayer({
id:id+'-layer',
type:'circle',
source:id,
paint:{'circle-color':color,'circle-radius':5}
});
}

// ================= POPUP =================
let popupBound=false;
function bindPopup(){
// ================= memperbaiki bindPopup yang mendaftarkan map.on('click') setiap init menjadi hanya sekali lewat flag popupBound agar popup tidak muncul ganda setelah ganti basemap =================
if(popupBound) return;
popupBound=true;
['sd','smp','sma','sppg'].forEach(layer=>{
map.on('click',layer+'-layer',(e)=>{
const p=e.features[0].properties;
// ================= memperbaiki p.NAMA || p.nama menjadi p.NAMA || p.nama || p['Nama SPPG'] agar popup SPPG menampilkan nama (kolom data SPPG bernama 'Nama SPPG') =================
const nama=p.NAMA || p.nama || p['Nama SPPG'] || "Tidak ada nama";
const jenjang=p.jenjang || layer.toUpperCase();

new maplibregl.Popup()
.setLngLat(e.lngLat)
// ================= memperbaiki popup yang hanya menampilkan nama+jenjang menjadi juga menampilkan alasan SPPG berdekatan (merah) agar pengguna tahu mengapa SPPG itu ditandai =================
.setHTML(`<b>${esc(nama)}</b><br>${jenjang}`+(layer==='sppg'&&p.dekat==1?`<br><span style="color:#dc2626">&#9888; ${esc(p.alasan)}</span>`:''))
.addTo(map);

if(layer==='sppg') selectedSPPG=e.features[0];
});
});
}

// ================= SPPG BERDEKATAN =================
// ================= pembuatan fungsi esc agar teks dari data aman ditampilkan di popup HTML =================
function esc(t){
return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ================= pembuatan penghitungan SPPG berdekatan: tandai dekat=1 dan tulis alasan jika ada SPPG lain dalam jarak (meter) yang diatur pengguna =================
function terapkanSppgBerdekatan(){
const input=document.getElementById('jarakDekat');
const meter=Math.max(0,Number(input&&input.value)||0);
let jumlah=0;

sppgData.forEach((a,i)=>{
const tetangga=[];
sppgData.forEach((b,j)=>{
if(i===j) return;
const d=turf.distance(a.geometry.coordinates.slice(0,2),b.geometry.coordinates.slice(0,2),{units:'meters'});
if(d<=meter) tetangga.push({nama:b.properties['Nama SPPG'],d});
});
tetangga.sort((x,y)=>x.d-y.d);

if(tetangga.length>0){
const daftar=tetangga.slice(0,3).map(t=>`${t.nama} (${t.d<1?'titik/kelurahan yang sama':Math.round(t.d)+' m'})`).join(', ');
const sisa=tetangga.length>3?` dan ${tetangga.length-3} lainnya`:'';
a.properties.dekat=1;
a.properties.alasan=`Berdekatan dengan ${tetangga.length} SPPG lain dalam radius ${meter} m: ${daftar}${sisa}. Layanan berpotensi tumpang tindih.`;
jumlah++;
}else{
a.properties.dekat=0;
a.properties.alasan='';
}
});

const src=map.getSource('sppg');
if(src) src.setData({type:'FeatureCollection',features:sppgData});
const e1=document.getElementById('jumlahDekat'), e2=document.getElementById('jumlahSppg');
if(e1) e1.innerText=jumlah;
if(e2) e2.innerText=sppgData.length;
}

// ================= pembuatan pendengar input jarak agar warna SPPG langsung berubah saat angka diganti =================
const inputJarak=document.getElementById('jarakDekat');
if(inputJarak) inputJarak.addEventListener('input',terapkanSppgBerdekatan);

// ================= ISOCHRONE =================
// ================= penarikan data isochrone statis 10 menit (hasil scripts/fetch-isochrones.mjs) agar aplikasi tidak butuh API/key saat dipakai =================
let isoSppg=null; // FeatureCollection: satu poligon isochrone per SPPG (properti sppg_no, sppg_nama, waktu_detik)
async function muatIsochrone(){
if(isoSppg) return isoSppg;
const res=await fetch('./data/isochrone-sppg-600.geojson');
if(!res.ok) throw new Error('data/isochrone-sppg-600.geojson tidak ditemukan (jalankan scripts/fetch-isochrones.mjs)');
isoSppg=await res.json();
return isoSppg;
}

// ================= memperbaiki getIso yang memanggil API MapID tiap klik (satu SPPG, butuh key berbayar) menjadi mencari isochrone SPPG terpilih di data statis agar tidak butuh API/key dan hasilnya sama untuk semua pengguna =================
async function getIso(point){
const data=await muatIsochrone();
const no=point.properties['No SPPG'];
const iso=data.features.find(f=>String(f.properties.sppg_no)===String(no));
if(!iso) throw new Error('Isochrone untuk SPPG ini tidak ada (SPPG tidak dipakai dalam analisis).');
return iso;
}

// ================= pembuatan cakupan gabungan (union) seluruh isochrone SPPG agar analisis memakai area yang benar-benar terlayani oleh semua SPPG, bukan satu SPPG =================
let cakupanGabungan=null;
async function gabungIsochrone(){
if(cakupanGabungan) return cakupanGabungan;
const data=await muatIsochrone();
// SPPG di titik yang sama punya isochrone identik; ambil satu poligon per bentuk unik agar union lebih cepat
const unik=new Map();
data.features.forEach(f=>{
const ring=f.geometry.coordinates[0];
const kunci=ring.length+'|'+ring[0].join(',')+'|'+ring[Math.floor(ring.length/2)].join(',');
if(!unik.has(kunci)) unik.set(kunci,f);
});
cakupanGabungan=turf.union(turf.featureCollection([...unik.values()]));
return cakupanGabungan;
}

function drawIso(geo){
lastIso=geo;
safeRemove('iso');
map.addSource('iso',{type:'geojson',data:geo});
map.addLayer({
id:'iso-layer',
type:'fill',
source:'iso',
paint:{'fill-color':'#22c55e','fill-opacity':0.3}
});
}

// ================= memperbaiki tiga fallback siswa berbeda (200 / 1 / 200-300-400) menjadi satu fungsi getSiswa agar dashboard, heatmap, dan kandidat memakai angka yang sama (data GeoJSON tidak punya kolom siswa, jadi memakai estimasi per jenjang) =================
const SISWA_DEFAULT={SD:200,SMP:300,SMA:400};
function getSiswa(s){
return s.properties.siswa || SISWA_DEFAULT[s.properties.jenjang] || 200;
}

// ================= ANALYSIS =================
function analyze(geo){

let sd=0,smp=0,sma=0;
let siswaSD=0,siswaSMP=0,siswaSMA=0;

sekolahData.forEach(s=>{
try{
if(turf.booleanPointInPolygon(turf.point(s.geometry.coordinates),geo)){
const j=s.properties.jenjang;
// ================= memperbaiki s.properties.siswa || 200 menjadi getSiswa(s) agar estimasi siswa sesuai jenjang =================
const siswa=getSiswa(s);

if(j==='SD'){sd++;siswaSD+=siswa;}
if(j==='SMP'){smp++;siswaSMP+=siswa;}
if(j==='SMA'){sma++;siswaSMA+=siswa;}
}
}catch{}
});

document.getElementById('served').innerText=sd+smp+sma;
document.getElementById('coverage').innerText=(siswaSD+siswaSMP+siswaSMA)+" siswa";

document.getElementById('sdCount').innerText=sd;
document.getElementById('smpCount').innerText=smp;
document.getElementById('smaCount').innerText=sma;

drawChart(sd,smp,sma,siswaSD,siswaSMP,siswaSMA);
}

// ================= CHART =================
function drawChart(sd,smp,sma,siswaSD,siswaSMP,siswaSMA){

if(chartSekolah) chartSekolah.destroy();
if(chartSiswa) chartSiswa.destroy();
if(chartPie) chartPie.destroy();

chartSekolah=new Chart(document.getElementById('chartSekolah'),{
type:'bar',
data:{labels:['SD','SMP','SMA'],datasets:[{data:[sd,smp,sma]}]}
});

chartSiswa=new Chart(document.getElementById('chartSiswa'),{
type:'bar',
data:{labels:['SD','SMP','SMA'],datasets:[{data:[siswaSD,siswaSMP,siswaSMA]}]}
});

chartPie=new Chart(document.getElementById('chartPie'),{
type:'doughnut',
data:{labels:['SD','SMP','SMA'],datasets:[{data:[siswaSD,siswaSMP,siswaSMA]}]}
});
}

// ================= HEATMAP =================
function generateHeatmap(){

safeRemove('heatmap');

map.addSource('heatmap',{
type:'geojson',
data:{
type:'FeatureCollection',
features:sekolahData.map(s=>({
type:'Feature',
geometry:s.geometry,
// ================= memperbaiki weight s.properties.siswa || 1 menjadi getSiswa(s)/SISWA_DEFAULT.SMA agar bobot heatmap mengikuti jumlah siswa dan tetap bernilai 0-1 (tidak jenuh) =================
properties:{weight:getSiswa(s)/SISWA_DEFAULT.SMA}
}))
}
});

map.addLayer({
id:'heatmap-layer',
type:'heatmap',
source:'heatmap',
paint:{
'heatmap-weight':['get','weight'],
'heatmap-intensity':1,
'heatmap-radius':20,
'heatmap-opacity':0.7
}
});
}

// ================= CANDIDATE =================
let candidatePopupBound=false;
function generateCandidate(geo){

safeRemove('candidate');

// ===============================
// 1. AMBIL SEKOLAH YANG TIDAK TERLAYANI
// ===============================
const gapSekolah = sekolahData.filter(s=>{
try{
return !turf.booleanPointInPolygon(
turf.point(s.geometry.coordinates),
geo
);
}catch{
return false;
}
});

if(gapSekolah.length === 0){
console.log("Tidak ada gap layanan");
return;
}

// ===============================
// 2. BUAT GRID (REPRESENTASI AREA)
// ===============================
const grid = turf.squareGrid(
// ================= memperbaiki turf.bbox(geo) menjadi turf.bbox(turf.featureCollection(sekolahData)) agar grid menutupi seluruh sekolah (termasuk yang di luar isochrone), bukan hanya area isochrone =================
turf.bbox(turf.featureCollection(sekolahData)),
1, // 1 km grid (realistis)
{units:'kilometers'}
);

let kandidat=[];

// ===============================
// 3. HITUNG DEMAND PER GRID
// ===============================
grid.features.forEach(cell=>{

let totalSiswa = 0;
let jumlahSekolah = 0;

gapSekolah.forEach(s=>{
try{

if(turf.booleanPointInPolygon(
turf.point(s.geometry.coordinates),
cell
)){

jumlahSekolah++;

// ambil siswa (real atau fallback)
const j = s.properties.jenjang;
// ================= memperbaiki fallback siswa lokal (200/300/400) menjadi getSiswa(s) agar sama dengan dashboard dan heatmap =================
const siswa = getSiswa(s);

totalSiswa += siswa;

}

}catch{}
});

// hanya ambil cell yang ada demand
if(jumlahSekolah > 0){

const center = turf.centroid(cell);

center.properties = {
sekolah: jumlahSekolah,
siswa: totalSiswa
};

kandidat.push(center);

}

});

// ===============================
// 4. SORT BERDASARKAN DEMAND (REALISTIS)
// ===============================
kandidat.sort((a,b)=> b.properties.siswa - a.properties.siswa);

// ambil top 5 lokasi terbaik
const topKandidat = kandidat.slice(0,5);

// ===============================
// 5. DRAW KE MAP
// ===============================
map.addSource('candidate',{
type:'geojson',
data:{
type:'FeatureCollection',
features: topKandidat
}
});

map.addLayer({
id:'candidate-layer',
type:'circle',
source:'candidate',
paint:{
// ================= memperbaiki warna kandidat #ef4444 (merah) menjadi #ec4899 (pink) agar tidak sama dengan SPPG berdekatan yang kini merah =================
'circle-color':'#ec4899',
'circle-radius':10
}
});

// ===============================
// 6. POPUP (BIAR INFORMATIVE)
// ===============================
// ================= memperbaiki map.on('click','candidate-layer') yang didaftarkan setiap generateCandidate menjadi hanya sekali lewat flag candidatePopupBound agar popup kandidat tidak ganda =================
if(!candidatePopupBound){
candidatePopupBound=true;
map.on('click','candidate-layer',(e)=>{

const p = e.features[0].properties;

new maplibregl.Popup()
.setLngLat(e.lngLat)
.setHTML(`
<b>Kandidat SPPG Baru</b><br>
Sekolah belum terlayani: ${p.sekolah}<br>
Total siswa: ${p.siswa}
`)
.addTo(map);

});
}

}


// ================= EVENT =================
// ================= memperbaiki Run Isochrone yang tanpa penanganan error menjadi dibungkus try/catch dengan alert agar pengguna tahu penyebab jika isochrone tidak ada =================
document.getElementById('run-local').onclick=async()=>{
if(!selectedSPPG) return alert("Klik SPPG dulu");
try{
const iso=await getIso(selectedSPPG);
drawIso(iso);
analyze(iso);
generateCandidate(iso);
generateHeatmap();
}catch(e){
alert(e.message);
}
};

// ================= memperbaiki Run Global yang hanya memakai satu SPPG (sppgData[0]) menjadi memakai gabungan isochrone semua SPPG agar "Global" benar-benar mencerminkan seluruh SPPG =================
document.getElementById('run-global').onclick=async()=>{
try{
const iso=await gabungIsochrone();
drawIso(iso);
analyze(iso);
generateCandidate(iso);
generateHeatmap();
}catch(e){
alert(e.message);
}
};


// ================= UTIL =================
function safeRemove(id){
if(map.getLayer(id+'-layer')) map.removeLayer(id+'-layer');
if(map.getSource(id)) map.removeSource(id);
}

function clear(){
['sd','smp','sma','sppg','iso','candidate','heatmap'].forEach(safeRemove);
}

window.toggleLayer=(id)=>{
if(!map.getLayer(id)) return;
const v=map.getLayoutProperty(id,'visibility');
// ================= memperbaiki v==='visible'?'none':'visible' menjadi v==='none'?'visible':'none' agar klik pertama langsung menyembunyikan layer (visibility awal undefined) =================
map.setLayoutProperty(id,'visibility',v==='none'?'visible':'none');
};

// ================= memperbaiki map.setStyle(styles[t]) menjadi map.setStyle(styles[t],{diff:false}) agar style dimuat ulang penuh dan event style.load menyala sehingga init menggambar ulang layer sekolah/SPPG (mode diff bawaan menghapus layer kita tanpa memicu style.load) =================
window.setStyle=(t)=>map.setStyle(styles[t],{diff:false});