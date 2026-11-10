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

// ================= penghitungan cakupan dan beban setelah semua layer dasar ada (juga saat ganti basemap) =================
await terapkanBebanDasar();
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
.setHTML(`<b>${esc(nama)}</b><br>${jenjang}`+(layer==='sppg'&&p.dekat==1?`<br><span style="color:#dc2626">&#9888; ${esc(p.alasan)}</span>`:'')
// ================= memperbaiki popup SPPG yang tidak menampilkan beban menjadi juga menampilkan beban/kapasitas titik agar pengguna tahu apakah SPPG itu kelebihan permintaan =================
+(layer==='sppg'?infoBebanSppg(e.features[0].geometry.coordinates):''))
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

// ================= CAKUPAN & BEBAN SPPG =================
// ================= pembuatan parameter kapasitas per SPPG (porsi/penerima per hari) agar beban per SPPG bisa dibandingkan dengan kapasitasnya =================
const KAPASITAS_DEFAULT=3000;
let analisisDasar=null;            // hasil hitungan cakupan + beban terakhir {grup,kap,beban,tot}
let sekolahTdkTercakup=new Set();  // indeks sekolah (di sekolahData) yang berada di luar gabungan isochrone 10 menit

// jarak dua titik [lng,lat] dalam meter (haversine); dipakai langsung agar cepat untuk ratusan ribu pasangan
function jarakM(a,b){
const R=6371000,r=Math.PI/180;
const dl=(b[1]-a[1])*r,dg=(b[0]-a[0])*r;
const h=Math.sin(dl/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dg/2)**2;
return 2*R*Math.asin(Math.sqrt(h));
}
function nilaiKapasitas(){
const el=document.getElementById('kapasitas');
const v=Number(el&&el.value);
return v>0?v:KAPASITAS_DEFAULT;
}
const fmt=(n)=>Math.round(n).toLocaleString('id-ID');

// ================= pembuatan pengelompokan SPPG yang berada di titik yang sama (kapasitas titik = kapasitas x jumlah SPPG di titik itu) =================
function kelompokSppg(){
const m=new Map();
sppgData.forEach(f=>{
const xy=f.geometry.coordinates.slice(0,2);
const k=xy.join(',');
if(!m.has(k)) m.set(k,{xy,n:0,nama:[]});
const g=m.get(k);
g.n++;
g.nama.push(f.properties['Nama SPPG']);
});
return [...m.values()];
}

// ================= pembuatan alokasi tiap sekolah ke titik SPPG terdekat lalu hitung beban (jumlah siswa) tiap titik dan total kelebihan di atas kapasitas =================
function hitungBeban(grup,kap){
const muatan=grup.map(()=>0);
const dekat=sekolahData.map(s=>{
const xy=s.geometry.coordinates;
let b=-1,bd=Infinity;
grup.forEach((g,i)=>{const d=jarakM(xy,g.xy);if(d<bd){bd=d;b=i;}});
muatan[b]+=getSiswa(s);
return {idx:b,d:bd};
});
const kelebihan=grup.reduce((a,g,i)=>a+Math.max(0,muatan[i]-g.n*kap),0);
return {muatan,dekat,kelebihan};
}

// ================= pembuatan hitungan cakupan: sekolah di dalam/luar gabungan isochrone 10 menit, dihitung per jenjang (jumlah sekolah dan estimasi siswa) =================
async function hitungCakupan(){
const gab=await gabungIsochrone();
sekolahTdkTercakup=new Set();
const tot={SD:{n:0,ok:0,s:0,sok:0},SMP:{n:0,ok:0,s:0,sok:0},SMA:{n:0,ok:0,s:0,sok:0}};
sekolahData.forEach((s,i)=>{
const j=s.properties.jenjang;
const siswa=getSiswa(s);
tot[j].n++;tot[j].s+=siswa;
let ok=false;
try{ok=turf.booleanPointInPolygon(turf.point(s.geometry.coordinates.slice(0,2)),gab);}catch{}
if(ok){tot[j].ok++;tot[j].sok+=siswa;}else sekolahTdkTercakup.add(i);
});
return {tot,gab};
}

// ================= pembuatan penerapan hitungan dasar: cakupan + beban, lalu gambar lapisan dan perbarui panel KPI =================
async function terapkanBebanDasar(){
if(!sekolahData.length||!sppgData.length) return;
const kap=nilaiKapasitas();
const grup=kelompokSppg();
const beban=hitungBeban(grup,kap);
let cak=null;
try{cak=await hitungCakupan();}catch(e){console.error(e);}
analisisDasar={grup,kap,beban,tot:cak?cak.tot:null};
gambarCakupan(cak?cak.gab:null);
gambarBeban();
perbaruiKpi();
}

// ================= pembuatan lapisan area cakupan gabungan 10 menit (hijau muda di bawah titik sekolah) =================
function gambarCakupan(gab){
safeRemove('cover');
if(!gab) return;
map.addSource('cover',{type:'geojson',data:gab});
map.addLayer({
id:'cover-layer',
type:'fill',
source:'cover',
paint:{'fill-color':'#22c55e','fill-opacity':0.12,'fill-outline-color':'#16a34a'}
},map.getLayer('sd-layer')?'sd-layer':undefined);
}

// ================= pembuatan halo coklat di titik SPPG yang bebannya melebihi kapasitas (makin besar halo, makin berlebih) =================
function gambarBeban(){
safeRemove('beban');
if(!analisisDasar) return;
const {grup,kap,beban}=analisisDasar;
const fitur=grup.map((g,i)=>({
type:'Feature',
geometry:{type:'Point',coordinates:g.xy},
properties:{util:beban.muatan[i]/(g.n*kap),muatan:beban.muatan[i],kapasitas:g.n*kap,n:g.n}
}));
map.addSource('beban',{type:'geojson',data:{type:'FeatureCollection',features:fitur}});
map.addLayer({
id:'beban-layer',
type:'circle',
source:'beban',
filter:['>',['get','util'],1],
paint:{
'circle-color':'#92400e',
'circle-opacity':0.35,
'circle-radius':['interpolate',['linear'],['get','util'],1,12,2.5,28],
'circle-stroke-color':'#92400e',
'circle-stroke-width':1.5
}
},map.getLayer('sppg-layer')?'sppg-layer':undefined);
}

// ================= pembuatan teks beban titik SPPG untuk popup (beban, kapasitas, persen) =================
function infoBebanSppg(coord){
if(!analisisDasar) return '';
const k=coord.slice(0,2).join(',');
const i=analisisDasar.grup.findIndex(g=>g.xy.join(',')===k);
if(i<0) return '';
const g=analisisDasar.grup[i];
const muatan=analisisDasar.beban.muatan[i];
const kapT=g.n*analisisDasar.kap;
const u=muatan/kapT;
const warna=u>1?'#92400e':(u>0.7?'#a16207':'#15803d');
return `<br><span style="color:${warna}">Beban titik ini: ${fmt(muatan)} dari ${fmt(kapT)} penerima/hari (${Math.round(u*100)}%)${g.n>1?` &middot; ${g.n} SPPG di titik ini`:''}</span>`;
}

// ================= pembuatan pembaruan panel KPI cakupan 10 menit dan beban per SPPG =================
function perbaruiKpi(){
if(!analisisDasar) return;
const {grup,kap,beban,tot}=analisisDasar;
const set=(id,v)=>{const el=document.getElementById(id);if(el) el.innerText=v;};
if(tot){
let belumS=0,belumN=0;
['SD','SMP','SMA'].forEach(j=>{
const t=tot[j];
set('kpiCov'+j,`${(100*t.sok/t.s).toFixed(1)}% siswa (${t.ok}/${t.n} sekolah)`);
belumN+=t.n-t.ok;belumS+=t.s-t.sok;
});
set('kpiBelum',`${belumN} sekolah (~${fmt(belumS)} siswa)`);
}
const kapTotal=grup.reduce((a,g)=>a+g.n*kap,0);
const minta=beban.muatan.reduce((a,b)=>a+b,0);
const over=grup.filter((g,i)=>beban.muatan[i]>g.n*kap).length;
set('kpiKapasitas',fmt(kapTotal)+' penerima/hari');
set('kpiPermintaan',fmt(minta));
set('kpiUtil',Math.round(100*minta/kapTotal)+'% dari kapasitas');
set('kpiOver',over);
set('kpiGrup',grup.length);
set('kpiKelebihan',fmt(beban.kelebihan)+' siswa');
}

// ================= pembuatan pendengar input kapasitas agar KPI dan halo beban langsung diperbarui =================
const inputKapasitas=document.getElementById('kapasitas');
if(inputKapasitas) inputKapasitas.addEventListener('input',()=>{terapkanBebanDasar();});

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
// ================= memperbaiki daftar clear() yang hanya 7 layer menjadi juga cover dan beban agar tidak terduplikasi saat ganti basemap =================
['sd','smp','sma','sppg','iso','candidate','heatmap','cover','beban'].forEach(safeRemove);
}

window.toggleLayer=(id)=>{
if(!map.getLayer(id)) return;
const v=map.getLayoutProperty(id,'visibility');
// ================= memperbaiki v==='visible'?'none':'visible' menjadi v==='none'?'visible':'none' agar klik pertama langsung menyembunyikan layer (visibility awal undefined) =================
map.setLayoutProperty(id,'visibility',v==='none'?'visible':'none');
};

// ================= memperbaiki map.setStyle(styles[t]) menjadi map.setStyle(styles[t],{diff:false}) agar style dimuat ulang penuh dan event style.load menyala sehingga init menggambar ulang layer sekolah/SPPG (mode diff bawaan menghapus layer kita tanpa memicu style.load) =================
window.setStyle=(t)=>map.setStyle(styles[t],{diff:false});