// ================= BASEMAP =================
const styles={
street:'https://basemap.mapid.io/styles/street-2d-building/style.json?key=69a8edeffdb1d3dbc8b3022c',
dark:'https://basemap.mapid.io/styles/dark/style.json?key=69a8edeffdb1d3dbc8b3022c',
sat:'https://basemap.mapid.io/styles/satellite/style.json?key=69a8edeffdb1d3dbc8b3022c'
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

// ================= INIT =================
map.on('load',init);
map.on('style.load',init);

async function init(){

clear();

const sd=await fetch('./data/SD.geojson').then(r=>r.json());
const smp=await fetch('./data/SMP.geojson').then(r=>r.json());
const sma=await fetch('./data/SMA.geojson').then(r=>r.json());
const sppg=await fetch('./data/SPPG.geojson').then(r=>r.json());

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
addLayer('sppg',sppg,'#000');

bindPopup();
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
function bindPopup(){
['sd','smp','sma','sppg'].forEach(layer=>{
map.on('click',layer+'-layer',(e)=>{
const p=e.features[0].properties;
const nama=p.NAMA || p.nama || "Tidak ada nama";
const jenjang=p.jenjang || layer.toUpperCase();

new maplibregl.Popup()
.setLngLat(e.lngLat)
.setHTML(`<b>${nama}</b><br>${jenjang}`)
.addTo(map);

if(layer==='sppg') selectedSPPG=e.features[0];
});
});
}

// ================= ISOCHRONE =================
async function getIso(point,waktu){
const [lng,lat]=point.geometry.coordinates;
const url=`https://routing.mapid.io/isochrone?key=68da7e7d06823ed3f510cc48&time_limit=${waktu}&point=${lat},${lng}&profile=car`;
const res=await fetch(url);
const data=await res.json();
return data.polygons[0];
}

function drawIso(geo){
safeRemove('iso');
map.addSource('iso',{type:'geojson',data:geo});
map.addLayer({
id:'iso-layer',
type:'fill',
source:'iso',
paint:{'fill-color':'#22c55e','fill-opacity':0.3}
});
}

// ================= ANALYSIS =================
function analyze(geo){

let sd=0,smp=0,sma=0;
let siswaSD=0,siswaSMP=0,siswaSMA=0;

sekolahData.forEach(s=>{
try{
if(turf.booleanPointInPolygon(turf.point(s.geometry.coordinates),geo)){
const j=s.properties.jenjang;
const siswa=s.properties.siswa || 200;

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
properties:{weight:s.properties.siswa || 1}
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
turf.bbox(geo),
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
const siswa = s.properties.siswa || (j==='SD'?200:(j==='SMP'?300:400));

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
'circle-color':'#ef4444',
'circle-radius':10
}
});

// ===============================
// 6. POPUP (BIAR INFORMATIVE)
// ===============================
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


// ================= EVENT =================
document.getElementById('run-local').onclick=async()=>{
if(!selectedSPPG) return alert("Klik SPPG dulu");

const iso=await getIso(selectedSPPG,document.getElementById('waktu').value);

drawIso(iso);
analyze(iso);
generateCandidate(iso);
generateHeatmap();
};

document.getElementById('run-global').onclick=async()=>{
const iso=await getIso(sppgData[0],600);
drawIso(iso);
analyze(iso);
generateCandidate(iso);
generateHeatmap();
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
map.setLayoutProperty(id,'visibility',v==='visible'?'none':'visible');
};

window.setStyle=(t)=>map.setStyle(styles[t]);