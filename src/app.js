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
style:styles.dark,
center:[110.42,-6.99],
zoom:12
});

// ================= JENJANG =================
// ================= pembuatan daftar jenjang (SD, MI, SMP, MTs, SMA, SMK, MA) dengan id layer dan warna, agar semua bagian kode (layer, popup, dashboard) memakai satu sumber dan mudah ditambah jenjang baru =================
// ================= memperbaiki tujuh warna jenjang yang saling mirip (SD-MI, SMP-MTs, SMA-MA) dan bertabrakan dengan isochrone hijau menjadi tiga warna per tingkat (SD/MI biru, SMP/MTs kuning, SMA/SMK/MA ungu) dengan pinggiran putih sebagai penanda madrasah (Template A) =================
const JENJANG=[
{k:'SD',id:'sd',warna:'#3b82f6'},
{k:'MI',id:'mi',warna:'#3b82f6',madrasah:true},
{k:'SMP',id:'smp',warna:'#f59e0b'},
{k:'MTs',id:'mts',warna:'#f59e0b',madrasah:true},
{k:'SMA',id:'sma',warna:'#a78bfa'},
{k:'SMK',id:'smk',warna:'#a78bfa'},
{k:'MA',id:'ma',warna:'#a78bfa',madrasah:true}
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
if(fc.features.length) addLayer(j.id,fc,j.warna,{radius:RADIUS_SEKOLAH,opacity:OPASITAS_SEKOLAH,strokeColor:j.madrasah?'#ffffff':'#0b1426',strokeWidth:j.madrasah?1.8:0.6});
});
// ================= memperbaiki warna SPPG putih/merah menjadi titik hitam (permintaan pengguna) dengan pinggiran putih agar terlihat di basemap gelap; SPPG berdekatan ditandai lewat pinggiran merah =================
addLayer('sppg',sppg,'#000000',{radius:['interpolate',['linear'],['zoom'],10,4.5,15,8],strokeColor:'#ffffff',strokeWidth:['case',['==',['get','dekat'],1],2.6,0.9]});

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
function addLayer(id,data,color,opt={}){
map.addSource(id,{type:'geojson',data});
map.addLayer({
id:id+'-layer',
type:'circle',
source:id,
paint:{'circle-color':color,'circle-radius':opt.radius||5,'circle-opacity':opt.opacity!=null?opt.opacity:1,'circle-stroke-color':opt.strokeColor||'#0b1426','circle-stroke-width':opt.strokeWidth!=null?opt.strokeWidth:0}
});
}
// ================= memperbaiki ukuran titik sekolah yang seragam (radius 5, tumpang tindih di pusat kota) menjadi mengikuti zoom dan jumlah siswa (sekolah besar lebih besar), dengan sedikit transparansi agar tumpukan titik tetap terbaca =================
const OPASITAS_SEKOLAH=0.88;
const SISWA_PAKSA=['to-number',['get','siswa'],200];
const RADIUS_SEKOLAH=['interpolate',['linear'],['zoom'],10,['interpolate',['linear'],SISWA_PAKSA,0,2.2,800,4.2],15,['interpolate',['linear'],SISWA_PAKSA,0,4.5,800,9]];

// ================= POPUP =================
let popupBound=false;

// ================= memperbaiki popup yang panjang (nama, jenjang, alasan, beban, daftar nama sekolah) menjadi sederhana: sekolah = nama dan jumlah siswa; SPPG = jumlah porsi dan jumlah sekolah per jenjang (daftar menurun, tanpa nama sekolah) agar sesuai permintaan; alasan SPPG berdekatan dipindah ke dashboard =================
function popupSekolah(f){
const s=sekolahData[Number(f.properties.sidx)]||{properties:f.properties};
const st=statusSekolah(Number(f.properties.sidx));
const cat=st===2?'<br><span style="color:#ef4444">&#9888; Tidak tertampung kapasitas SPPG mana pun dalam 30 menit</span>':(st===1?`<br><span style="color:#ef4444">&#9888; Di luar isochrone ${waktuIso/60} menit dari semua SPPG</span>`:'');
return `<b>${esc(s.properties.NAMA||s.properties.nama||'Tanpa nama')}</b><br>Jumlah siswa: ${fmt(getSiswa(s))}${cat}`;
}
function popupSppg(f){
const nama=f.properties['Nama SPPG']||'Tanpa nama';
const i=idxGrupFitur(f),r=sekolahDilayani(f);
if(i<0||!r) return `<b>${esc(nama)}</b>`;
const g=analisisDasar.grup[i],muatan=analisisDasar.beban.muatan[i],per=perJenjang(r.idx);
const baris=JENJANG.filter(j=>per[j.k]).map(j=>`<li>${j.k}: ${per[j.k].n}</li>`).join('');
// ================= memperbaiki label "Jumlah porsi" (sebenarnya siswa area terdekat, 1 siswa = 1 porsi) menjadi "Siswa dialokasikan" per SPPG; titik berisi beberapa SPPG menampilkan angka per SPPG (dibagi n), bukan angka gabungan =================
return `<b>${esc(nama)}</b><br>Siswa dialokasikan: <b>${fmt(muatan/g.n)}</b> / hari <span style="color:#94a3b8">(kapasitas ${fmt(analisisDasar.kap)})</span>`
+(g.n>1?` <i>(titik berisi ${g.n} SPPG, total ${fmt(muatan)})</i>`:'')
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
// ================= memperbaiki isochrone satu waktu (600 detik, isochrone-sppg-600.geojson) menjadi multi-waktu (60 sampai 600 detik, isochrone-multi.geojson) agar pengguna bisa memilih waktu tempuh <= 600 detik lewat slider tanpa memanggil API =================
let isoSppg=null;      // FeatureCollection: poligon per titik SPPG per waktu (properti titik "lng,lat" dan waktu_detik)
let waktuIso=600;      // waktu tempuh (detik) yang dipilih pengguna; maksimum 600
async function muatIsochrone(){
if(isoSppg) return isoSppg;
const res=await fetch('./data/isochrone-multi.geojson',{cache:'no-cache'});
if(!res.ok) throw new Error('data/isochrone-multi.geojson tidak ditemukan (jalankan scripts/fetch-isochrones-multi.mjs)');
isoSppg=await res.json();
return isoSppg;
}

// ================= memperbaiki getIso yang memanggil API MapID tiap klik (satu SPPG, butuh key berbayar) menjadi mencari isochrone SPPG terpilih di data statis agar tidak butuh API/key dan hasilnya sama untuk semua pengguna =================
async function getIso(point){
const data=await muatIsochrone();
// ================= memperbaiki pencarian isochrone lewat sppg_no (satu waktu) menjadi lewat titik SPPG dan waktu yang dipilih (waktuIso) =================
const i=idxGrupFitur(point);
if(i<0) throw new Error('Isochrone untuk SPPG ini tidak ada (SPPG tidak dipakai dalam analisis).');
const kunci=analisisDasar.grup[i].xy.join(',');
const iso=data.features.find(f=>f.properties.titik===kunci&&f.properties.waktu_detik===waktuIso);
if(!iso) throw new Error('Isochrone untuk SPPG ini pada waktu terpilih tidak ada.');
return iso;
}

// ================= pembuatan cakupan gabungan (union) seluruh isochrone SPPG agar analisis memakai area yang benar-benar terlayani oleh semua SPPG, bukan satu SPPG =================
// ================= memperbaiki gabungIsochrone satu waktu menjadi per waktu terpilih dengan penyimpanan sementara (cache) per waktu agar slider cepat setelah pemakaian pertama =================
const cakupanCache=new Map();
async function gabungIsochrone(waktu=waktuIso){
if(cakupanCache.has(waktu)) return cakupanCache.get(waktu);
const data=await muatIsochrone();
const poli=data.features.filter(f=>f.properties.waktu_detik===waktu);   // satu poligon per titik SPPG unik
if(!poli.length) throw new Error(`Tidak ada isochrone untuk waktu ${waktu} detik.`);
const gab=poli.length===1?poli[0]:turf.union(turf.featureCollection(poli));
cakupanCache.set(waktu,gab);
return gab;
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

// ================= OPSI D: DIJANGKAU vs DILAYANI + TUMPANG TINDIH =================
// ================= pembuatan penghitungan jumlah SPPG yang menjangkau tiap sekolah pada waktu tertentu (cache per waktu) agar tumpang tindih jangkauan bisa diukur =================
const jangkauCache=new Map();
async function jumlahPenjangkau(waktu){
if(jangkauCache.has(waktu)) return jangkauCache.get(waktu);
const data=await muatIsochrone();
const cnt=new Uint16Array(sekolahData.length);
const titikSek=sekolahData.map(s=>turf.point(s.geometry.coordinates.slice(0,2)));
data.features.filter(f=>f.properties.waktu_detik===waktu).forEach(ft=>{
const b=turf.bbox(ft);
sekolahData.forEach((s,i)=>{
const [x,y]=s.geometry.coordinates;
if(x<b[0]||x>b[2]||y<b[1]||y>b[3]) return;
try{if(turf.booleanPointInPolygon(titikSek[i],ft)) cnt[i]++;}catch{}
});
});
jangkauCache.set(waktu,cnt);
return cnt;
}
// indeks sekolah yang berada di dalam satu poligon isochrone
function sekolahDalam(poligon){
const b=turf.bbox(poligon),idx=[];
sekolahData.forEach((s,i)=>{
const [x,y]=s.geometry.coordinates;
if(x<b[0]||x>b[2]||y<b[1]||y>b[3]) return;
try{if(turf.booleanPointInPolygon(turf.point([x,y]),poligon)) idx.push(i);}catch{}
});
return idx;
}
const jumlahSiswa=(idx)=>idx.reduce((a,i)=>a+getSiswa(sekolahData[i]),0);

// ================= memperbaiki hasil Run yang hanya menyebut "terlayani" (padahal itu jangkauan yang tumpang tindih antar SPPG) menjadi tiga angka terpisah untuk SPPG terpilih: dijangkau (tidak eksklusif), dilayani (eksklusif, alokasi waktu tempuh), dan tumpang tindih =================
async function ringkasanD(f,iso){
const wadah=document.getElementById('hasilD');
if(!wadah) return;
const menit=waktuIso/60;
const cnt=await jumlahPenjangkau(waktuIso);
const dijangkau=sekolahDalam(iso);
const r=sekolahDilayani(f);
const dilayani=r?r.idx:[];
const himpDij=new Set(dijangkau);
const tumpang=dijangkau.filter(i=>cnt[i]>1);
const rata=dijangkau.length?dijangkau.reduce((a,i)=>a+cnt[i],0)/dijangkau.length:0;
const luar=dilayani.filter(i=>!himpDij.has(i));
const g=r?analisisDasar.grup[r.i]:null;
wadah.innerHTML=`<p class="text-sm"><b>Dijangkau</b> dalam ${menit} menit: <b>${dijangkau.length}</b> sekolah &middot; ${fmt(jumlahSiswa(dijangkau))} siswa<br><span class="text-xs text-slate-500">Tidak eksklusif: sekolah yang sama juga dijangkau SPPG lain, jadi jangan dijumlahkan antar SPPG.</span></p>`
+`<p class="text-sm"><b>Dilayani</b> (alokasi waktu tempuh, eksklusif): <b>${dilayani.length}</b> sekolah &middot; ${fmt(jumlahSiswa(dilayani))} siswa${luar.length?`<br><span class="text-xs" style="color:#fb923c">${luar.length} di antaranya di luar isochrone ${menit} menit.</span>`:''}${g&&g.n>1?`<br><span class="text-xs text-slate-500">Titik ini berisi ${g.n} SPPG; daftar dilayani dibagi di antara mereka.</span>`:''}</p>`
+`<p class="text-sm"><b>Tumpang tindih</b>: ${dijangkau.length?Math.round(100*tumpang.length/dijangkau.length):0}% (${tumpang.length} sekolah) juga dijangkau SPPG lain; rata-rata ${rata.toFixed(1)} titik SPPG menjangkau tiap sekolah di area ini.</p>`;
}
// ringkasan untuk Run Global (gabungan semua SPPG): berapa sekolah dijangkau dan seberapa tumpang tindih
async function ringkasanGlobal(){
const wadah=document.getElementById('hasilD');
if(!wadah) return;
const menit=waktuIso/60;
const cnt=await jumlahPenjangkau(waktuIso);
const ada=[];cnt.forEach((v,i)=>{if(v>0) ada.push(i);});
const rata=ada.length?ada.reduce((a,i)=>a+cnt[i],0)/ada.length:0;
const banyak=ada.filter(i=>cnt[i]>1).length;
wadah.innerHTML=`<p class="text-sm"><b>Dijangkau</b> oleh minimal satu SPPG dalam ${menit} menit: <b>${ada.length}</b> dari ${sekolahData.length} sekolah &middot; ${fmt(jumlahSiswa(ada))} siswa (tiap sekolah dihitung sekali).</p>`
+`<p class="text-sm"><b>Tumpang tindih</b>: ${Math.round(100*banyak/Math.max(1,ada.length))}% sekolah dijangkau lebih dari satu titik SPPG; rata-rata ${rata.toFixed(1)} titik per sekolah.</p>`;
}

// ================= CHART =================
// ================= memperbaiki drawChart yang tetap tiga label (SD, SMP, SMA) menjadi menerima label, jumlah sekolah, jumlah siswa, dan warna per jenjang agar semua jenjang tergambar =================
function drawChart(label,jumlah,siswa,warna){
// ================= pembuatan warna bawaan Chart.js untuk Tema 3 (Malam Analitik): teks abu terang dan garis kisi gelap agar terbaca di panel gelap =================
Chart.defaults.color='#94a3b8';
Chart.defaults.borderColor='#1f2d4d';

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
// ================= memperbaiki alokasi ke SPPG terdekat berdasarkan jarak garis lurus menjadi berdasarkan WAKTU TEMPUH berkendara (matriks ORS data/waktu-tempuh.json) agar sekolah dilayani SPPG yang benar-benar tercepat; jarak garis lurus hanya cadangan untuk pasangan yang tidak ada di matriks =================
let matriksWaktu=null;   // {titik:["lng,lat"], npsn:[...], detik:[[...]]}
let matriksKandidat=null;   // {kandidat:[npsn sekolah acuan], titik:["lng,lat"], npsn:[...sekolah], detik:[[...]]}: waktu tempuh 150 calon lokasi SPPG baru ke semua sekolah
function indeksWaktu(grup){
if(!matriksWaktu) return null;
const baris=grup.map(g=>matriksWaktu.titik.indexOf(g.xy.join(',')));
const kolom=new Map(matriksWaktu.npsn.map((n,j)=>[String(n),j]));
return {baris,kolom};
}
// waktu tempuh (detik) dari titik SPPG gi ke sekolah si; null jika tidak ada di matriks
function waktuDetik(iw,gi,si){
if(!iw) return null;
const r=iw.baris[gi];
if(r==null||r<0) return null;
const c=iw.kolom.get(String(sekolahData[si].properties.NPSN));
if(c==null) return null;
const v=matriksWaktu.detik[r][c];
return v==null?null:v;
}
// ================= memperbaiki alokasi pemenang tunggal (tiap sekolah ke SPPG tercepat tanpa batas kapasitas, sehingga satu SPPG bisa 8.640 siswa dan tetangganya 389 atau 0) menjadi alokasi berkapasitas: sekolah dilayani SPPG tercepat yang masih punya sisa kapasitas dan berjarak <= 30 menit; sekolah yang tidak muat di SPPG mana pun dicatat tertampung=false dan dihitung ke SPPG tercepat sebagai kelebihan; tanpa matriks waktu tetap memakai SPPG terdekat (cadangan) =================
function hitungBeban(grup,kap,iw){
const muatan=grup.map(()=>0);
const ak=iw?alokasiBerkapasitas(grup,kap,iw,1800):null;
const dekat=sekolahData.map((s,si)=>{
const xy=s.geometry.coordinates;
const tj=ak&&ak.tujuan[si];
if(tj){muatan[tj.i]+=getSiswa(s);return {idx:tj.i,d:jarakM(xy,grup[tj.i].xy),t:tj.t,tertampung:true};}
let b=-1,bt=null;
if(iw){grup.forEach((g,i)=>{const t=waktuDetik(iw,i,si);if(t!=null&&(bt==null||t<bt)){bt=t;b=i;}});}
if(b<0){let bd=Infinity;grup.forEach((g,i)=>{const d=jarakM(xy,g.xy);if(d<bd){bd=d;b=i;}});}   // cadangan: jarak garis lurus
muatan[b]+=getSiswa(s);
return {idx:b,d:jarakM(xy,grup[b].xy),t:bt,tertampung:!ak};
});
const kelebihan=grup.reduce((a,g,i)=>a+Math.max(0,muatan[i]-g.n*kap),0);
return {muatan,dekat,kelebihan,ak};
}

// ================= pembuatan alokasi berkapasitas: sekolah diurut dari yang paling sedikit pilihannya (regret), lalu dilayani SPPG tercepat yang masih punya sisa kapasitas dan berjarak <= batas waktu BGN (30 menit); sisanya dicatat tidak tertampung, dan yang melewati 10 menit dicatat "di luar isochrone 10 menit" =================
function alokasiBerkapasitas(grup,kap,iw,batas){
if(!iw) return null;
const sisa=grup.map(g=>g.n*kap);
// ================= memperbaiki urutan alokasi "sekolah dengan pilihan paling sedikit dulu" menjadi "pasangan SPPG-sekolah dari waktu tempuh terpendek dulu" sesuai aturan pengguna: tiap SPPG mengutamakan sekolah terdekatnya sampai kuota penuh (aturan resmi maks 3.000/hari, waktu tempuh <= 30 menit), lalu sekolah yang belum terlayani diambil SPPG terdekat berikutnya yang masih punya kuota (boleh jauh, tetap <= 30 menit); satu sekolah tidak dipecah antar SPPG =================
const pasangan=[];
sekolahData.forEach((s,si)=>{grup.forEach((g,i)=>{const t=waktuDetik(iw,i,si);if(t!=null&&t<=batas) pasangan.push({i,si,t});});});
pasangan.sort((a,b)=>a.t-b.t);
let tertampung=0,tidak=0,luar10=0,jumlahWaktu=0;
const tidakSek=[];
const tujuan=new Array(sekolahData.length).fill(null);   // tujuan[si] = {i: titik SPPG, t: detik} atau null bila tidak tertampung
pasangan.forEach(p=>{
if(tujuan[p.si]) return;
const siswa=getSiswa(sekolahData[p.si]);
if(sisa[p.i]<siswa) return;
sisa[p.i]-=siswa;tertampung+=siswa;jumlahWaktu+=p.t*siswa;if(p.t>600) luar10+=siswa;tujuan[p.si]={i:p.i,t:p.t};
});
sekolahData.forEach((s,si)=>{if(!tujuan[si]){tidak+=getSiswa(s);tidakSek.push(si);}});
return {tertampung,tidak,luar10,rataDetik:tertampung?jumlahWaktu/tertampung:0,tidakSek,batas,tujuan};
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
// ================= memperbaiki hitungBeban tanpa waktu tempuh menjadi memuat matriks waktu tempuh sekali lalu memakainya untuk alokasi, ditambah alokasi berkapasitas dengan batas 30 menit (kriteria BGN) =================
if(!matriksWaktu){try{const r=await fetch('./data/waktu-tempuh.json',{cache:'no-cache'});if(r.ok) matriksWaktu=await r.json();}catch{}}
if(!matriksKandidat){try{const r=await fetch('./data/waktu-kandidat.json',{cache:'no-cache'});if(r.ok) matriksKandidat=await r.json();}catch{}}   // bila tidak ada, kandidat memakai cadangan jarak garis lurus
const iw=indeksWaktu(grup);
const beban=hitungBeban(grup,kap,iw);
const kapasitasAlok=beban.ak;   // hasil alokasi berkapasitas yang sama dengan yang dipakai hitungBeban (null bila tanpa matriks waktu)
let cak=null;
try{cak=await hitungCakupan();}catch(e){console.error(e);}
analisisDasar={grup,kap,beban,tot:cak?cak.tot:null,iw,kapasitasAlok};
gambarCakupan(cak?cak.gab:null);
gambarBeban();
gambarStatusSekolah();
perbaruiKpi();
kandidatOtomatis();   // usulan lokasi baru langsung ditampilkan tanpa perlu membuka tab Usulan
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
'circle-color':'#f97316',
'circle-opacity':0.35,
'circle-radius':['interpolate',['linear'],['get','util'],1,12,2.5,28],
'circle-stroke-color':'#f97316',
'circle-stroke-width':1.5
}
},map.getLayer('sppg-layer')?'sppg-layer':undefined);
}

// ================= pembuatan penanda sekolah bermasalah jangkauan: cincin merah tebal untuk sekolah di luar gabungan isochrone (waktu tempuh slider, 10 menit) = status 1, dan cincin lebih besar untuk sekolah yang tidak tertampung kapasitas SPPG mana pun dalam 30 menit = status 2; dipakai sebagai bahan menimbang lokasi SPPG baru =================
function statusSekolah(si){
if(!analisisDasar) return 0;
if(analisisDasar.beban.dekat[si].tertampung===false) return 2;
return sekolahTdkTercakup.has(si)?1:0;
}
function gambarStatusSekolah(){
safeRemove('status');
if(!analisisDasar) return;
const fitur=[];
sekolahData.forEach((s,si)=>{
const st=statusSekolah(si);
if(!st) return;
const j=JENJANG.find(x=>x.k===s.properties.jenjang);
fitur.push({type:'Feature',geometry:s.geometry,properties:{status:st,warna:j?j.warna:'#94a3b8',sidx:si}});
});
map.addSource('status',{type:'geojson',data:{type:'FeatureCollection',features:fitur}});
map.addLayer({
id:'status-layer',
type:'circle',
source:'status',
paint:{
'circle-color':['get','warna'],
'circle-radius':['interpolate',['linear'],['zoom'],10,['match',['get','status'],2,6,5],15,['match',['get','status'],2,10,8]],
'circle-stroke-color':'#ef4444',
'circle-stroke-width':['match',['get','status'],2,4,3]
}
},map.getLayer('sppg-layer')?'sppg-layer':undefined);
const el=document.getElementById('jumlahJauh');
if(el) el.innerText=`${fitur.filter(f=>f.properties.status===1).length} di luar ${waktuIso/60} menit, ${fitur.filter(f=>f.properties.status===2).length} tidak tertampung`;
}
// tombol "hanya sekolah jauh / tidak tertampung": menyembunyikan titik sekolah biasa agar hanya yang bercincin merah terlihat
// (memakai transparansi, bukan visibility none, agar titik tetap bisa diklik untuk popup)
let hanyaJauhAktif=false;
window.hanyaSekolahJauh=()=>{
hanyaJauhAktif=!hanyaJauhAktif;
JENJANG.map(j=>j.id+'-layer').filter(id=>map.getLayer(id)).forEach(id=>{
map.setPaintProperty(id,'circle-opacity',hanyaJauhAktif?0.06:OPASITAS_SEKOLAH);
map.setPaintProperty(id,'circle-stroke-opacity',hanyaJauhAktif?0:1);
});
};

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
// ================= pembuatan baris KPI alokasi berkapasitas (waktu tempuh, batas 30 menit): siswa tertampung, tidak tertampung, di luar 10 menit, dan rata-rata waktu tempuh =================
const ak=analisisDasar.kapasitasAlok;
if(ak){
set('kpiTertampung',`${fmt(ak.tertampung)} siswa (${Math.round(100*ak.tertampung/(ak.tertampung+ak.tidak))}%)`);
set('kpiTidakTertampung',`${fmt(ak.tidak)} siswa`);
set('kpiLuar10',`${fmt(ak.luar10)} siswa`);
set('kpiRataWaktu',`${(ak.rataDetik/60).toFixed(1)} menit`);
}
// ================= memperbaiki perbaruiKpi yang hanya mengisi panel Param menjadi juga memperbarui dashboard (KPI melayang + dock grafik) agar tampilan utama selalu sinkron =================
renderDashboard();
}

// ================= pembuatan pendengar input kapasitas agar KPI dan halo beban langsung diperbarui =================
const inputKapasitas=document.getElementById('kapasitas');
// ================= pembuatan penerapan ulang cakupan saat waktu tempuh diubah: hitung ulang cakupan gabungan pada waktu terpilih, gambar ulang layer cakupan, dan perbarui KPI/dashboard (alokasi dan beban tidak dihitung ulang) =================
async function terapkanCakupan(){
if(!analisisDasar) return;
try{
const cak=await hitungCakupan();
analisisDasar.tot=cak.tot;
gambarCakupan(cak.gab);
gambarStatusSekolah();
perbaruiKpi();
kandidatOtomatis();
}catch(e){console.error(e);}
}
// ================= pembuatan slider waktu tempuh isochrone (1 sampai 10 menit, maksimum 600 detik) =================
const sliderWaktu=document.getElementById('waktuMenit');
if(sliderWaktu) sliderWaktu.addEventListener('input',()=>{
const m=Number(sliderWaktu.value);
waktuIso=m*60;
const lab=document.getElementById('waktuLabel');
if(lab) lab.innerText=`${m} menit (${waktuIso} detik)`;
terapkanCakupan();
});
// ================= pembuatan tombol skenario kapasitas (2.000 / 2.500 / 3.000) yang mengisi kotak kapasitas dan memicu perhitungan ulang =================
window.setKapasitas=(v)=>{const el=document.getElementById('kapasitas');if(el){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}};
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
function setKpi(n,label,nilai,sub,kelas,tip){
const L=document.getElementById('kL'+n),V=document.getElementById('kV'+n),S=document.getElementById('kS'+n);
if(V&&V.parentElement) V.parentElement.title=tip||'';   // penjelasan singkat saat kursor di atas kartu
if(L) L.innerHTML=label;
if(V){V.innerHTML=nilai;V.className=kelas||'';}
if(S) S.innerHTML=sub||'&nbsp;';
}
function setCard(n,judul,html){
const J=document.getElementById('dJ'+n),C=document.getElementById('dC'+n);
if(J) J.innerHTML=judul;
if(C) C.innerHTML=html;
}
const warnaUtil=(u)=>u>1?'#fb923c':(u>0.7?'#fbbf24':'#4ade80');
function barisBar(nama,nilai,maks,teks,warna,garis){
const lebar=Math.max(1,Math.min(100,100*nilai/Math.max(1,maks)));
return `<div class="row"><span class="n" title="${esc(nama)}">${esc(nama)}</span><div class="trk"><i style="width:${lebar}%;background:${warna}"></i>${garis!=null?`<u style="left:${Math.min(100,100*garis/Math.max(1,maks))}%"></u>`:''}</div><b>${teks}</b></div>`;
}
function barisInfo(k,v){
return `<div class="row" style="justify-content:space-between;gap:10px"><span style="width:auto;color:var(--teks2)">${k}</span><b style="text-align:right">${v}</b></div>`;
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
setKpi(1,`Terjangkau ${waktuIso/60} menit`,(100*sok/s).toFixed(1)+'%',`${ok} dari ${n} sekolah`,'ok',`Persentase siswa yang sekolahnya berada dalam ${waktuIso/60} menit berkendara dari minimal satu SPPG`);
}
setKpi(2,'Kapasitas terpakai',Math.round(100*minta/kapT)+'%',`${fmt(minta)} / ${fmt(kapT)}`,'','Total siswa yang dialokasikan dibanding kapasitas seluruh SPPG (3.000 per SPPG per hari)');
// ================= memperbaiki KPI "SPPG > kapasitas" (selalu 0 pada alokasi berkapasitas) dan kartu campuran "tidak tertampung + sekolah jauh" menjadi dua kartu terpisah: sekolah di luar area 10 menit (dengan jumlah siswa) dan siswa tidak tertampung =================
const idxJauh=sekolahData.map((s,si)=>si).filter(si=>statusSekolah(si)===1);
const nJauh=idxJauh.length,sJauh=idxJauh.reduce((a,si)=>a+getSiswa(sekolahData[si]),0);
setKpi(3,`Di luar ${waktuIso/60} menit`,fmt(nJauh),`sekolah &middot; ${fmt(sJauh)} siswa`,nJauh>0?'bad':'ok',`Sekolah yang tidak berada dalam ${waktuIso/60} menit berkendara dari SPPG mana pun (bercincin merah di peta)`);
setKpi(4,'Tidak tertampung',fmt(beban.kelebihan),'siswa tanpa kuota SPPG',beban.kelebihan>0?'bad':'ok','Siswa yang tidak muat di kuota SPPG mana pun dalam batas 30 menit');

// ================= memperbaiki kartu "SPPG terpadat" (semua 100% karena beban dibatasi kapasitas, tidak informatif) menjadi "sekolah terjauh dari SPPG pelayannya" (waktu tempuh ke SPPG yang melayani, garis putus = 10 menit, skala sampai 30 menit) =================
const terjauh=sekolahData.map((s,si)=>({nama:s.properties.NAMA||'-',t:beban.dekat[si].t})).filter(o=>o.t!=null).sort((a,b)=>b.t-a.t).slice(0,6);
setCard(1,'Sekolah terjauh dari SPPG pelayannya (garis putus = 10 menit)',terjauh.map(o=>barisBar(o.nama,o.t,1800,(o.t/60).toFixed(1)+' mnt',o.t>600?'#fb923c':'#4ade80',600)).join('')+'<div class="cat">Skala sampai 30 menit (batas BGN).</div>');

// ================= mengganti kartu "Sebaran utilisasi" menjadi sebaran waktu tempuh siswa ke SPPG pelayannya (0-5, 5-10, 10-20, 20-30 menit) =================
const RENTANG=[{l:'0-5 mnt',a:0,b:300,w:'#4ade80'},{l:'5-10 mnt',a:300,b:600,w:'#a3e635'},{l:'10-20 mnt',a:600,b:1200,w:'#fbbf24'},{l:'20-30 mnt',a:1200,b:1801,w:'#fb923c'}];
const sisRentang=RENTANG.map(()=>0);let sisTotal=0;
sekolahData.forEach((s,si)=>{const t=beban.dekat[si].t;if(t==null) return;const n=getSiswa(s);sisTotal+=n;const r=RENTANG.findIndex(x=>t>=x.a&&t<x.b);if(r>=0) sisRentang[r]+=n;});
setCard(2,'Waktu tempuh siswa ke SPPG pelayannya',RENTANG.map((r,i)=>barisBar(r.l,sisRentang[i],Math.max(1,sisTotal),fmt(sisRentang[i])+' ('+Math.round(100*sisRentang[i]/Math.max(1,sisTotal))+'%)',r.w)).join('')+'<div class="cat">Jumlah siswa per rentang waktu tempuh (batas BGN 30 menit).</div>');

// ================= mengganti kurva "Jika dibangun SPPG baru" menjadi daftar usulan lokasi yang bisa diklik (zoom ke lokasi) =================
renderKartuUsulan();

// kualitas data (ringkas)
const semua=sppgSemuaData,dipakai=semua.filter(f=>f.properties.dipakai_analisis);
const jalan=dipakai.filter(f=>['jalan','ruas_jalan','tempat'].includes(f.properties.geo_akurasi)).length;
const asli=sekolahData.filter(s=>s.properties.sumber_siswa==='bps'||s.properties.siswa).length;
setCard(4,'Kualitas data',barisInfo('SPPG dipakai / tercatat',`${dipakai.length} / ${semua.length}`)+barisInfo('Koordinat SPPG: jalan / kelurahan',`${jalan} / ${dipakai.length-jalan}`)+barisInfo('Titik SPPG unik',grup.length)+barisInfo('Jumlah siswa','estimasi (BPS kecamatan, dibagi rata)'));
}

// ================= pembuatan kartu usulan lokasi SPPG baru: tiap baris berisi kelurahan, kecamatan, sekolah dan siswa yang diambil alih; klik untuk zoom dan membuka popup =================
function renderKartuUsulan(){
if(pilihan) return;
const d=kandidatTerakhir&&kandidatTerakhir.daftar;
if(!d||!d.length){setCard(3,'Usulan lokasi SPPG baru','<div class="cat">'+(analisisDasar?'Tidak ada lokasi baru yang diperlukan.':'Menghitung...')+'</div>');return;}
const rk=ringkasanKandidat;
const ket=rk?(rk.akhir===0?`${d.length} lokasi menutup semua sekolah yang belum terlayani baik.`:`${d.length} lokasi menurunkan sisa menjadi ${fmt(rk.akhir)} siswa.`):'';
setCard(3,'Usulan lokasi SPPG baru',d.slice(0,5).map((k,i)=>`<div class="row kand-row" data-i="${i}" style="cursor:pointer;justify-content:space-between;gap:8px" title="Klik untuk melihat lokasi di peta"><span style="width:auto;color:#f472b6">#${k.rank}</span><span class="n" style="flex:1" title="${esc(k.host.kel)}, ${esc(k.host.kec)}">${esc(k.host.kel)}, ${esc(k.host.kec)}</span><b>${k.sekolah} sek &middot; ${fmt(k.siswa)}</b></div>`).join('')+`<div class="cat">${ket}${d.length>5?' (5 teratas ditampilkan)':''}</div>`);
}
document.addEventListener('click',(e)=>{
const r=e.target.closest&&e.target.closest('.kand-row');
if(!r||!kandidatTerakhir) return;
const k=kandidatTerakhir.daftar[+r.dataset.i];
if(!k) return;
map.flyTo({center:k.xy,zoom:14});
new maplibregl.Popup().setLngLat(k.xy).setHTML(teksKandidat(k)).addTo(map);
});

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
setKpi(1,'Siswa dialokasikan / hari',fmt(muatan),`kapasitas ${fmt(kapT)}`,'');
setKpi(2,'Utilisasi SPPG',Math.round(u*100)+'%',`peringkat ${peringkat} dari ${grup.length}`,u>1?'bad':'ok');
setKpi(3,'Sekolah dilayani',r.idx.length,`${ada.length} jenjang`,'');
setKpi(4,sisa>=0?'Sisa kapasitas':'Kelebihan beban',fmt(Math.abs(sisa)),'penerima per hari',sisa>=0?'ok':'bad');
setCard(1,'Sekolah dilayani per jenjang',ada.map(j=>barisBar(j.k,per[j.k].n,maxN,per[j.k].n,j.warna)).join('')||'<div class="cat">Tidak ada sekolah yang dilayani.</div>');
setCard(2,'Porsi (siswa) per jenjang',ada.map(j=>barisBar(j.k,per[j.k].siswa,maxS,fmt(per[j.k].siswa),j.warna)).join('')||'<div class="cat">-</div>');
setCard(3,'Beban vs kapasitas',barisBar('Beban',muatan,Math.max(kapT,muatan),fmt(muatan),warnaUtil(u),kapT)+barisInfo('Kapasitas',fmt(kapT))+barisInfo('Rata-rata kota',rata+'%')+'<div class="cat">Garis putus = kapasitas.</div>');
setCard(4,'Catatan SPPG',barisInfo('Nama',esc(namaPendek(p['Nama SPPG'])))
+barisInfo('Kelurahan / Kec.',`${esc(p['Desa/Kelurahan SPPG'])} / ${esc(p['Kecamatan SPPG'])}`)
+(p.alamat?`<div class="cat" style="margin:2px 0">${esc(p.alamat)}</div>`:'')
+barisInfo('Koordinat',p.geo_akurasi==='jalan'?'titik jalan (alamat)':(p.geo_akurasi==='ruas_jalan'?'ruas jalan dari nama jalan (perkiraan)':(p.geo_akurasi==='tempat'?'nama tempat/kawasan (perkiraan)':'titik kelurahan (perkiraan)')))
+(g.n>1?barisInfo('SPPG di titik ini',g.n):'')
+(p.dekat==1?`<div style="color:#f87171;margin-top:4px">&#9888; ${esc(p.alasan)}</div>`:''));
}

// ================= pembuatan tampilan sekolah terpilih: siswa, SPPG yang melayani, SPPG terdekat, dan status jangkauan 10 menit =================
function renderDashSekolah(idx){
const {grup,kap,beban}=analisisDasar;
const s=sekolahData[idx],p=s.properties,xy=s.geometry.coordinates.slice(0,2);
const siswa=getSiswa(s);
const dk=beban.dekat[idx],gi=dk.idx,g=grup[gi];
const muatan=beban.muatan[gi],kapT=g.n*kap,u=muatan/kapT;
const jenjang=JENJANG.find(j=>j.k===p.jenjang);
// ================= memperbaiki daftar SPPG terdekat berdasarkan jarak garis lurus menjadi berdasarkan waktu tempuh (jarak hanya cadangan) =================
const iw=analisisDasar.iw;
const terdekat=grup.map((x,k)=>({k,d:jarakM(xy,x.xy),t:waktuDetik(iw,k,idx)})).sort((a,b)=>(a.t!=null&&b.t!=null)?a.t-b.t:a.d-b.d).slice(0,5);
let dijangkau=0;
try{if(isoSppg){const pt=turf.point(xy);dijangkau=isoSppg.features.filter(ft=>ft.properties.waktu_detik===waktuIso&&turf.booleanPointInPolygon(pt,ft)).length;}}catch{}
const luar=sekolahTdkTercakup.has(idx);
setKpi(1,'Jumlah siswa',fmt(siswa),'BPS kecamatan, dibagi rata','');
setKpi(2,'Jenjang',esc(p.jenjang),esc(p.STATUS||p.status||'&nbsp;'),'');
setKpi(3,'Dilayani oleh',esc(namaPendek(g.nama[0])),`utilisasi ${Math.round(u*100)}%`,u>1?'bad':'ok');
setKpi(4,dk.t!=null?'Waktu ke SPPG':'Jarak ke SPPG',dk.t!=null?(dk.t/60).toFixed(1)+' menit':(dk.d/1000).toFixed(1)+' km',dk.t!=null?`waktu tempuh, ${(dk.d/1000).toFixed(1)} km lurus`:'garis lurus',dk.t!=null&&dk.t>600?'bad':'');
setCard(1,'Identitas sekolah',barisInfo('Nama',esc(p.NAMA||'-'))+barisInfo('Jenjang',esc(p.jenjang))+barisInfo('Kecamatan',esc(p.KECAMATAN||'-'))+barisInfo('Kelurahan',esc(p.DESA||'-'))+(p.ALAMAT?`<div class="cat" style="margin:2px 0">${esc(p.ALAMAT)}</div>`:'')+barisInfo('Siswa (BPS, dibagi rata)',fmt(siswa)));
setCard(2,'SPPG yang melayani',barisInfo('SPPG',esc(namaPendek(g.nama[0])))+barisBar('Beban',muatan,Math.max(kapT,muatan),fmt(muatan),warnaUtil(u),kapT)+barisInfo('Kapasitas',fmt(kapT))+(g.n>1?barisInfo('SPPG di titik ini',g.n):''));
const wMaks=Math.max(60,...terdekat.map(t=>t.t!=null?t.t:t.d/6));   // jarak/6 m/s sebagai perkiraan kasar jika tanpa waktu tempuh
setCard(3,'SPPG tercepat (waktu tempuh)',terdekat.map(t=>barisBar(namaPendek(grup[t.k].nama[0]),t.t!=null?t.t:t.d/6,wMaks,t.t!=null?(t.t/60).toFixed(1)+' mnt':(t.d/1000).toFixed(1)+' km',t.t!=null&&t.t>600?'#fb923c':(jenjang?jenjang.warna:'#38bdf8'),600)).join('')+'<div class="cat">Garis putus = batas 10 menit.</div>');
setCard(4,`Jangkauan ${waktuIso/60} menit`,barisInfo('Dijangkau titik SPPG',dijangkau)+(dk.t!=null&&dk.t>600?`<div style="color:#fb923c;margin-top:4px">&#9888; SPPG pelayan berjarak ${(dk.t/60).toFixed(1)} menit: di luar isochrone 10 menit (masih dalam batas BGN 30 menit).</div>`:'')+(luar?'<div style="color:#fb923c;margin-top:4px">&#9888; Di luar isochrone 10 menit dari semua SPPG.</div>':'<div class="cat" style="margin-top:4px">Berada di dalam isochrone 10 menit.</div>'));
}

// ================= pembuatan rincian kualitas data dan metode di tab Data (selalu diperbarui) =================
function renderDataKualitas(){
const {grup,kap,tot}=analisisDasar;
const el=document.getElementById('dataKualitas');
if(!el) return;
const semua=sppgSemuaData,dipakai=semua.filter(f=>f.properties.dipakai_analisis);
const jalan=dipakai.filter(f=>['jalan','ruas_jalan','tempat'].includes(f.properties.geo_akurasi)).length;
const asli=sekolahData.filter(s=>s.properties.sumber_siswa==='bps'||s.properties.siswa).length;
const per=tot?Object.keys(tot).map(j=>`${j} ${tot[j].n}`).join(' / '):'-';
el.innerHTML=barisInfo('SPPG tercatat / dipakai analisis',`${semua.length} / ${dipakai.length}`)
+barisInfo('Koordinat SPPG dari alamat jalan',jalan)
+barisInfo('Koordinat SPPG titik kelurahan',dipakai.length-jalan)
+barisInfo('Titik SPPG unik (kembar digabung)',grup.length)
+barisInfo('Sekolah di peta',`${sekolahData.length}`)
+`<div class="cat">${per}</div>`
+barisInfo('Sekolah dengan estimasi siswa dari BPS kecamatan',`${asli} dari ${sekolahData.length}`)
+`<div class="cat">Jumlah siswa per sekolah adalah estimasi (angka BPS per kecamatan dibagi rata), bukan data tiap sekolah.</div>`
+`<p class="text-xs text-slate-500 mt-2">Metode: pasangan SPPG-sekolah diproses dari waktu tempuh terpendek; tiap SPPG mengambil sekolah terdekatnya sampai kuota ${fmt(kap)} per SPPG penuh, lalu sekolah yang tersisa diambil SPPG terdekat berikutnya yang masih punya kuota, semuanya maksimal 30 menit; sekolah yang tidak muat dihitung sebagai kelebihan di SPPG tercepatnya. Siswa dialokasikan = jumlah siswa (1 siswa = 1 porsi). Cakupan 10 menit = gabungan isochrone berkendara semua SPPG (OpenRouteService). SPPG yang dikeluarkan: koordinat tidak ditemukan atau terlalu jauh dari kota.</p>`;
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
map.addLayer({id:'layanan-layer',type:'fill',source:'layanan',filter:['==',['geometry-type'],'Polygon'],paint:{'fill-color':'#38bdf8','fill-opacity':0.2,'fill-outline-color':'#7dd3fc'}},map.getLayer('sd-layer')?'sd-layer':undefined);
map.addLayer({id:'layanan-sekolah-layer',type:'circle',source:'layanan',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':'rgba(0,0,0,0)','circle-radius':9,'circle-stroke-color':'#7dd3fc','circle-stroke-width':2}});
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

// ================= memperbaiki pencarian kandidat yang menilai dengan jarak garis lurus dari semua 1.042 sekolah menjadi memakai WAKTU TEMPUH dari 150 calon lokasi (data/waktu-kandidat.json) agar kandidat dinilai dengan ukuran yang sama dengan alokasi SPPG yang ada; versi garis lurus dipertahankan sebagai cadangan bila data waktu kandidat tidak termuat =================
function cariKandidat(K){
return matriksKandidat?cariKandidatWaktu(K):cariKandidatLurus(K);
}

// ================= pembuatan pencarian kandidat berbasis waktu tempuh: tiap putaran pilih satu calon yang paling banyak mengurangi kelebihan beban dan menjangkau sekolah yang belum tercakup 10 menit; sekolah pindah ke calon hanya bila waktu tempuhnya lebih cepat dan tidak lebih dari batas BGN 30 menit =================
function cariKandidatWaktu(K){
const {grup,kap,beban}=analisisDasar;
const N=sekolahData.length;
const siswa=sekolahData.map(s=>getSiswa(s));
const idxSek=new Map(sekolahData.map((s,i)=>[String(s.properties.NPSN),i]));
const kolom=new Map(matriksKandidat.npsn.map((n,j)=>[String(n),j]));
const col=sekolahData.map(s=>kolom.get(String(s.properties.NPSN)));        // kolom matriks tiap sekolah (undefined bila tidak ada)
const BATAS_DETIK=1800, DETIK_10_MENIT=600, JARAK_MIN_SPPG=300, JARAK_MIN_KANDIDAT=1000;   // detik / meter
// calon yang sekolah acuannya ada di data dan tidak terlalu dekat dengan SPPG yang ada
const calon=[];
matriksKandidat.kandidat.forEach((npsn,i)=>{
const h=idxSek.get(String(npsn));
if(h==null) return;
const xy=matriksKandidat.titik[i].split(',').map(Number);
if(grup.some(g=>jarakM(xy,g.xy)<JARAK_MIN_SPPG)) return;
calon.push({i,h,xy});
});
const g=beban.dekat.map(d=>d.idx);                                         // penugasan: indeks titik SPPG, atau indeks kandidat (>= grup.length)
const tKini=beban.dekat.map(d=>d.t!=null?d.t:Infinity);                    // waktu tempuh tiap sekolah ke pemberi layanan saat ini
const kapAll=grup.map(x=>x.n*kap);
const muatan=beban.muatan.slice();
const belum=new Set(sekolahTdkTercakup);                                   // sekolah di luar gabungan isochrone 10 menit
const kelebihanAwal=beban.kelebihan;
const belumAwal=[...belum].reduce((a,i)=>a+siswa[i],0);
const dipilih=[];
const terpakai=new Set();

for(let r=0;r<K;r++){
let best=null;
for(const c of calon){
if(terpakai.has(c.i)) continue;
if(dipilih.some(p=>jarakM(c.xy,p.xy)<JARAK_MIN_KANDIDAT)) continue;        // terlalu dekat dengan kandidat lain
const baris=matriksKandidat.detik[c.i];
let muatC=0;
const lepas=new Map();                                                     // titik asal -> siswa yang pindah ke kandidat
for(let s=0;s<N;s++){
const t=col[s]==null?null:baris[col[s]];
if(t!=null&&t<=BATAS_DETIK&&t<tKini[s]){muatC+=siswa[s];lepas.set(g[s],(lepas.get(g[s])||0)+siswa[s]);}
}
let gain=0;                                                                // pengurangan kelebihan beban di titik asal
lepas.forEach((v,idx)=>{gain+=Math.max(0,muatan[idx]-kapAll[idx])-Math.max(0,muatan[idx]-v-kapAll[idx]);});
const exC=Math.max(0,muatC-kap);                                           // kelebihan baru jika kandidat sendiri melebihi kapasitas
let cov=0;
belum.forEach(s=>{const t=col[s]==null?null:baris[col[s]];if(t!=null&&t<=DETIK_10_MENIT) cov+=siswa[s];});   // siswa belum tercakup yang terjangkau dalam 10 menit
const skor=gain-exC+cov;
if(!best||skor>best.skor) best={c,skor,gain,cov,muatC,lepas};
}
if(!best||best.skor<=0) break;                                             // tidak ada lokasi yang masih memberi manfaat

const c=best.c, baris=matriksKandidat.detik[c.i];
const idxBaru=kapAll.length;
kapAll.push(kap);muatan.push(best.muatC);
// ================= pembuatan fakta pendukung alasan kandidat: rata-rata waktu yang dihemat sekolah yang diambil alih, utilisasi SPPG yang diringankan, rincian jenjang, dan kepadatan siswa vs kapasitas SPPG dalam radius 2 km =================
const xy=c.xy;
const dariSppg=[];
best.lepas.forEach((v,idx)=>{
const sebelum=muatan[idx]/kapAll[idx];
muatan[idx]-=v;
if(idx<grup.length) dariSppg.push({nama:grup[idx].nama[0],siswa:v,sebelum,sesudah:muatan[idx]/kapAll[idx]});
});
let nSek=0,hemat=0,siswaHemat=0;
const perJ={};
for(let s=0;s<N;s++){
const t=col[s]==null?null:baris[col[s]];
if(t!=null&&t<=BATAS_DETIK&&t<tKini[s]){
if(Number.isFinite(tKini[s])){hemat+=(tKini[s]-t)*siswa[s];siswaHemat+=siswa[s];}
g[s]=idxBaru;tKini[s]=t;nSek++;
const jj=sekolahData[s].properties.jenjang;perJ[jj]=(perJ[jj]||0)+1;
}
}
const jarakTerdekat=Math.min(...grup.map(x=>jarakM(xy,x.xy)),...dipilih.map(p=>jarakM(xy,p.xy)));
let siswa2km=0;for(let s=0;s<N;s++){if(jarakM(xy,sekolahData[s].geometry.coordinates)<=2000) siswa2km+=siswa[s];}
const dekat2=grup.filter(x=>jarakM(xy,x.xy)<=2000);
const sppg2km=dekat2.reduce((a,x)=>a+x.n,0);
const dicakup=[...belum].filter(s=>{const t=col[s]==null?null:baris[col[s]];return t!=null&&t<=DETIK_10_MENIT;});
dicakup.forEach(s=>belum.delete(s));
terpakai.add(c.i);
const p=sekolahData[c.h].properties;
dipilih.push({
c:c.h,rank:r+1,xy,
host:{nama:p.NAMA,jenjang:p.jenjang,kel:p.DESA,kec:p.KECAMATAN},
gainBeban:best.gain,gainBelum:best.cov,sekolah:nSek,siswa:best.muatC,util:best.muatC/kap,
dariSppg:dariSppg.sort((a,b)=>b.siswa-a.siswa).slice(0,3),
fakta:{jarakTerdekat,perJ,siswa2km,sppg2km,kap2km:sppg2km*kap,nBelum:dicakup.length,kap,berbasisWaktu:true,hematRataDetik:siswaHemat?hemat/siswaHemat:null},
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

// ================= pembuatan pencarian kandidat versi jarak garis lurus (cadangan): tiap putaran pilih satu lokasi sekolah yang paling banyak mengurangi kelebihan beban dan menjangkau sekolah yang belum tercakup 10 menit =================
function cariKandidatLurus(K){
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
// ================= pembuatan fakta pendukung alasan kandidat: jarak ke pemberi layanan terdekat sebelum dibangun, utilisasi SPPG yang diringankan (sebelum -> sesudah), rincian sekolah per jenjang yang diambil alih, dan kepadatan siswa vs kapasitas SPPG dalam radius 2 km =================
const jarakTerdekat=jarakKini[c];
const dariSppg=[];
best.lepas.forEach((v,idx)=>{
const sebelum=muatan[idx]/kapAll[idx];
muatan[idx]-=v;
if(idx<grup.length) dariSppg.push({nama:grup[idx].nama[0],siswa:v,sebelum,sesudah:muatan[idx]/kapAll[idx]});
});
let nSek=0;
const perJ={};
for(let s=0;s<N;s++){if(D[c][s]<jarakKini[s]){g[s]=idxBaru;jarakKini[s]=D[c][s];nSek++;const jj=sekolahData[s].properties.jenjang;perJ[jj]=(perJ[jj]||0)+1;}}
let siswa2km=0;for(let s=0;s<N;s++){if(D[c][s]<=2000) siswa2km+=siswa[s];}
const dekat2=grup.filter(x=>jarakM(xy[c],x.xy)<=2000);
const sppg2km=dekat2.reduce((a,x)=>a+x.n,0);
const dicakup=[...belum].filter(s=>D[c][s]<=RADIUS_COV);
dicakup.forEach(s=>belum.delete(s));
const p=sekolahData[c].properties;
dipilih.push({
c,rank:r+1,xy:xy[c],
host:{nama:p.NAMA,jenjang:p.jenjang,kel:p.DESA,kec:p.KECAMATAN},
gainBeban:best.gain,gainBelum:best.cov,sekolah:nSek,siswa:best.muatC,util:best.muatC/kap,
dariSppg:dariSppg.sort((a,b)=>b.siswa-a.siswa).slice(0,3),
fakta:{jarakTerdekat,perJ,siswa2km,sppg2km,kap2km:sppg2km*kap,nBelum:dicakup.length,kap},
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
// ================= pembuatan daftar alasan pemilihan lokasi kandidat berdasarkan fakta dan data yang dihitung (bukan asumsi): SPPG yang diringankan, sekolah per jenjang yang diambil alih, kepadatan siswa vs kapasitas dalam 2 km, jarak ke SPPG terdekat, dan sekolah yang belum tercakup =================
function alasanKandidat(k){
const f=k.fakta,a=[];
const berlebih=k.dariSppg.filter(d=>d.sebelum>1);
if(berlebih.length) a.push(`Meringankan ${berlebih.length} SPPG di sekitarnya yang melebihi kapasitas: ${berlebih.map(d=>`${esc(namaPendek(d.nama))} ${Math.round(d.sebelum*100)}% &rarr; ${Math.round(d.sesudah*100)}%`).join('; ')}.`);
const j=JENJANG.filter(x=>f.perJ[x.k]).map(x=>`${x.k} ${f.perJ[x.k]}`).join(', ');
a.push(`Mengambil alih ${k.sekolah} sekolah (${j}) dengan ${fmt(k.siswa)} siswa, setara ${Math.round(k.util*100)}% dari kapasitas ${fmt(f.kap)}.`);
a.push(`Dalam radius 2 km ada ${fmt(f.siswa2km)} siswa, sedangkan SPPG yang ada ${f.sppg2km?`${f.sppg2km} dengan kapasitas ${fmt(f.kap2km)} (permintaan ${Math.round(100*f.siswa2km/f.kap2km)}% dari kapasitas)`:'tidak ada'}.`);
a.push(`Jarak ke SPPG terdekat ${(f.jarakTerdekat/1000).toFixed(1)} km (garis lurus), memenuhi syarat minimal 300 m.`);
if(f.hematRataDetik!=null) a.push(`Sekolah yang diambil alih rata-rata menghemat ${(f.hematRataDetik/60).toFixed(1)} menit waktu tempuh dibanding pemberi layanan saat ini (dihitung per siswa).`);
if(f.nBelum) a.push(`Menjangkau ${f.nBelum} sekolah (~${fmt(k.gainBelum)} siswa) yang berada di luar isochrone${f.berbasisWaktu?' 10 menit, kini terjangkau dalam 10 menit dari lokasi ini':''}.`);
a.push(f.berbasisWaktu?`Dasar data: murid BPS 2025/2026 per sekolah, alokasi ke SPPG tercepat (waktu tempuh berkendara ORS, batas 30 menit), kapasitas ${fmt(f.kap)} per SPPG.`:`Dasar data: murid BPS 2025/2026 per sekolah, alokasi ke SPPG terdekat, kapasitas ${fmt(f.kap)} per SPPG.`);
return a;
}
function teksKandidat(k){
return `<b>Kandidat SPPG baru #${k.rank}</b><br>Lokasi acuan: ${esc(k.host.nama)} (${esc(k.host.jenjang)}), ${esc(k.host.kel)}, ${esc(k.host.kec)}`
+`<div style="margin-top:6px"><b>Mengapa di sini:</b></div><ul style="margin:2px 0 0 16px;padding:0;list-style:disc;font-size:12px">${alasanKandidat(k).map(t=>`<li>${t}</li>`).join('')}</ul>`;
}

// ================= pembuatan gambar titik kandidat (pink) beserta popup yang terdaftar sekali saja =================
function gambarKandidat(hasil){
safeRemove('candidate');
if(!hasil||!hasil.daftar.length) return;
map.addSource('candidate',{type:'geojson',data:{type:'FeatureCollection',features:hasil.daftar.map(k=>({type:'Feature',geometry:{type:'Point',coordinates:k.xy},properties:{rank:k.rank,teks:teksKandidat(k)}}))}});
map.addLayer({id:'candidate-layer',type:'circle',source:'candidate',paint:{'circle-color':'#f472b6','circle-radius':10,'circle-stroke-color':'#ffffff','circle-stroke-width':2}});
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
// ================= memperbaiki daftar kandidat yang hanya satu baris menjadi bisa dibuka (details) berisi alasan pemilihan lokasi berdasarkan data =================
daftar.innerHTML=h.daftar.map(k=>`<li><b>${esc(k.host.kel)}, ${esc(k.host.kec)}</b>: ambil alih ${k.sekolah} sekolah (${fmt(k.siswa)} siswa)${k.gainBeban>0?`, kelebihan &minus;${fmt(k.gainBeban)}`:''}<details><summary style="cursor:pointer;color:#38bdf8">Mengapa di sini?</summary><ul style="margin:2px 0 4px 14px;padding:0;list-style:disc;font-size:12px">${alasanKandidat(k).map(t=>`<li>${t}</li>`).join('')}</ul></details></li>`).join('');
}

// ================= pembuatan usulan lokasi otomatis: saat data siap (dan saat kapasitas atau waktu tempuh berubah) dicari jumlah lokasi paling sedikit (maks 10) yang membuat siswa tidak tertampung + di luar area 10 menit menjadi nol, digambar di peta, ditulis di tab Usulan, dan diringkas di kartu temuan =================
let ringkasanKandidat=null;   // {n, tuntas, awal, akhir}
function kandidatOtomatis(){
if(!analisisDasar) return;
try{
const kk=cariKandidat(20);
let n=kk.daftar.length;
for(let i=0;i<kk.daftar.length;i++){if(kk.daftar[i].sisaKelebihan+kk.daftar[i].sisaBelum===0){n=i+1;break;}}
n=Math.min(n,10);
const awal=kk.sebelum.kelebihan+kk.sebelum.belum;
const daftar=kk.daftar.slice(0,n);
const akhirD=daftar[daftar.length-1];
ringkasanKandidat={n:daftar.length,awal,akhir:akhirD?akhirD.sisaKelebihan+akhirD.sisaBelum:awal};
kandidatTerakhir={daftar,sebelum:kk.sebelum,sesudah:{kelebihan:akhirD?akhirD.sisaKelebihan:kk.sebelum.kelebihan,belum:akhirD?akhirD.sisaBelum:kk.sebelum.belum}};
gambarKandidat(kandidatTerakhir);
tampilkanHasilKandidat(kandidatTerakhir);
const inp=document.getElementById('jumlahKandidat');
if(inp&&daftar.length) inp.value=daftar.length;
}catch(e){console.error(e);ringkasanKandidat=null;}
perbaruiTemuan();
renderKartuUsulan();
}

// ================= pembuatan kartu temuan utama di pengantar: kapasitas terpakai, siswa tidak tertampung, sekolah di luar area 10 menit, dan jumlah lokasi usulan yang menutupnya =================
function perbaruiTemuan(){
const el=document.getElementById('temuan');
if(!el||!analisisDasar) return;
const {grup,kap,beban}=analisisDasar;
const idx=[...sekolahTdkTercakup];
const sJauh=idx.reduce((a,i)=>a+getSiswa(sekolahData[i]),0);
const minta=beban.muatan.reduce((a,b)=>a+b,0),kapT=grup.reduce((a,g)=>a+g.n*kap,0);
const k=ringkasanKandidat;
let t=`<b>Temuan:</b> ${Math.round(100*minta/kapT)}% kapasitas terpakai, ${fmt(beban.kelebihan)} siswa tidak tertampung. `;
if(idx.length){
t+=`${idx.length} sekolah (${fmt(sJauh)} siswa) berada di luar area ${waktuIso/60} menit dari SPPG mana pun`;
t+=k&&k.n?(k.akhir===0?`; <b>${k.n} lokasi baru</b> (titik merah muda) cukup untuk menutupnya.`:`; ${k.n} lokasi usulan (titik merah muda) menurunkan sisanya menjadi ${fmt(k.akhir)} siswa.`):'.';
}else t+=`Semua sekolah berada dalam ${waktuIso/60} menit dari suatu SPPG.`;
el.innerHTML=t;
}

// ================= pembuatan kartu pengantar yang bisa diciutkan (otomatis diciutkan di layar sempit) =================
const introEl=document.getElementById('intro'),introBtn=document.getElementById('introToggle');
if(introEl&&introBtn){
if(window.innerWidth<760) introEl.classList.add('kecil');
const labelIntro=()=>{introBtn.innerText=introEl.classList.contains('kecil')?'+':'–';};
labelIntro();
introBtn.addEventListener('click',()=>{introEl.classList.toggle('kecil');labelIntro();});
}

// ================= pembuatan tur 5 langkah (peta, angka kunci, klik SPPG, grafik, menu) dengan sorotan elemen =================
const LANGKAH_TUR=[
{j:'Peta',t:'Titik hitam adalah dapur SPPG. Titik berwarna adalah sekolah: biru SD/MI, kuning SMP/MTs, ungu SMA/SMK/MA (pinggiran putih = madrasah). Besar titik mengikuti jumlah siswa. Cincin merah = sekolah yang jauh dari SPPG mana pun, titik merah muda = usulan SPPG baru.',sel:null},
{j:'Angka kunci',t:'Empat angka di kiri atas: berapa siswa yang terjangkau dalam 10 menit, seberapa penuh kapasitas SPPG, berapa sekolah di luar jangkauan, dan berapa siswa tanpa kuota. Arahkan kursor ke kartu untuk penjelasan.',sel:'#kpiStrip'},
{j:'Coba klik',t:'Klik satu titik hitam (SPPG). Popup menampilkan siswa yang dialokasikan (maks 3.000 per hari) dan sekolah yang dilayani, dan semua angka serta grafik berganti untuk SPPG itu. Klik tempat kosong untuk kembali ke ringkasan kota.',sel:null},
{j:'Grafik di bawah',t:'Sekolah terjauh dari SPPG pelayannya, sebaran waktu tempuh siswa, daftar usulan lokasi SPPG baru (klik untuk zoom), dan kualitas data.',sel:'#dock'},
{j:'Menu di kiri',t:'Layer: nyalakan atau matikan titik dan lihat legenda. Analisis: area jangkauan dan heatmap. Atur: waktu tempuh dan kapasitas. Usulan: daftar lokasi SPPG baru beserta alasannya. Data: metode dan keterbatasan.',sel:'#rail'}
];
function tampilTur(i){
const el=document.getElementById('tur');
if(!el) return;
document.querySelectorAll('.tur-sorot').forEach(e=>e.classList.remove('tur-sorot'));
if(i<0||i>=LANGKAH_TUR.length){el.style.display='none';el.dataset.i='-1';return;}
const L=LANGKAH_TUR[i];
if(L.sel){const t=document.querySelector(L.sel);if(t) t.classList.add('tur-sorot');}
el.dataset.i=String(i);
el.style.display='block';
el.innerHTML=`<b>${i+1}/${LANGKAH_TUR.length}. ${L.j}</b><p>${L.t}</p><div class="turbtn"><button data-a="x">Tutup</button><span>${i>0?'<button data-a="b">Kembali</button> ':''}<button data-a="n">${i===LANGKAH_TUR.length-1?'Selesai':'Lanjut'}</button></span></div>`;
}
const turEl=document.getElementById('tur');
if(turEl) turEl.addEventListener('click',(e)=>{
const a=e.target&&e.target.dataset&&e.target.dataset.a;
if(!a) return;
const i=Number(turEl.dataset.i||0);
tampilTur(a==='x'?-1:(a==='b'?i-1:(i+1>=LANGKAH_TUR.length?-1:i+1)));
});
const tombolTur=document.getElementById('btnTur');
if(tombolTur) tombolTur.addEventListener('click',()=>{
if(document.body.classList.contains('dock-off')) pilihTab('dash');
tampilTur(0);
});

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
await ringkasanD(selectedSPPG,iso);
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
await ringkasanGlobal();
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
[...JENJANG.map(j=>j.id),'sppg','iso','candidate','heatmap','cover','beban','status'].forEach(safeRemove);
// ================= memperbaiki clear() agar juga menghapus area layanan SPPG sebelum menggambar ulang =================
hapusLayanan();
hanyaJauhAktif=false;   // layer dibuat ulang dengan opasitas penuh
}

// ================= memperbaiki toggleLayer yang hanya menerima satu id menjadi menerima beberapa id dipisah koma (mis. 'sd-layer,mi-layer') agar satu tombol bisa mengatur jenjang yang setara; keadaan ditentukan dari layer pertama yang ada =================
window.toggleLayer=(daftar)=>{
const ids=String(daftar).split(',').map(s=>s.trim()).filter(id=>map.getLayer(id));
if(!ids.length) return;
const v=map.getLayoutProperty(ids[0],'visibility');
// ================= memperbaiki v==='visible'?'none':'visible' menjadi v==='none'?'visible':'none' agar klik pertama langsung menyembunyikan layer (visibility awal undefined) =================
const baru=v==='none'?'visible':'none';
ids.forEach(id=>map.setLayoutProperty(id,'visibility',baru));
};

// ================= memperbaiki map.setStyle(styles[t]) menjadi map.setStyle(styles[t],{diff:false}) agar style dimuat ulang penuh dan event style.load menyala sehingga init menggambar ulang layer sekolah/SPPG (mode diff bawaan menghapus layer kita tanpa memicu style.load) =================
window.setStyle=(t)=>map.setStyle(styles[t],{diff:false});