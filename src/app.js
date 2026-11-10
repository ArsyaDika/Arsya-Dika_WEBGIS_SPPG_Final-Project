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

// ================= JENJANG =================
// ================= pembuatan daftar jenjang (SD, MI, SMP, MTs, SMA, SMK, MA) dengan id layer dan warna, agar semua bagian kode (layer, popup, dashboard) memakai satu sumber dan mudah ditambah jenjang baru =================
const JENJANG=[
{k:'SD',id:'sd',warna:'#3b82f6'},
{k:'MI',id:'mi',warna:'#06b6d4'},
{k:'SMP',id:'smp',warna:'#f59e0b'},
{k:'MTs',id:'mts',warna:'#ea580c'},
{k:'SMA',id:'sma',warna:'#8b5cf6'},
{k:'SMK',id:'smk',warna:'#14b8a6'},
{k:'MA',id:'ma',warna:'#a21caf'}
];

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
// ================= memperbaiki pembacaan tiga berkas lama (SD, SMP, SMA; tanpa data siswa, tanpa SMK/madrasah) menjadi satu berkas sekolah.geojson (sekolah resmi Kemendikdasmen + murid BPS 2025/2026) agar jumlah siswa dan jenjang sesuai data resmi =================
const sekolahBerkas=await fetch('./data/sekolah.geojson',{cache:'no-cache'}).then(r=>r.json());
// ================= memperbaiki fetch SPPG.geojson (koordinat salah, 128 SPPG) menjadi SPPG_geocoded.geojson yang disaring dipakai_analisis (123 SPPG) agar peta dan analisis memakai koordinat yang sudah diperbaiki =================
const sppgSemua=await fetch('./data/SPPG_geocoded.geojson',{cache:'no-cache'}).then(r=>r.json());
sppgSemuaData=sppgSemua.features;   // disimpan untuk panel kualitas data (jumlah dipakai vs tercatat)
const sppg={type:'FeatureCollection',features:sppgSemua.features.filter(f=>f.properties.dipakai_analisis)};

sekolahData=sekolahBerkas.features;   // properti jenjang (SD, MI, SMP, MTs, SMA, SMK, MA) dan siswa sudah ada di berkas

sppgData=sppg.features;

// ================= memperbaiki tiga addLayer tetap (SD, SMP, SMA dari berkas mentah) menjadi satu perulangan per jenjang dari sekolahData yang sudah diberi nomor sidx agar klik pada titik bisa dikaitkan ke data sekolah tanpa mencocokkan koordinat =================
sekolahData.forEach((s,i)=>{s.properties.sidx=i;});
JENJANG.forEach(j=>{
const fc={type:'FeatureCollection',features:sekolahData.filter(s=>s.properties.jenjang===j.k)};
if(fc.features.length) addLayer(j.id,fc,j.warna);
});
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

// ================= memperbaiki popup yang panjang (nama, jenjang, alasan, beban, daftar nama sekolah) menjadi sederhana: sekolah = nama dan jumlah siswa; SPPG = jumlah porsi dan jumlah sekolah per jenjang (daftar menurun, tanpa nama sekolah) agar sesuai permintaan; alasan SPPG berdekatan dipindah ke dashboard =================
function popupSekolah(f){
const s=sekolahData[Number(f.properties.sidx)]||{properties:f.properties};
return `<b>${esc(s.properties.NAMA||s.properties.nama||'Tanpa nama')}</b><br>Jumlah siswa: ${fmt(getSiswa(s))}`;
}
function popupSppg(f){
const nama=f.properties['Nama SPPG']||'Tanpa nama';
const i=idxGrupFitur(f),r=sekolahDilayani(f);
if(i<0||!r) return `<b>${esc(nama)}</b>`;
const g=analisisDasar.grup[i],muatan=analisisDasar.beban.muatan[i],per=perJenjang(r.idx);
const baris=JENJANG.filter(j=>per[j.k]).map(j=>`<li>${j.k}: ${per[j.k].n}</li>`).join('');
return `<b>${esc(nama)}</b><br>Jumlah porsi: <b>${fmt(muatan)}</b> / hari`
+(g.n>1?` <i>(titik berisi ${g.n} SPPG)</i>`:'')
+`<div style="margin-top:6px">Sekolah dilayani:</div><ul style="margin:2px 0 0 18px;padding:0;list-style:disc">${baris||'<li>tidak ada</li>'}</ul>`;
}

function bindPopup(){
// ================= memperbaiki bindPopup yang mendaftarkan map.on('click') setiap init menjadi hanya sekali lewat flag popupBound agar popup tidak muncul ganda setelah ganti basemap =================
if(popupBound) return;
popupBound=true;
// ================= memperbaiki daftar layer tetap ['sd','smp','sma','sppg'] menjadi semua jenjang di JENJANG (yang layernya ada) agar klik sekolah jenjang apa pun (MI, MTs, SMK, MA) juga bekerja =================
[...JENJANG.map(j=>j.id),'sppg'].filter(id=>map.getLayer(id+'-layer')).forEach(layer=>{
map.on('click',layer+'-layer',(e)=>{
const f=e.features[0];
// klik titik: simpan sebagai pilihan agar dashboard (KPI melayang + dock) berganti sesuai titik itu
if(layer==='sppg'){selectedSPPG=f;gambarLayanan(f);pilihan={tipe:'sppg',f};}
else{hapusLayanan();pilihan={tipe:'sekolah',idx:Number(f.properties.sidx)};}
new maplibregl.Popup().setLngLat(e.lngLat).setHTML(layer==='sppg'?popupSppg(f):popupSekolah(f)).addTo(map);
renderDashboard();
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
// ================= memperbaiki SISWA_DEFAULT (tebakan 200/300/400) menjadi membaca properti siswa dari data BPS per sekolah; angka tebakan hanya cadangan jika sebuah sekolah tidak punya nilai =================
const SISWA_DEFAULT={SD:200,MI:200,SMP:300,MTs:300,SMA:400,SMK:400,MA:300};
const SISWA_REF=600;   // acuan normalisasi bobot heatmap
function getSiswa(s){
const v=Number(s.properties.siswa);
return v>0?v:(SISWA_DEFAULT[s.properties.jenjang]||200);
}

// ================= ANALYSIS =================
// ================= memperbaiki analyze yang menghitung tetap tiga jenjang (sd, smp, sma) menjadi per jenjang dari JENJANG (termasuk MI, MTs, SMK, MA) dengan jumlah siswa dari data BPS =================
function analyze(geo){
const per={};
let total=0,siswaTotal=0;
sekolahData.forEach(s=>{
try{
if(turf.booleanPointInPolygon(turf.point(s.geometry.coordinates.slice(0,2)),geo)){
const j=s.properties.jenjang,siswa=getSiswa(s);
if(!per[j]) per[j]={n:0,siswa:0};
per[j].n++;per[j].siswa+=siswa;total++;siswaTotal+=siswa;
}
}catch{}
});
document.getElementById('served').innerText=total;
document.getElementById('coverage').innerText=fmt(siswaTotal)+' siswa';
const ada=JENJANG.filter(j=>per[j.k]);
const wadah=document.getElementById('hasilJenjang');
if(wadah) wadah.innerHTML=ada.map(j=>`<p>${j.k}: <b>${per[j.k].n}</b> sekolah &middot; ${fmt(per[j.k].siswa)} siswa</p>`).join('')||'<p>-</p>';
drawChart(ada.map(j=>j.k),ada.map(j=>per[j.k].n),ada.map(j=>per[j.k].siswa),ada.map(j=>j.warna));
}

// ================= CHART =================
// ================= memperbaiki drawChart yang tetap tiga label (SD, SMP, SMA) menjadi menerima label, jumlah sekolah, jumlah siswa, dan warna per jenjang agar semua jenjang tergambar =================
function drawChart(label,jumlah,siswa,warna){

if(chartSekolah) chartSekolah.destroy();
if(chartSiswa) chartSiswa.destroy();
if(chartPie) chartPie.destroy();

chartSekolah=new Chart(document.getElementById('chartSekolah'),{
type:'bar',
data:{labels:label,datasets:[{data:jumlah,backgroundColor:warna}]},
options:{plugins:{legend:{display:false},title:{display:true,text:'Jumlah sekolah'}}}
});

chartSiswa=new Chart(document.getElementById('chartSiswa'),{
type:'bar',
data:{labels:label,datasets:[{data:siswa,backgroundColor:warna}]},
options:{plugins:{legend:{display:false},title:{display:true,text:'Jumlah siswa (BPS, dibagi rata per sekolah)'}}}
});

chartPie=new Chart(document.getElementById('chartPie'),{
type:'doughnut',
data:{labels:label,datasets:[{data:siswa,backgroundColor:warna}]}
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
// ================= memperbaiki objek tot tetap (SD, SMP, SMA) menjadi dibuat per jenjang saat dibutuhkan agar jenjang baru (MI, MTs, SMK, MA) tidak menyebabkan error =================
const tot={};
sekolahData.forEach((s,i)=>{
const j=s.properties.jenjang;
const siswa=getSiswa(s);
if(!tot[j]) tot[j]={n:0,ok:0,s:0,sok:0};
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

// ================= memperbaiki pencarian titik SPPG dari fitur peta: koordinat fitur dibulatkan MapLibre sehingga tidak sama persis dengan data, jadi dicari lewat properti No SPPG =================
function idxGrupFitur(f){
if(!analisisDasar||!f||!f.properties) return -1;
const no=String(f.properties['No SPPG']);
return analisisDasar.grup.findIndex(g=>g.nos.includes(no));
}
// ================= pembuatan pembaruan panel KPI cakupan 10 menit dan beban per SPPG =================
function perbaruiKpi(){
if(!analisisDasar) return;
const {grup,kap,beban,tot}=analisisDasar;
const set=(id,v)=>{const el=document.getElementById(id);if(el) el.innerText=v;};
if(tot){
let belumS=0,belumN=0;
// ================= memperbaiki daftar cakupan tetap SD/SMP/SMA menjadi satu baris per jenjang yang ada di data (SD, MI, SMP, MTs, SMA, SMK, MA) =================
const wadahCov=document.getElementById('kpiCovList');
let teksCov='';
JENJANG.forEach(jj=>{
const t=tot[jj.k];
if(!t) return;
teksCov+=`<p class="text-sm">${jj.k}: <b>${(100*t.sok/t.s).toFixed(1)}% siswa (${t.ok}/${t.n} sekolah)</b></p>`;
belumN+=t.n-t.ok;belumS+=t.s-t.sok;
});
if(wadahCov) wadahCov.innerHTML=teksCov;
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

// ================= pembuatan tampilan dashboard dinamis: ringkasan kota (awal), SPPG terpilih, atau sekolah terpilih menurut titik yang diklik =================
// ================= memperbaiki dashboard statis (selalu ringkasan kota) menjadi dinamis: klik SPPG/sekolah mengganti KPI melayang dan grafik dock sesuai titik itu =================
let pilihan=null;   // titik yang dipilih pengguna: {tipe:'sppg',f} atau {tipe:'sekolah',idx}; null = ringkasan kota
let kurvaTimer=null; // penunda hitungan kurva manfaat kandidat (dibatalkan jika titik dipilih)

// pengisi kartu KPI melayang (n = 1..4) dan kartu dock (n = 1..4); dipakai semua tampilan
function setKpi(n,label,nilai,sub,kelas){
const L=document.getElementById('kL'+n),V=document.getElementById('kV'+n),S=document.getElementById('kS'+n);
if(L) L.innerHTML=label;
if(V){V.innerHTML=nilai;V.className=kelas||'';}
if(S) S.innerHTML=sub||'&nbsp;';
}
function setCard(n,judul,html){
const J=document.getElementById('dJ'+n),C=document.getElementById('dC'+n);
if(J) J.innerHTML=judul;
if(C) C.innerHTML=html;
}
const warnaUtil=(u)=>u>1?'#92400e':(u>0.7?'#eab308':'#22c55e');
function barisBar(nama,nilai,maks,teks,warna,garis){
const lebar=Math.max(1,Math.min(100,100*nilai/Math.max(1,maks)));
return `<div class="row"><span class="n" title="${esc(nama)}">${esc(nama)}</span><div class="trk"><i style="width:${lebar}%;background:${warna}"></i>${garis!=null?`<u style="left:${Math.min(100,100*garis/Math.max(1,maks))}%"></u>`:''}</div><b>${teks}</b></div>`;
}
function barisInfo(k,v){
return `<div class="row" style="justify-content:space-between;gap:10px"><span style="width:auto;color:#475569">${k}</span><b style="text-align:right">${v}</b></div>`;
}
// jumlah sekolah dan siswa per jenjang dari daftar indeks sekolah
function perJenjang(idxs){
const r={};
idxs.forEach(i=>{const s=sekolahData[i];const j=s.properties.jenjang;if(!r[j]) r[j]={n:0,siswa:0};r[j].n++;r[j].siswa+=getSiswa(s);});
return r;
}
const namaPendek=(n)=>String(n||'').replace(/^SPPG\s+(Kota\s+)?Semarang\s+/i,'');

// ================= pembuatan penyaji dashboard: memilih tampilan menurut titik yang dipilih =================
function renderDashboard(){
if(!analisisDasar) return;
renderDataKualitas();
const tombol=document.getElementById('btnKota');
if(pilihan&&pilihan.tipe==='sppg'&&idxGrupFitur(pilihan.f)>=0){if(tombol) tombol.style.display='block';return renderDashSppg(pilihan.f);}
if(pilihan&&pilihan.tipe==='sekolah'&&sekolahData[pilihan.idx]){if(tombol) tombol.style.display='block';return renderDashSekolah(pilihan.idx);}
pilihan=null;
if(tombol) tombol.style.display='none';
renderDashKota();
}

// ================= pembuatan tampilan ringkasan kota: KPI cakupan/utilisasi, SPPG terpadat, sebaran utilisasi, kurva manfaat kandidat, dan kualitas data =================
function renderDashKota(){
const {grup,kap,beban,tot}=analisisDasar;
const minta=beban.muatan.reduce((a,b)=>a+b,0);
const kapT=grup.reduce((a,g)=>a+g.n*kap,0);
const over=grup.filter((g,i)=>beban.muatan[i]>g.n*kap).length;
if(tot){
const J=Object.keys(tot);
const ok=J.reduce((a,j)=>a+tot[j].ok,0),n=J.reduce((a,j)=>a+tot[j].n,0);
const sok=J.reduce((a,j)=>a+tot[j].sok,0),s=J.reduce((a,j)=>a+tot[j].s,0);
setKpi(1,'Cakupan 10 menit',(100*sok/s).toFixed(1)+'%',`${ok} dari ${n} sekolah`,'ok');
}
setKpi(2,'Utilisasi kota',Math.round(100*minta/kapT)+'%',`${fmt(minta)} / ${fmt(kapT)}`,'');
setKpi(3,'SPPG &gt; kapasitas',`${over} / ${grup.length}`,'titik SPPG','bad');
setKpi(4,'Kelebihan permintaan',fmt(beban.kelebihan),'siswa (BPS 2025/2026)','bad');

// SPPG terpadat (bar + garis kapasitas 100%)
const arr=grup.map((g,i)=>({nama:namaPendek(g.nama[0]),u:beban.muatan[i]/(g.n*kap)})).sort((a,b)=>b.u-a.u).slice(0,6);
const maks=Math.max(1,...arr.map(a=>a.u));
setCard(1,'SPPG terpadat (garis putus = kapasitas 100%)',arr.map(a=>barisBar(a.nama,a.u,maks,Math.round(a.u*100)+'%',warnaUtil(a.u),1)).join(''));

// sebaran utilisasi (tiga kelompok)
const u=grup.map((g,i)=>beban.muatan[i]/(g.n*kap));
const b1=u.filter(x=>x<=0.5).length,b2=u.filter(x=>x>0.5&&x<=1).length,b3=u.filter(x=>x>1).length;
const mb=Math.max(b1,b2,b3,1);
setCard(2,'Sebaran utilisasi (titik SPPG)',`<div class="hist"><div style="height:${100*b1/mb}%;background:#22c55e">${b1}</div><div style="height:${100*b2/mb}%;background:#eab308">${b2}</div><div style="height:${100*b3/mb}%;background:#92400e">${b3}</div></div><div class="cat">&le;50% &nbsp; 50&ndash;100% &nbsp; &gt;100%</div>`);

// kurva manfaat kandidat (dihitung tertunda agar tidak berat saat kapasitas diketik; dibatalkan jika pengguna sudah memilih titik)
setCard(3,'Kurva manfaat kandidat','<div class="cat">Menghitung...</div>');
clearTimeout(kurvaTimer);
kurvaTimer=setTimeout(()=>{
if(pilihan) return;
let nilai=[beban.kelebihan];
try{cariKandidat(20).daftar.forEach(d=>nilai.push(d.sisaKelebihan));}catch(e){console.error(e);}
const mx=Math.max(1,nilai[0]),W=120,H=80;
const pts=nilai.map((v,i)=>`${6+(W-12)*i/Math.max(1,nilai.length-1)},${8+(H-16)*(1-v/mx)}`).join(' ');
const idx=(k)=>nilai[Math.min(k,nilai.length-1)];
setCard(3,'Kurva manfaat kandidat',`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:96px"><polyline fill="none" stroke="#6366f1" stroke-width="2.5" points="${pts}"/></svg><div class="cat">${fmt(nilai[0])} &rarr; ${fmt(idx(5))} (5 lokasi) &rarr; ${fmt(idx(10))} (10) &rarr; ${fmt(nilai[nilai.length-1])} (${nilai.length-1})</div>`);
},60);

// kualitas data (ringkas)
const semua=sppgSemuaData,dipakai=semua.filter(f=>f.properties.dipakai_analisis);
const jalan=dipakai.filter(f=>f.properties.geo_akurasi==='jalan').length;
const asli=sekolahData.filter(s=>s.properties.sumber_siswa==='bps'||s.properties.siswa).length;
setCard(4,'Kualitas data',barisInfo('SPPG dipakai / tercatat',`${dipakai.length} / ${semua.length}`)+barisInfo('Koordinat SPPG: jalan / kelurahan',`${jalan} / ${dipakai.length-jalan}`)+barisInfo('Titik SPPG unik',grup.length)+barisInfo('Siswa dari data asli/BPS',Math.round(100*asli/Math.max(1,sekolahData.length))+'%'));
}

// ================= pembuatan tampilan SPPG terpilih: porsi, utilisasi, sekolah dilayani per jenjang, dan catatan SPPG =================
function renderDashSppg(f){
const {grup,kap,beban}=analisisDasar;
const i=idxGrupFitur(f),g=grup[i],p=f.properties;
const muatan=beban.muatan[i],kapT=g.n*kap,u=muatan/kapT;
const r=sekolahDilayani(f),per=perJenjang(r.idx);
const utils=grup.map((x,k)=>beban.muatan[k]/(x.n*kap));
const peringkat=utils.filter(v=>v>u).length+1;
const ada=JENJANG.filter(j=>per[j.k]);
const maxN=Math.max(1,...ada.map(j=>per[j.k].n)),maxS=Math.max(1,...ada.map(j=>per[j.k].siswa));
const sisa=kapT-muatan;
const rata=Math.round(100*beban.muatan.reduce((a,b)=>a+b,0)/grup.reduce((a,x)=>a+x.n*kap,0));
setKpi(1,'Jumlah porsi / hari',fmt(muatan),`kapasitas ${fmt(kapT)}`,'');
setKpi(2,'Utilisasi SPPG',Math.round(u*100)+'%',`peringkat ${peringkat} dari ${grup.length}`,u>1?'bad':'ok');
setKpi(3,'Sekolah dilayani',r.idx.length,`${ada.length} jenjang`,'');
setKpi(4,sisa>=0?'Sisa kapasitas':'Kelebihan beban',fmt(Math.abs(sisa)),'penerima per hari',sisa>=0?'ok':'bad');
setCard(1,'Sekolah dilayani per jenjang',ada.map(j=>barisBar(j.k,per[j.k].n,maxN,per[j.k].n,j.warna)).join('')||'<div class="cat">Tidak ada sekolah yang dilayani.</div>');
setCard(2,'Porsi (siswa) per jenjang',ada.map(j=>barisBar(j.k,per[j.k].siswa,maxS,fmt(per[j.k].siswa),j.warna)).join('')||'<div class="cat">-</div>');
setCard(3,'Beban vs kapasitas',barisBar('Beban',muatan,Math.max(kapT,muatan),fmt(muatan),warnaUtil(u),kapT)+barisInfo('Kapasitas',fmt(kapT))+barisInfo('Rata-rata kota',rata+'%')+'<div class="cat">Garis putus = kapasitas.</div>');
setCard(4,'Catatan SPPG',barisInfo('Nama',esc(namaPendek(p['Nama SPPG'])))
+barisInfo('Kelurahan / Kec.',`${esc(p['Desa/Kelurahan SPPG'])} / ${esc(p['Kecamatan SPPG'])}`)
+(p.alamat?`<div class="cat" style="margin:2px 0">${esc(p.alamat)}</div>`:'')
+barisInfo('Koordinat',p.geo_akurasi==='jalan'?'titik jalan (alamat)':'titik kelurahan (perkiraan)')
+(g.n>1?barisInfo('SPPG di titik ini',g.n):'')
+(p.dekat==1?`<div style="color:#dc2626;margin-top:4px">&#9888; ${esc(p.alasan)}</div>`:''));
}

// ================= pembuatan tampilan sekolah terpilih: siswa, SPPG yang melayani, SPPG terdekat, dan status jangkauan 10 menit =================
function renderDashSekolah(idx){
const {grup,kap,beban}=analisisDasar;
const s=sekolahData[idx],p=s.properties,xy=s.geometry.coordinates.slice(0,2);
const siswa=getSiswa(s);
const dk=beban.dekat[idx],gi=dk.idx,g=grup[gi];
const muatan=beban.muatan[gi],kapT=g.n*kap,u=muatan/kapT;
const jenjang=JENJANG.find(j=>j.k===p.jenjang);
const terdekat=grup.map((x,k)=>({k,d:jarakM(xy,x.xy)})).sort((a,b)=>a.d-b.d).slice(0,5);
let dijangkau=0;
try{if(isoSppg){const pt=turf.point(xy);dijangkau=isoSppg.features.filter(ft=>turf.booleanPointInPolygon(pt,ft)).length;}}catch{}
const luar=sekolahTdkTercakup.has(idx);
setKpi(1,'Jumlah siswa',fmt(siswa),'BPS kecamatan, dibagi rata','');
setKpi(2,'Jenjang',esc(p.jenjang),esc(p.STATUS||p.status||'&nbsp;'),'');
setKpi(3,'Dilayani oleh',esc(namaPendek(g.nama[0])),`utilisasi ${Math.round(u*100)}%`,u>1?'bad':'ok');
setKpi(4,'Jarak ke SPPG',(dk.d/1000).toFixed(1)+' km','garis lurus','');
setCard(1,'Identitas sekolah',barisInfo('Nama',esc(p.NAMA||'-'))+barisInfo('Jenjang',esc(p.jenjang))+barisInfo('Kecamatan',esc(p.KECAMATAN||'-'))+barisInfo('Kelurahan',esc(p.DESA||'-'))+(p.ALAMAT?`<div class="cat" style="margin:2px 0">${esc(p.ALAMAT)}</div>`:'')+barisInfo('Siswa (BPS, dibagi rata)',fmt(siswa)));
setCard(2,'SPPG yang melayani',barisInfo('SPPG',esc(namaPendek(g.nama[0])))+barisBar('Beban',muatan,Math.max(kapT,muatan),fmt(muatan),warnaUtil(u),kapT)+barisInfo('Kapasitas',fmt(kapT))+(g.n>1?barisInfo('SPPG di titik ini',g.n):''));
const dMaks=terdekat[terdekat.length-1].d;
setCard(3,'SPPG terdekat (garis lurus)',terdekat.map(t=>barisBar(namaPendek(grup[t.k].nama[0]),Math.max(0.08,1-t.d/Math.max(1,dMaks)*0.9),1,(t.d/1000).toFixed(1)+' km',jenjang?jenjang.warna:'#6366f1',null)).join(''));
setCard(4,'Jangkauan 10 menit',barisInfo('Dijangkau SPPG',dijangkau+' SPPG')+(luar?'<div style="color:#b45309;margin-top:4px">&#9888; Di luar isochrone 10 menit dari semua SPPG.</div>':'<div class="cat" style="margin-top:4px">Berada di dalam isochrone 10 menit.</div>'));
}

// ================= pembuatan rincian kualitas data dan metode di tab Data (selalu diperbarui) =================
function renderDataKualitas(){
const {grup,kap,tot}=analisisDasar;
const el=document.getElementById('dataKualitas');
if(!el) return;
const semua=sppgSemuaData,dipakai=semua.filter(f=>f.properties.dipakai_analisis);
const jalan=dipakai.filter(f=>f.properties.geo_akurasi==='jalan').length;
const asli=sekolahData.filter(s=>s.properties.sumber_siswa==='bps'||s.properties.siswa).length;
const per=tot?Object.keys(tot).map(j=>`${j} ${tot[j].n}`).join(' / '):'-';
el.innerHTML=barisInfo('SPPG tercatat / dipakai analisis',`${semua.length} / ${dipakai.length}`)
+barisInfo('Koordinat SPPG dari alamat jalan',jalan)
+barisInfo('Koordinat SPPG titik kelurahan',dipakai.length-jalan)
+barisInfo('Titik SPPG unik (kembar digabung)',grup.length)
+barisInfo('Sekolah di peta',`${sekolahData.length}`)
+`<div class="cat">${per}</div>`
+barisInfo('Sekolah dengan jumlah siswa asli/BPS',`${asli} dari ${sekolahData.length}`)
+`<p class="text-xs text-slate-500 mt-2">Metode: tiap sekolah dialokasikan ke titik SPPG terdekat; beban = jumlah siswa dibanding kapasitas (${fmt(kap)} per SPPG). Cakupan 10 menit = gabungan isochrone berkendara semua SPPG (OpenRouteService). SPPG yang dikeluarkan: koordinat tidak ditemukan atau terlalu jauh dari kota.</p>`;
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
// ================= memperbaiki klik peta kosong yang hanya menghapus area layanan menjadi juga mengembalikan dashboard ke ringkasan kota agar pengguna bisa kembali tanpa tombol =================
map.on('click',(e)=>{
const ids=[...JENJANG.map(j=>j.id),'sppg','candidate'].map(id=>id+'-layer').filter(id=>map.getLayer(id));
if(map.queryRenderedFeatures(e.point,{layers:ids}).length>0) return;
hapusLayanan();
if(pilihan){pilihan=null;renderDashboard();}
});
// tombol "Kembali ke ringkasan kota" pada kartu KPI
const tombolKota=document.getElementById('btnKota');
if(tombolKota) tombolKota.addEventListener('click',()=>{pilihan=null;hapusLayanan();renderDashboard();});

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
properties:{weight:Math.min(1,getSiswa(s)/SISWA_REF)}
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
// ================= memperbaiki daftar layer tetap (sd, smp, sma) pada clear() menjadi semua jenjang di JENJANG agar layer MI, MTs, SMK, MA juga dibersihkan saat ganti basemap =================
[...JENJANG.map(j=>j.id),'sppg','iso','candidate','heatmap','cover','beban'].forEach(safeRemove);
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