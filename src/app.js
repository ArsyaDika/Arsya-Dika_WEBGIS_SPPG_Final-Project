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

// ================= memperbaiki fetch data tanpa opsi cache menjadi cache:'no-cache' agar browser selalu memeriksa versi terbaru berkas data (data sering diperbarui oleh skrip) =================
const sd=await fetch('./data/SD.geojson',{cache:'no-cache'}).then(r=>r.json());
const smp=await fetch('./data/SMP.geojson',{cache:'no-cache'}).then(r=>r.json());
const sma=await fetch('./data/SMA.geojson',{cache:'no-cache'}).then(r=>r.json());
// ================= memperbaiki fetch SPPG.geojson (koordinat salah, 128 SPPG) menjadi SPPG_geocoded.geojson yang disaring dipakai_analisis (123 SPPG) agar peta dan analisis memakai koordinat yang sudah diperbaiki =================
const sppgSemua=await fetch('./data/SPPG_geocoded.geojson',{cache:'no-cache'}).then(r=>r.json());
sppgSemuaData=sppgSemua.features;   // disimpan untuk panel kualitas data (jumlah dipakai vs tercatat)
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
generateHeatmap();
}

// ================= penghitungan cakupan dan beban setelah semua layer dasar ada (juga saat ganti basemap) =================
await terapkanBebanDasar();
// ================= memperbaiki generateCandidate(lastIso) menjadi menggambar ulang kandidat tersimpan agar kandidat tidak hilang saat ganti basemap =================
gambarKandidat(kandidatTerakhir);
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
+(layer==='sppg'?infoBebanSppg(e.features[0]):'')
// ================= memperbaiki popup SPPG yang hanya menampilkan beban menjadi juga menampilkan nama sekolah yang dilayani dan menggambar area layanannya agar pengguna melihat siapa yang dilayani SPPG ini =================
+(layer==='sppg'?teksSekolahDilayani(e.features[0]):''))
.addTo(map);

if(layer==='sppg'){selectedSPPG=e.features[0];gambarLayanan(e.features[0]);}
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
const res=await fetch('./data/isochrone-sppg-600.geojson',{cache:'no-cache'});
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
// ================= memperbaiki titik SPPG yang hanya menyimpan nama menjadi juga menyimpan No SPPG (nos) agar popup mencari titiknya lewat No SPPG, bukan koordinat yang dibulatkan MapLibre =================
if(!m.has(k)) m.set(k,{xy,n:0,nama:[],nos:[]});
const g=m.get(k);
g.n++;
g.nama.push(f.properties['Nama SPPG']);
g.nos.push(String(f.properties['No SPPG']));
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
// ================= memperbaiki pencarian titik SPPG dari fitur peta: koordinat fitur dibulatkan MapLibre sehingga tidak sama persis dengan data, jadi dicari lewat properti No SPPG =================
function idxGrupFitur(f){
if(!analisisDasar||!f||!f.properties) return -1;
const no=String(f.properties['No SPPG']);
return analisisDasar.grup.findIndex(g=>g.nos.includes(no));
}
function infoBebanSppg(f){
if(!analisisDasar) return '';
const i=idxGrupFitur(f);
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
// ================= memperbaiki perbaruiKpi yang hanya mengisi panel Param menjadi juga memperbarui dashboard (KPI melayang + dock grafik) agar tampilan utama selalu sinkron =================
renderDashboard();
}

// ================= pembuatan pendengar input kapasitas agar KPI dan halo beban langsung diperbarui =================
const inputKapasitas=document.getElementById('kapasitas');
// ================= memperbaiki pendengar kapasitas agar juga menghapus kandidat lama (hasilnya tidak berlaku lagi untuk kapasitas baru) =================
if(inputKapasitas) inputKapasitas.addEventListener('input',()=>{
kandidatTerakhir=null;
safeRemove('candidate');
const ring=document.getElementById('hasilKandidat'),daftar=document.getElementById('listKandidat');
if(ring) ring.innerText='Kapasitas berubah. Jalankan ulang pencarian.';
if(daftar) daftar.innerHTML='';
terapkanBebanDasar();
});

// ================= DASHBOARD (REL IKON, KPI MELAYANG, DOCK GRAFIK) =================
// ================= pembuatan tombol rel ikon: Dash menampilkan/menyembunyikan KPI dan dock; tab lain membuka laci kontrol sesuai panelnya =================
let sppgSemuaData=[];   // semua SPPG di berkas (termasuk yang tidak dipakai analisis), untuk panel kualitas data
const rel=document.getElementById('rail');
const laci=document.getElementById('drawer');
let tabAktif=null;
function pilihTab(tab){
if(tab==='dash'){
const off=document.body.classList.toggle('dock-off');
document.body.classList.toggle('dock-on',!off);
rel.querySelector('[data-tab=dash]').classList.toggle('on',!off);
return;
}
const tutup=(tabAktif===tab);          // klik tab yang sama menutup laci
tabAktif=tutup?null:tab;
laci.classList.toggle('buka',!tutup);
document.body.classList.toggle('drawer-on',!tutup);
laci.querySelectorAll('section').forEach(s=>s.classList.toggle('aktif',s.dataset.panel===tabAktif));
rel.querySelectorAll('button').forEach(b=>{if(b.dataset.tab!=='dash') b.classList.toggle('on',b.dataset.tab===tabAktif);});
}
if(rel) rel.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>pilihTab(b.dataset.tab)));

// ================= pembuatan tampilan dashboard: kartu KPI, SPPG terpadat, sebaran utilisasi, kurva manfaat kandidat, dan kualitas data =================
let kurvaTimer=null;
function renderDashboard(){
if(!analisisDasar) return;
const {grup,kap,beban,tot}=analisisDasar;
const set=(id,v)=>{const el=document.getElementById(id);if(el) el.innerHTML=v;};

// kartu KPI melayang
const minta=beban.muatan.reduce((a,b)=>a+b,0);
const kapT=grup.reduce((a,g)=>a+g.n*kap,0);
const over=grup.filter((g,i)=>beban.muatan[i]>g.n*kap).length;
if(tot){
const J=['SD','SMP','SMA'];
const ok=J.reduce((a,j)=>a+tot[j].ok,0),n=J.reduce((a,j)=>a+tot[j].n,0);
const sok=J.reduce((a,j)=>a+tot[j].sok,0),s=J.reduce((a,j)=>a+tot[j].s,0);
set('sKpiCov',(100*sok/s).toFixed(1)+'%');
set('sKpiCovSub',`${ok} dari ${n} sekolah`);
}
set('sKpiUtil',Math.round(100*minta/kapT)+'%');
set('sKpiUtilSub',`${fmt(minta)} / ${fmt(kapT)}`);
set('sKpiOver',`${over} / ${grup.length}`);
set('sKpiLebih',fmt(beban.kelebihan));

// SPPG terpadat (bar + garis kapasitas 100%)
const arr=grup.map((g,i)=>({nama:g.nama[0].replace(/^SPPG\s+(Kota\s+)?Semarang\s+/i,''),u:beban.muatan[i]/(g.n*kap)})).sort((a,b)=>b.u-a.u).slice(0,6);
const maks=Math.max(1,...arr.map(a=>a.u));
set('dockTerpadat',arr.map(a=>`<div class="row"><span class="n" title="${esc(a.nama)}">${esc(a.nama)}</span><div class="trk"><i class="${a.u>1?'r':(a.u>0.7?'a':'')}" style="width:${100*a.u/maks}%"></i><u style="left:${100/maks}%"></u></div><b>${Math.round(a.u*100)}%</b></div>`).join(''));

// sebaran utilisasi (tiga kelompok)
const u=grup.map((g,i)=>beban.muatan[i]/(g.n*kap));
const b1=u.filter(x=>x<=0.5).length,b2=u.filter(x=>x>0.5&&x<=1).length,b3=u.filter(x=>x>1).length;
const mb=Math.max(b1,b2,b3,1);
set('dockHist',`<div class="hist"><div style="height:${100*b1/mb}%;background:#22c55e">${b1}</div><div style="height:${100*b2/mb}%;background:#eab308">${b2}</div><div style="height:${100*b3/mb}%;background:#92400e">${b3}</div></div><div class="cat">&le;50% &nbsp; 50&ndash;100% &nbsp; &gt;100%</div>`);

// kurva manfaat kandidat (dihitung tertunda agar tidak berat saat kapasitas diketik)
clearTimeout(kurvaTimer);
kurvaTimer=setTimeout(()=>{
let nilai=[beban.kelebihan];
try{cariKandidat(20).daftar.forEach(d=>nilai.push(d.sisaKelebihan));}catch(e){console.error(e);}
const mx=Math.max(1,nilai[0]),W=120,H=80;
const pts=nilai.map((v,i)=>`${6+(W-12)*i/Math.max(1,nilai.length-1)},${8+(H-16)*(1-v/mx)}`).join(' ');
const idx=(k)=>nilai[Math.min(k,nilai.length-1)];
set('dockKurva',`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:96px"><polyline fill="none" stroke="#6366f1" stroke-width="2.5" points="${pts}"/></svg><div class="cat">${fmt(nilai[0])} &rarr; ${fmt(idx(5))} (5 lokasi) &rarr; ${fmt(idx(10))} (10) &rarr; ${fmt(nilai[nilai.length-1])} (${nilai.length-1})</div>`);
},60);

// kualitas data: ringkasan di dock dan rincian di tab Data
const semua=sppgSemuaData,dipakai=semua.filter(f=>f.properties.dipakai_analisis);
const jalan=dipakai.filter(f=>f.properties.geo_akurasi==='jalan').length;
const asli=sekolahData.filter(s=>s.properties.siswa).length;
const baris=(k,v)=>`<div class="row" style="justify-content:space-between"><span style="width:auto;color:#475569">${k}</span><b>${v}</b></div>`;
set('dockData',baris('SPPG dipakai / tercatat',`${dipakai.length} / ${semua.length}`)+baris('Koordinat SPPG: jalan / kelurahan',`${jalan} / ${dipakai.length-jalan}`)+baris('Titik SPPG unik',grup.length)+baris('Siswa dari data asli',Math.round(100*asli/Math.max(1,sekolahData.length))+'%'));
set('dataKualitas',baris('SPPG tercatat / dipakai analisis',`${semua.length} / ${dipakai.length}`)
+baris('Koordinat SPPG berasal dari alamat jalan',`${jalan}`)
+baris('Koordinat SPPG berupa titik kelurahan',`${dipakai.length-jalan}`)
+baris('Titik SPPG unik (SPPG kembar digabung)',grup.length)
+baris('Sekolah di peta (SD / SMP / SMA)',`${sekolahData.length} (${tot?tot.SD.n:'-'} / ${tot?tot.SMP.n:'-'} / ${tot?tot.SMA.n:'-'})`)
+baris('Sekolah dengan jumlah siswa asli',`${asli} dari ${sekolahData.length}`)
+`<p class="text-xs text-slate-500 mt-2">Metode: tiap sekolah dialokasikan ke titik SPPG terdekat; beban = jumlah siswa (estimasi SD 200, SMP 300, SMA 400) dibanding kapasitas (${fmt(kap)} per SPPG). Cakupan 10 menit = gabungan isochrone berkendara semua SPPG (OpenRouteService). SPPG yang dikeluarkan: koordinat tidak ditemukan atau terlalu jauh dari kota.</p>`);
}

// ================= LAYANAN SPPG (AREA & SEKOLAH YANG DILAYANI) =================
// ================= pembuatan pencarian sekolah yang dilayani satu titik SPPG (hasil alokasi ke SPPG terdekat, konsisten dengan hitungan beban) =================
function sekolahDilayani(f){
if(!analisisDasar) return null;
const i=idxGrupFitur(f);
if(i<0) return null;
const idx=[];
analisisDasar.beban.dekat.forEach((d,s)=>{if(d.idx===i) idx.push(s);});
return {i,idx};
}

// ================= pembuatan teks daftar nama sekolah yang dilayani per jenjang untuk popup SPPG (dapat digulir jika panjang) =================
function teksSekolahDilayani(coord){
const r=sekolahDilayani(coord);
if(!r) return '';
if(r.idx.length===0) return '<hr><b>Sekolah yang dilayani:</b> tidak ada (semua sekolah sekitar lebih dekat ke SPPG lain).';
const per={SD:[],SMP:[],SMA:[]};
let total=0;
r.idx.forEach(s=>{const sk=sekolahData[s];per[sk.properties.jenjang].push(sk.properties.NAMA||'(tanpa nama)');total+=getSiswa(sk);});
const g=analisisDasar.grup[r.i];
const bagian=['SD','SMP','SMA'].filter(j=>per[j].length).map(j=>`<b>${j} (${per[j].length})</b>: ${per[j].map(esc).join('; ')}`).join('<br>');
return `<hr><b>Sekolah yang dilayani:</b> ${r.idx.length} sekolah (&asymp; ${fmt(total)} siswa)`
+(g.n>1?`<br><i>Titik ini berisi ${g.n} SPPG; beban dibagi di antara mereka.</i>`:'')
+`<div style="max-height:170px;overflow:auto;font-size:12px;margin-top:4px">${bagian}</div>`;
}

// ================= pembuatan gambar area layanan SPPG (poligon cembung dari sekolah yang dilayani + lingkaran penanda tiap sekolah) =================
function hapusLayanan(){
['layanan-layer','layanan-sekolah-layer'].forEach(id=>{if(map.getLayer(id)) map.removeLayer(id);});
if(map.getSource('layanan')) map.removeSource('layanan');
}
function gambarLayanan(coord){
hapusLayanan();
const r=sekolahDilayani(coord);
if(!r||r.idx.length===0) return;
const pts=r.idx.map(s=>turf.point(sekolahData[s].geometry.coordinates.slice(0,2)));
const kumpulan=turf.featureCollection(pts);
let area=null;
try{area=turf.convex(kumpulan);}catch{}
// kurang dari 3 titik tidak membentuk poligon: pakai lingkaran kecil di sekitar titik pusatnya
area=(area&&area.geometry.type==='Polygon')?turf.buffer(area,0.15,{units:'kilometers'}):turf.buffer(turf.centroid(kumpulan),0.4,{units:'kilometers'});
map.addSource('layanan',{type:'geojson',data:turf.featureCollection([area,...pts])});
map.addLayer({id:'layanan-layer',type:'fill',source:'layanan',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#0ea5e9','fill-opacity':0.2,'fill-outline-color':'#0369a1'}},map.getLayer('sd-layer')?'sd-layer':undefined);
map.addLayer({id:'layanan-sekolah-layer',type:'circle',source:'layanan',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'rgba(0,0,0,0)','circle-radius':9,'circle-stroke-color':'#0369a1','circle-stroke-width':2}});
}
// klik di luar SPPG menghapus area layanan agar peta kembali bersih
map.on('click',(e)=>{
if(!map.getLayer('sppg-layer')) return;
if(map.queryRenderedFeatures(e.point,{layers:['sppg-layer']}).length===0) hapusLayanan();
});

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

// ================= KANDIDAT SPPG BARU (BERBASIS BEBAN) =================
// ================= memperbaiki generateCandidate lama (grid 1 km dari satu isochrone, urut jumlah siswa) menjadi pencarian greedy berbasis beban per SPPG berkapasitas tetap agar kandidat benar-benar meringankan SPPG yang kelebihan permintaan =================
let kandidatTerakhir=null;   // {daftar,sebelum,sesudah} hasil pencarian terakhir
let candidatePopupBound=false;

// ================= pembuatan pencarian kandidat: tiap putaran pilih satu lokasi sekolah yang paling banyak mengurangi kelebihan beban dan menjangkau sekolah yang belum tercakup 10 menit =================
function cariKandidat(K){
const {grup,kap,beban}=analisisDasar;
const N=sekolahData.length;
const xy=sekolahData.map(s=>s.geometry.coordinates.slice(0,2));
const siswa=sekolahData.map(s=>getSiswa(s));
const D=xy.map(a=>xy.map(b=>jarakM(a,b)));                 // jarak antar sekolah (meter), dihitung sekali
const g=beban.dekat.map(d=>d.idx);                          // penugasan: indeks titik SPPG, atau indeks kandidat (>= grup.length)
const jarakKini=beban.dekat.map(d=>d.d);                    // jarak tiap sekolah ke pemberi layanan terdekat saat ini
const kapAll=grup.map(x=>x.n*kap);
const muatan=beban.muatan.slice();
const belum=new Set(sekolahTdkTercakup);                    // sekolah yang belum tercakup isochrone 10 menit
const RADIUS_COV=2000, JARAK_MIN_SPPG=300, JARAK_MIN_KANDIDAT=1000;   // meter
const kelebihanAwal=beban.kelebihan;
const belumAwal=[...belum].reduce((a,i)=>a+siswa[i],0);
const dipilih=[];

for(let r=0;r<K;r++){
let best=null;
for(let c=0;c<N;c++){
if(jarakKini[c]<JARAK_MIN_SPPG) continue;                       // terlalu dekat dengan SPPG/kandidat yang ada
if(dipilih.some(p=>D[c][p.c]<JARAK_MIN_KANDIDAT)) continue;     // terlalu dekat dengan kandidat lain
let muatC=0;
const lepas=new Map();                                          // titik asal -> siswa yang pindah ke kandidat
for(let s=0;s<N;s++){
if(D[c][s]<jarakKini[s]){muatC+=siswa[s];lepas.set(g[s],(lepas.get(g[s])||0)+siswa[s]);}
}
let gain=0;                                                     // pengurangan kelebihan beban di titik asal
lepas.forEach((v,idx)=>{
gain+=Math.max(0,muatan[idx]-kapAll[idx])-Math.max(0,muatan[idx]-v-kapAll[idx]);
});
const exC=Math.max(0,muatC-kap);                                // kelebihan baru jika kandidat sendiri melebihi kapasitas
let cov=0;
belum.forEach(s=>{if(D[c][s]<=RADIUS_COV) cov+=siswa[s];});     // siswa belum tercakup yang terjangkau (perkiraan radius 2 km)
const skor=gain-exC+cov;
if(!best||skor>best.skor) best={c,skor,gain,cov,muatC,lepas};
}
if(!best||best.skor<=0) break;                                  // tidak ada lokasi yang masih memberi manfaat

const c=best.c;
const idxBaru=kapAll.length;
kapAll.push(kap);muatan.push(best.muatC);
const dariSppg=[];
best.lepas.forEach((v,idx)=>{muatan[idx]-=v;if(idx<grup.length) dariSppg.push({nama:grup[idx].nama[0],siswa:v});});
let nSek=0;
for(let s=0;s<N;s++){if(D[c][s]<jarakKini[s]){g[s]=idxBaru;jarakKini[s]=D[c][s];nSek++;}}
[...belum].filter(s=>D[c][s]<=RADIUS_COV).forEach(s=>belum.delete(s));
const p=sekolahData[c].properties;
dipilih.push({
c,rank:r+1,xy:xy[c],
host:{nama:p.NAMA,jenjang:p.jenjang,kel:p.DESA,kec:p.KECAMATAN},
gainBeban:best.gain,gainBelum:best.cov,sekolah:nSek,siswa:best.muatC,util:best.muatC/kap,
dariSppg:dariSppg.sort((a,b)=>b.siswa-a.siswa).slice(0,3),
sisaKelebihan:kapAll.reduce((a,k,i)=>a+Math.max(0,muatan[i]-k),0),
sisaBelum:[...belum].reduce((a,i)=>a+siswa[i],0)
});
}
const akhir=dipilih[dipilih.length-1];
return {
daftar:dipilih,
sebelum:{kelebihan:kelebihanAwal,belum:belumAwal},
sesudah:{kelebihan:akhir?akhir.sisaKelebihan:kelebihanAwal,belum:akhir?akhir.sisaBelum:belumAwal}
};
}

// ================= pembuatan teks popup kandidat: lokasi acuan, sekolah yang diambil alih, beban, dan SPPG yang diringankan =================
function teksKandidat(k){
return `<b>Kandidat SPPG baru #${k.rank}</b><br>Lokasi acuan: ${esc(k.host.nama)} (${esc(k.host.jenjang)}), ${esc(k.host.kel)}, ${esc(k.host.kec)}`
+`<br>Mengambil alih ${k.sekolah} sekolah (${fmt(k.siswa)} siswa, ${Math.round(k.util*100)}% dari kapasitas)`
+`<br>Mengurangi kelebihan beban: ${fmt(k.gainBeban)} siswa`
+(k.gainBelum?`<br>Menjangkau sekolah belum tercakup: ~${fmt(k.gainBelum)} siswa`:'')
+(k.dariSppg.length?`<br>Meringankan: ${k.dariSppg.map(d=>esc(d.nama)+' ('+fmt(d.siswa)+')').join(', ')}`:'');
}

// ================= pembuatan gambar titik kandidat (pink) beserta popup yang terdaftar sekali saja =================
function gambarKandidat(hasil){
safeRemove('candidate');
if(!hasil||!hasil.daftar.length) return;
map.addSource('candidate',{type:'geojson',data:{type:'FeatureCollection',features:hasil.daftar.map(k=>({type:'Feature',geometry:{type:'Point',coordinates:k.xy},properties:{rank:k.rank,teks:teksKandidat(k)}}))}});
map.addLayer({id:'candidate-layer',type:'circle',source:'candidate',paint:{'circle-color':'#ec4899','circle-radius':10,'circle-stroke-color':'#ffffff','circle-stroke-width':2}});
if(!candidatePopupBound){
candidatePopupBound=true;
map.on('click','candidate-layer',(e)=>{
new maplibregl.Popup().setLngLat(e.lngLat).setHTML(e.features[0].properties.teks).addTo(map);
});
}
}

// ================= pembuatan tampilan hasil kandidat di panel (ringkasan sebelum/sesudah dan daftar lokasi) =================
function tampilkanHasilKandidat(h){
const ring=document.getElementById('hasilKandidat');
const daftar=document.getElementById('listKandidat');
if(!ring||!daftar) return;
if(!h||!h.daftar.length){
ring.innerText='Tidak ada lokasi baru yang memberi manfaat (beban sudah tertangani dan tidak ada sekolah yang belum tercakup).';
daftar.innerHTML='';
return;
}
ring.innerHTML=`Kelebihan beban: <b>${fmt(h.sebelum.kelebihan)}</b> &rarr; <b>${fmt(h.sesudah.kelebihan)}</b> siswa.<br>Belum tercakup 10 menit: <b>${fmt(h.sebelum.belum)}</b> &rarr; <b>${fmt(h.sesudah.belum)}</b> siswa.`;
daftar.innerHTML=h.daftar.map(k=>`<li>${esc(k.host.kel)}, ${esc(k.host.kec)}: ambil alih ${k.sekolah} sekolah (${fmt(k.siswa)} siswa)${k.gainBeban>0?`, kelebihan &minus;${fmt(k.gainBeban)}`:''}${k.gainBelum?`, jangkau ~${fmt(k.gainBelum)} siswa belum tercakup`:''}</li>`).join('');
}

// ================= pembuatan tombol Cari Lokasi SPPG Baru dan pendengar kapasitas (hasil lama dihapus jika kapasitas berubah) =================
document.getElementById('run-kandidat').onclick=()=>{
if(!analisisDasar) return alert('Data belum siap, coba lagi sebentar.');
const K=Math.max(1,Math.min(20,Math.round(Number(document.getElementById('jumlahKandidat').value)||5)));
kandidatTerakhir=cariKandidat(K);
gambarKandidat(kandidatTerakhir);
tampilkanHasilKandidat(kandidatTerakhir);
};

// ================= EVENT =================
// ================= memperbaiki Run Isochrone yang tanpa penanganan error menjadi dibungkus try/catch dengan alert agar pengguna tahu penyebab jika isochrone tidak ada =================
document.getElementById('run-local').onclick=async()=>{
if(!selectedSPPG) return alert("Klik SPPG dulu");
try{
const iso=await getIso(selectedSPPG);
drawIso(iso);
analyze(iso);
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
// ================= memperbaiki clear() agar juga menghapus area layanan SPPG sebelum menggambar ulang =================
hapusLayanan();
}

window.toggleLayer=(id)=>{
if(!map.getLayer(id)) return;
const v=map.getLayoutProperty(id,'visibility');
// ================= memperbaiki v==='visible'?'none':'visible' menjadi v==='none'?'visible':'none' agar klik pertama langsung menyembunyikan layer (visibility awal undefined) =================
map.setLayoutProperty(id,'visibility',v==='none'?'visible':'none');
};

// ================= memperbaiki map.setStyle(styles[t]) menjadi map.setStyle(styles[t],{diff:false}) agar style dimuat ulang penuh dan event style.load menyala sehingga init menggambar ulang layer sekolah/SPPG (mode diff bawaan menghapus layer kita tanpa memicu style.load) =================
window.setStyle=(t)=>map.setStyle(styles[t],{diff:false});