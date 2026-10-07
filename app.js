// Motor Boletus edulis — port exacto de boletus_engine.py (NO TOCAR pesos)
const FLORA = {"Pinar":1,"Hayedo":.95,"Robledal":.9,"Castañeral":.9,"Pradera":0,"Pasto":0,"Bosque mixto":1,"Matorral":.1}; // Bosque mixto: máx. de sus componentes (lo calcula el llamante)
const fP14=p=>p<30?0:p<60?.3+.4*(p-30)/30:p<=100?1:p<=200?1-.4*(p-100)/100:.3;
const fRes=p=>p<30?.2:p<70?.2+.6*(p-30)/40:p<110?.8+.2*(p-70)/40:1; // reserva P30d
const fTA=t=>(t<6||t>28)?0:Math.exp(-((t-13.2)**2)/(2*25));
const fTS=s=>{if(s<7||s>21)return 0;if(s>=12&&s<=16)return 1;if(s>=10&&s<12)return .6+.4*(s-10)/2;if(s>16&&s<=18)return 1-.3*(s-16)/2;return s<10?.3+.3*(s-7)/3:.5;};
const fHR=h=>h>=80?1:h>=75?.8:h>=65?.4+.4*(h-65)/10:0;
const fAlt=h=>h>=600&&h<=1800?1:h>=500&&h<600?.5+.5*(h-500)/100:h>1800&&h<=2000?1-.5*(h-1800)/200:h>=400&&h<500?.3:0;
const fPH=p=>p>=4.5&&p<=6.5?1:p>6.5&&p<=7.2?.5:p>=4&&p<4.5?.6:0;
const fMes=m=>m===10?1:(m===9||m===11)?.85:(m===8||m===12)?.4:.1;
// --- Níscalo (Lactarius deliciosus): valores del usuario ---
const NIS_LAG=21; // primeros 7-15 d, pico ~21 d
const fTA2=t=>{if(t<5||t>24)return 0;if(t>=12&&t<=18)return 1;
  if(t>=8&&t<12)return .5+.5*(t-8)/4;if(t>=5&&t<8)return .2+.3*(t-5)/3;
  if(t>18&&t<=20)return 1-.5*(t-18)/2;return .5-.4*(t-20)/4;};
const fP14_2=p=>{if(p<25)return 0;if(p<50)return .3+.4*(p-25)/25;if(p<=90)return 1;
  if(p<=180)return 1-.4*(p-90)/90;return .3;};
const fRes2=p=>{if(p<30)return .2;if(p<70)return .2+.6*(p-30)/40;if(p<110)return .8+.2*(p-70)/40;return 1;};
const fPH2=p=>{if(p<4)return .2;if(p<4.5)return .2+.8*(p-4)/.5;if(p<=8)return 1;
  if(p<=8.5)return 1-.6*(p-8)/.5;return 0;};
const fAlt2=h=>{if(h>=100&&h<=1600)return 1;if(h>=0&&h<100)return .6;
  if(h>1600&&h<=1900)return 1-(h-1600)/300;return 0;};
const fMes2=m=>m===10?1:m===9?.85:m===11?.9:m===12?.6:m===8?.3:.1;
function floraNiscalo(cat,componentes){ // solo pinar; mixto con pino vale
  if(cat==="Pinar")return 1;
  if(cat==="Bosque mixto"&&(componentes||[]).includes("Pinar"))return 1;
  return 0;
}
function vetoDe(c,umbMin){ // umbrales por especie: edulis 0, níscalo -3
  const v=[];
  if(c.tmin<=umbMin)v.push("Helada");
  if(c.tmax>=28)v.push("Calor");
  if(c.vientoMax>45)v.push("Viento");
  return{veto:v.length>0,list:v};
}
function scoreNiscalo(o){
  const vd=vetoDe(o, -3);
  const d={P14:fP14_2(o.p14),res:fRes2(o.p30),TA:fTA2(o.ta),TS:fTS(o.ts),HR:fHR(o.hr)};
  let clima=.4*d.P14+.2*d.res+.2*d.TA+.1*d.TS+.1*d.HR; if(vd.veto)clima=0;
  const ter=fAlt2(o.alt),sue=fPH2(o.ph),flo=o.floraNota??0.70,tem=fMes2(o.mes);
  const prob=clima*ter*sue*flo*tem, sc=+(prob*100).toFixed(1);
  return{score:sc,clima:+clima.toFixed(3),d,terreno:ter,suelo:sue,flora:flo,temp:tem,
    veto:vd.veto,vetoList:vd.list,nivel:sc<25?"frío":sc<50?"tibio":sc<75?"caliente":"óptimo",pico:sc>=40?NIS_LAG:null};
}
function score(o){
  const veto=o.tmin<=0||o.tmax>=28||o.viento;
  const d={P14:fP14(o.p14),res:fRes(o.p30),TA:fTA(o.ta),TS:fTS(o.ts),HR:fHR(o.hr)};
  let clima=.4*d.P14+.2*d.res+.2*d.TA+.1*d.TS+.1*d.HR; if(veto)clima=0;
  const ter=fAlt(o.alt),sue=fPH(o.ph),flo=FLORA[o.flora]??0,tem=fMes(o.mes);
  const prob=clima*ter*sue*flo*tem;
  return {score:+(prob*100).toFixed(1),clima:+clima.toFixed(3),d,terreno:ter,suelo:sue,flora:flo,temp:tem,veto,
    pico:prob*100>=40?15:null,nivel:prob*100<25?"frío":prob*100<50?"tibio":prob*100<75?"caliente":"óptimo"};
}
// --- helpers ---
async function getJSON(url,ms,headers){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{signal:c.signal,headers});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json();}
  finally{clearTimeout(t);}
}
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
// --- 1) Open-Meteo: 30 días atrás + hoy (observado), suelo 18 cm (micorriza) ---
async function fetchClima(la,lo){
  const [d,h]=await Promise.all([
    getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_probability_max&timezone=auto&past_days=55&forecast_days=8&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`,20000),
    getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=soil_temperature_18cm&timezone=auto&past_days=30&forecast_days=1`,20000)
  ]);
  const FD=8, D=d.daily, n=D.time.length-FD; // hoy = len-8 (45 pasado + hoy + 7 futuro)
  const past=k=>D[k].slice(0,n); // 45 días observados (sin hoy)
  const P=past("precipitation_sum").map(v=>v??0);
  const T=past("temperature_2m_mean"), Mx=past("temperature_2m_max"),
        Mn=past("temperature_2m_min"), H=past("relative_humidity_2m_mean").map(v=>v??70),
        W=past("wind_speed_10m_max").map(v=>v??0);
  const hoyP=D.precipitation_sum[n]??0;
  const p14=P.slice(-14).reduce((s,v)=>s+v,0)+hoyP;
  const p30=P.reduce((s,v)=>s+v,0)+hoyP;
  const HT=h.hourly.soil_temperature_18cm.filter(v=>v!=null);
  const ts=avg(HT.slice(-168)); // media 7 días a 18 cm
  const tsR=avg(HT.slice(-(15*24+168),-(15*24))); // misma ventana, 15 días atrás
  const t7=T.slice(-7), mn7=Mn.slice(-7), mx7=Mx.slice(-7);
  const t7r=T.slice(-22,-15), mn7r=Mn.slice(-22,-15), mx7r=Mx.slice(-22,-15);
  const t7n=T.slice(-(NIS_LAG+7),-NIS_LAG), mn7n=Mn.slice(-(NIS_LAG+7),-NIS_LAG), mx7n=Mx.slice(-(NIS_LAG+7),-NIS_LAG);
  const Hr=H.slice(-22,-15), Wr=W.slice(-22,-15);
  const tsN=avg(HT.slice(-(NIS_LAG*24+168),-(NIS_LAG*24)));
  const Hn=H.slice(-(NIS_LAG+7),-NIS_LAG), Wn=W.slice(-(NIS_LAG+7),-NIS_LAG);
  const retro21={p14:P.slice(-(NIS_LAG+14),-NIS_LAG).reduce((a,v)=>a+v,0),p30:P.slice(-(NIS_LAG+30),-NIS_LAG).reduce((a,v)=>a+v,0),
    ta:avg(t7n),ts:tsN,hr:avg(Hn),tmin:Math.min(...mn7n),tmax:Math.max(...mx7n),vientoMax:Math.max(...Wn)};
  const retro={p14:P.slice(-29,-15).reduce((a,v)=>a+v,0),p30:P.slice(-45,-15).reduce((a,v)=>a+v,0),
    ta:avg(t7r),ts:tsR,hr:avg(Hr),tmin:Math.min(...mn7r),tmax:Math.max(...mx7r),vientoMax:Math.max(...Wr)};
  const fc=[]; // previsión 7 días desde hoy
  for(let i=n;i<Math.min(n+8,D.time.length);i++)fc.push({d:D.time[i],tx:D.temperature_2m_max[i]??null,tn:D.temperature_2m_min[i]??null,pp:D.precipitation_sum[i]??0,prob:D.precipitation_probability_max?D.precipitation_probability_max[i]??null:null,w:D.wind_speed_10m_max[i]??null});
  const C=d.current||{};
  const ahora={ta:C.temperature_2m??null,hr:C.relative_humidity_2m??null,prec:C.precipitation??null,viento:C.wind_speed_10m??null};
  return {p14,p30,ta:avg(t7),ts,hr:avg(H.slice(-7)),tmin:Math.min(...mn7),tmax:Math.max(...mx7),
    vientoMax:Math.max(...W.slice(-7)),hoyP,retro,retro21,ahora,fc};
}
// --- 2) SoilGrids 2.0: horizonte 5-15 cm, rejilla 250 m (interpolado, no campo) ---
async function fetchSuelo(la,lo){
  const j=await getJSON(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lo}&lat=${la}&property=phh2o&property=soc&property=sand&property=silt&property=clay&depth=5-15cm&value=mean`,15000);
  const out={};
  for(const L of j.properties?.layers||[]){
    const v=L.depths?.[0]?.values?.mean;
    if(v==null)continue;
    if(L.name==="phh2o")out.ph=v/10;
    if(L.name==="soc")out.soc=+(v/10).toFixed(1);
    if(L.name==="sand")out.sand=+(v/10).toFixed(0);
    if(L.name==="silt")out.silt=+(v/10).toFixed(0);
    if(L.name==="clay")out.clay=+(v/10).toFixed(0);
  }
  if(out.sand!=null){const{sand:s,clay:c}=out;
    out.textura=s>=70?"arenoso":s>=50?(c>=20?"franco-arcillo-arenoso":"franco-arenoso"):c>=35?"arcilloso":s>=30?"franco":"franco-limoso";}
  return out;
}
// --- 3) MFE (MITECO): formaciones capa por capa + ff_uso. Fuente hábitat principal ---
const MFE_BASE="https://geoserver.iepnb.es/geoserver/foto_fija_mfe";
const FORMACIONES=["robledales_qrobur_qpetraea","abedulares","avellanedas","robledales_roble_pubescente","quejigares","hayedos","castanares","fresnedas","acebedas","encinares","alcornocales","abetales","pinsapares","sabinares_juniperus_phoenicea","sabinares_albares","enebrales","pinar_pino_albar","pinar_pino_negro","pinar_pino_pinonero","pinar_pino_carrasco","pinar_pino_salgareno","pinar_pino_pinaster_reg_mediterranea","pinar_pino_pinaster_reg_atlantica","pinar_pino_radiata","frondosas_aloctonas_invasoras","coniferas_aloctonas_gestion","mezcla_coniferas_autoc_aloctonas","mezcla_coniferas_frondosas_autoc_aloctonas","frondosas_aloctonas_con_autoctonas","bosque_ribereno","dehesas","choperas_plataneras_produccion","eucaliptales","repoblacion_quercus_rubra","otras_coniferas_aloctonas_produccion","otras_especies_produccion_mezcla"];
function mfeURL(capa,la,lo){
  const d=0.0011; // ~120 m de radio
  return `${MFE_BASE}/${capa}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${capa}&QUERY_LAYERS=${capa}&STYLES=&SRS=EPSG:4326&BBOX=${lo-d},${la-d},${lo+d},${la+d}&WIDTH=101&HEIGHT=101&FORMAT=image/png&INFO_FORMAT=application/json&FEATURE_COUNT=3&X=50&Y=50`;
}
async function mfeGFI(capa,la,lo){
  const j=await getJSON(mfeURL(capa,la,lo),12000);
  const f=(j.features||[])[0];
  return f?f.properties:null;
}
function categoriaDeEspecie(n){
  const t=(n||"").toLowerCase();
  if(/pinus (sylvestris|nigra|uncinata|pinaster)/.test(t))return{categoria:"Pinar",nota:1.0};
  if(/pinus|larix|pseudotsuga|cedrus|cupressus/.test(t))return{categoria:"Pinar",nota:0.9};
  if(/fagus/.test(t))return{categoria:"Hayedo",nota:0.95};
  if(/quercus (robur|petraea|pyrenaica|pubescens|humilis|faginea|rubra)/.test(t))return{categoria:"Robledal",nota:0.9};
  if(/castanea/.test(t))return{categoria:"Castañeral",nota:0.9};
  // abetal, encinar, sabinar, eucaliptal, ribera y resto: Matorral (casi siempre van mezclados y salta Bosque mixto)
  return{categoria:"Matorral",nota:0.1};
}
const CAT_NOBLE=["Pinar","Hayedo","Robledal","Castañeral"];
async function mfeBosque(la,lo,progreso){
  let hechas=0;
  const ps=FORMACIONES.map(c=>mfeGFI(c,la,lo).then(p=>{hechas++;progreso&&progreso(hechas,FORMACIONES.length);return p?{capa:c,p}:null;}).catch(()=>{hechas++;progreso&&progreso(hechas,FORMACIONES.length);return null;}));
  const hits=(await Promise.all(ps)).filter(Boolean);
  if(!hits.length)return{hits:[],especies:[],categoria:null,nota:null};
  const esp=new Map();
  for(const h of hits)for(const k of["1","2","3"]){
    const n=h.p["nom_sp"+k], oc=h.p["nm_o"+k]||0;
    if(n&&!/sin especie/i.test(n)&&!esp.has(n))esp.set(n,{oc,fcc:h.p.nm_fccarb??null,form:h.p.descr_forarb||h.capa});
  }
  const notas={}; // categoria -> mejor nota de sus especies
  for(const n of esp.keys()){const{categoria,nota}=categoriaDeEspecie(n);notas[categoria]=Math.max(notas[categoria]??-1,nota);}
  const nobles=Object.keys(notas).filter(c=>CAT_NOBLE.includes(c));
  let categoria,nota;
  if(nobles.length>=2){categoria="Bosque mixto";nota=Math.max(...nobles.map(c=>notas[c]));}
  else if(nobles.length===1){categoria=nobles[0];nota=notas[categoria];}
  else{categoria="Matorral";nota=0.1;}
  return{hits,especies:[...esp.entries()].map(([n,v])=>({n,...v})),categoria,nota,componentes:nobles};
}
async function mfeUso(la,lo){
  const p=await mfeGFI("ff_uso",la,lo);
  if(!p)return null;
  const txt=((p.descr_clamfe||"")+" "+(p.agrupacion_clamfe||"")+" "+(p.nb_lulucf_nivel1||"")).toLowerCase();
  let clase=null,categoria=null,nota=null;
  if(/artificial|asentamiento|urbano/.test(txt))clase="artificial";
  else if(/dehesa/.test(txt)){clase="dehesa";categoria="Pasto";nota=0;}
  else if(/matorral/.test(txt)){clase="matorral";categoria="Matorral";nota=0.1;}
  else if(/arbustiva/.test(txt)){clase="pastizal arbustivo";categoria="Pasto";nota=0;}
  else if(/herbácea|herbacea|prado|pradera/.test(txt)){clase="pradera";categoria="Pradera";nota=0;}
  else if(/past|puerto/.test(txt)){clase="pasto";categoria="Pasto";nota=0;}
  else if(/cultiv|agr/.test(txt)){clase="cultivo";categoria="Pradera";nota=0;}
  else if(/agua|humedal|improductivo/.test(txt)){clase="agua/improductivo";categoria="Pradera";nota=0;}
  else if(/forestal/.test(txt)){ // arbolado no cubierto por formaciones: usa sus especies
    const n=p.nom_sp1;
    if(n&&!/sin especie/i.test(n)){const c=categoriaDeEspecie(n);clase="arbolado (ff_uso)";categoria=c.categoria;nota=c.nota;}
  }
  return{clase,categoria,nota,clam:p.descr_clamfe,agr:p.agrupacion_clamfe,
    lulucf:[p.nb_lulucf_nivel1,p.nb_lulucf_nivel2,p.nb_lulucf_nivel3].filter(Boolean).join(" · "),
    id_lulucf:p.id_lulucf,sp1:p.nom_sp1,fcc:p.nm_fccarb??null};
}
// --- 4) Overpass: SOLO conteo edificios 150 m si MFE y ff_uso no sirven. Nunca bosque ni pradera ---
async function esUrbano(la,lo){
  const q=`[out:json][timeout:10];(node(around:150,${la},${lo})[building];way(around:150,${la},${lo})[building];relation(around:150,${la},${lo})[building];);out count;`;
  const j=await getJSON("https://overpass-api.de/api/interpreter?data="+encodeURIComponent(q),14000);
  const t=+(j.elements?.[0]?.tags?.total||0);
  return{n:t,urbano:t>=10};
}
async function fetchLugar(la,lo){
  try{
    const j=await getJSON(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&zoom=10`,12000);
    return j.display_name||j.name||"";
  }catch{return "";} // sin topónimo la app sigue con coordenadas
}
// --- buscador: lugares y coordenadas (decimal, DM, DMS, N/S/E/O, coma es, UTM) ---
function numC(t){return parseFloat(String(t).replace(",","."));}
function compVal(t){
  const v=t.map(numC);
  if(v.length===1)return v[0];
  if(v.length===2)return v[0]+v[1]/60;
  return v[0]+v[1]/60+v[2]/3600;
}
function okPart(t){
  if(t.length<1||t.length>3)return false;
  const v=t.map(numC);
  if(v.some(isNaN))return false;
  if(t.length>=2&&!(v[1]>=0&&v[1]<60))return false;
  if(t.length>=3&&!(v[2]>=0&&v[2]<60))return false;
  return true;
}
function utmToLatLon(z,este,norte){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=0.9996;
  const lon0=((z-1)*6-180+3)*Math.PI/180, x=este-500000, m=norte/k0;
  const mu=m/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256));
  const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const p1=mu+(3*e1/2-27*e1*e1*e1/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu);
  const n1=a/Math.sqrt(1-e2*Math.sin(p1)**2), t1=Math.tan(p1)**2, c1=ep2*Math.cos(p1)**2;
  const r1=a*(1-e2)/(1-e2*Math.sin(p1)**2)**1.5, d=x/(n1*k0);
  const la=p1-(n1*Math.tan(p1)/r1)*(d*d/2-(5+3*t1+10*c1-4*c1*c1)*d**4/24+(61+90*t1+298*c1+45*t1*t1-252*ep2-3*c1*c1)*d**6/720);
  const lo=lon0+(d-(1+2*t1+c1)*d**3/6+(5-2*c1+28*t1-3*c1*c1+8*ep2+24*t1*t1)*d**5/120)/Math.cos(p1);
  return[la*180/Math.PI,lo*180/Math.PI];
}
function parseParte(p,esLat){
  const t=p.match(/[+-]?\d+(?:[.,]\d+)?/g)||[];
  if(!okPart(t))return null;
  let v=Math.abs(compVal(t));
  if(t[0][0]==="-")v=-v;
  if(esLat&&Math.abs(v)>90)return null;
  if(!esLat&&Math.abs(v)>180)return null;
  return v;
}
function parseCoords(txt){
  let s=String(txt||"").trim();
  if(!/\d/.test(s))return null;
  const mu=s.match(/(\d{1,2})\s*T?\s*([NS])?\s+(\d{5,6}(?:[.,]\d+)?)\s+(\d{6,7}(?:[.,]\d+)?)/i);
  if(mu&&+mu[1]>=1&&+mu[1]<=60&&(/[T]/i.test(s)||mu[2])){
    const r=utmToLatLon(+mu[1],numC(mu[3]),numC(mu[4]));
    if(Math.abs(r[0])<=90&&Math.abs(r[1])<=180)return{lat:+r[0].toFixed(6),lon:+r[1].toFixed(6),fmt:"UTM"};
  }
  s=s.replace(/[º˚]/g,"°").replace(/['’‘]/g,"'").replace(/["”″]/g,'"')
       .replace(/\blat(?:itud)?\b/gi,"").replace(/\blon(?:g(?:itud)?)?\b/gi,"").trim();
  const mp=s.match(/^([NSns])\s*([+-]?\d+(?:[.,]\d+)?)\s*[,;\s\/]+\s*([EOWeow])?\s*([+-]?\d+(?:[.,]\d+)?)\s*([EOWeow])?\s*$/);
  if(mp){
    const la=Math.abs(numC(mp[2]))*(/S/i.test(mp[1])?-1:1);
    const sl=mp[3]||mp[5];
    const lo=Math.abs(numC(mp[4]))*(sl&&/[WO]/i.test(sl)?-1:1);
    if(Math.abs(la)<=90&&Math.abs(lo)<=180)return{lat:+la.toFixed(6),lon:+lo.toFixed(6),fmt:"N/S/E/O"};
    return null;
  }
  const mh=s.match(/^(.*?[\d°'"])\s*([NSns])\s*[,;\/]?\s*(.+)$/);
  if(mh){
    const mo=mh[3].match(/^(.*?[\d°'"])\s*([EOWeow])\s*$/);
    const lonS=mo?mo[1]:mh[3];
    let la=parseParte(mh[1],true), lo=parseParte(lonS,false);
    if(la==null||lo==null)return null;
    la=Math.abs(la)*(/S/i.test(mh[2])?-1:1);
    lo=Math.abs(lo)*(mo&&/[WO]/i.test(mo[2])?-1:1);
    return{lat:+la.toFixed(6),lon:+lo.toFixed(6),fmt:"N/S/E/O"};
  }
  let L=null;
  if(/[;\/|]/.test(s))L=s.split(/[;\/|]/);
  else if((s.match(/°/g)||[]).length>=2&&!/,/.test(s)){const q=s.match(/^(.*["'])\s+(.*)$/);L=q?[q[1],q[2]]:null;}
  else if(/,/.test(s)){
    const c=s.split(",");
    if(c.length===2&&c.every(x=>/^[+-]?\s*\d+(\.\d+)?\s*$/.test(x)))L=c;
    else{const t=s.match(/[+-]?\d+(?:[.,]\d+)?/g)||[];
      if(t.length===2){const la=parseParte(t[0],true),lo=parseParte(t[1],false);
        if(la!=null&&lo!=null)return{lat:+la.toFixed(6),lon:+lo.toFixed(6),fmt:"decimal"};}
      else return tokensSinLetras(t);}
  }
  if(L&&L.length===2){
    const la=parseParte(L[0],true),lo=parseParte(L[1],false);
    if(la!=null&&lo!=null)return{lat:+la.toFixed(6),lon:+lo.toFixed(6),fmt:/°|'|"/.test(s)?"G/M/S":"decimal"};
    return null;
  }
  const t=s.match(/[+-]?\d+(?:[.,]\d+)?/g)||[];
  return tokensSinLetras(t);
}
function tokensSinLetras(t){
  let la=null,lo=null;
  if(t.length===2){la=parseParte(t[0],true);lo=parseParte(t[1],false);}
  else if(t.length===4&&okPart(t.slice(0,2))&&okPart(t.slice(2))){la=compVal(t.slice(0,2));lo=compVal(t.slice(2));}
  else if(t.length===6&&okPart(t.slice(0,3))&&okPart(t.slice(3))){la=compVal(t.slice(0,3));lo=compVal(t.slice(3));}
  else return null;
  if(la==null||lo==null||Math.abs(la)>90||Math.abs(lo)>180)return null;
  const f=t.length===2?"decimal":t.length===4?"G/M":"G/M/S";
  return{lat:+la.toFixed(6),lon:+lo.toFixed(6),fmt:f};
}
function goTo(la,lo,etiqueta){
  lat=+la;lon=+lo;
  marker.setLatLng([lat,lon]);map.setView([lat,lon],11);
  predecir(etiqueta||"");
}
async function buscar(){
  const q=document.getElementById("search").value.trim(), box=document.getElementById("results");
  if(!q)return;
  box.innerHTML="";
  const c=parseCoords(q);
  if(c){goTo(c.lat,c.lon,"coord "+c.fmt);return;}
  box.innerHTML="<small>Buscando lugar…</small>";
  try{
    const r=await getJSON(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=es,pt,ad&limit=5&viewbox=-9.5,35.5,4.5,44&accept-language=es`,15000);
    if(!r.length){box.innerHTML="<small>Sin resultados. Prueba con coordenadas.</small>";return;}
    box.innerHTML="";
    r.forEach(p=>{
      const b=document.createElement("button");
      b.textContent=(p.display_name||"").split(",").slice(0,3).join(",");
      b.onclick=()=>{box.innerHTML="";goTo(+p.lat,+p.lon,(p.display_name||"").split(",").slice(0,2).join(","));};
      box.appendChild(b);
    });
  }catch(e){box.innerHTML="<small>Error buscando: "+e.message+"</small>";}
}
// --- mapa ---
const map=L.map("dashboardMap").setView([41.76,-2.46],6);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map);
let marker=L.marker([41.76,-2.46]).addTo(map), lat=41.76, lon=-2.46;
map.on("click",e=>{lat=+e.latlng.lat.toFixed(4);lon=+e.latlng.lng.toFixed(4);marker.setLatLng([lat,lon]);predecir();});
const mfeCache=new Map();
let lastCalc=null; // {clima,alt,mes,lugar,fuenteHab,habitatTxt,suelo} para recalcular sin red
const RING_C=2*Math.PI*54;
function badge(nota){return nota>=0.8?'<span class="condition-status ok">Bien</span>':nota>=0.4?'<span class="condition-status warning">Flojo</span>':'<span class="condition-status danger">Mal</span>';}
function nivelClase(n){return n==="óptimo"?"nivel-alto":n==="caliente"?"nivel-medio":n==="tibio"?"nivel-bajo":"nivel-nulo";}
const VETO_TXT={Helada:"Helada (mínima 7 días ≤ 0 ºC): quema los primordios bajo la hojarasca. El aborto es total, no hay cosecha que salvar.",
Calor:"Calor (máxima 7 días ≥ 28 ºC): deshidrata el micelio y el primordio; a más de 21 ºC en suelo ya aborta, a 28 en aire se veta.",
Viento:"Viento (racha máxima > 45 km/h): seca la seta en horas aunque el suelo esté húmedo. Es el que más cosechas arruina con buena lluvia."};
function nivelIcon(n){return n==="óptimo"?"🟢":n==="caliente"?"🟡":n==="tibio"?"🟠":"🔴";}
async function predecir(etiqueta){
  const det=document.getElementById("habitatLine");
  document.getElementById("ringPct").textContent="…";
  document.getElementById("bannerTxt").textContent="Detectando parámetros del punto…";
  try{
    const [clima,suelo,lugar,dem]=await Promise.all([
      fetchClima(lat,lon),
      fetchSuelo(lat,lon).catch(()=>({})),
      fetchLugar(lat,lon),
      getJSON(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,15000).catch(()=>({elevation:[null]}))
    ]);
    const alt=dem.elevation?.[0]??null;
    // MFE con caché y progreso (solo España; fuera, manual)
    const enES=lon>=-9.6&&lon<=4.6&&lat>=35.4&&lat<=44.2;
    const key=lat.toFixed(3)+","+lon.toFixed(3);
    let mfe=mfeCache.get(key);
    if(!mfe&&enES){
      mfe=await mfeBosque(lat,lon,(h,n)=>{det.textContent=`MFE: ${h}/${n} formaciones…`;});
      mfeCache.set(key,mfe);
    }
    let floraCat=null,floraNota=null,habitatTxt="",fuenteHab="",uso=null,floraNotaN=null;
    if(mfe&&mfe.categoria){
      floraCat=mfe.categoria;floraNota=mfe.nota;fuenteHab="MFE";
      habitatTxt=mfe.categoria+(mfe.categoria==="Bosque mixto"&&mfe.componentes?" ("+mfe.componentes.join(" + ")+")":"")+": "+mfe.especies.map(e=>`${e.n} (oc.${e.oc}${e.fcc!=null?", FCC "+e.fcc+"%":""})`).join(" + ");
    }else{
      uso=await mfeUso(lat,lon).catch(()=>null);
      if(uso&&uso.categoria){
        floraCat=uso.categoria;floraNota=uso.nota;fuenteHab="MFE ff_uso";
        habitatTxt=`${uso.clam||uso.clase} · LULUCF ${uso.id_lulucf??"?"} ${uso.lulucf}`;
      }else{
        // tercer paso: solo descampado vs plaza
        try{
          const u=await esUrbano(lat,lon);
          if(u.urbano){floraCat="Urbano";floraNota=0;fuenteHab="OSM edificios";habitatTxt=`núcleo urbano (${u.n} edificios en 150 m)`;}
          else{floraCat=null;floraNota=null;fuenteHab="";habitatTxt=`sin bosque MFE ni uso aprovechable (${u.n} edificios en 150 m): hábitat sin determinar`;}
        }catch{habitatTxt="MFE sin bosque y verificación urbana no disponible: hábitat sin determinar";}
      }
    }
    const mes=new Date().getMonth()+1;
    if(mfe&&mfe.categoria)floraNotaN=floraNiscalo(mfe.categoria,mfe.componentes);
    else if(uso&&uso.categoria)floraNotaN=uso.categoria==="Pinar"?1:0;
    lastCalc={clima,alt,mes,lugar:lugar||etiqueta||"",fuenteHab,habitatTxt,suelo,
      floraCat,floraNota,floraNotaN,phVal:suelo.ph??null};
    const DIAS=["dom","lun","mar","mié","jue","vie","sáb"];
    document.getElementById("forecastBody").innerHTML=clima.fc.map(f=>{
      const dt=new Date(f.d+"T12:00");
      return `<tr><td>${DIAS[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}</td><td class="num">${f.tx!=null?f.tx.toFixed(0)+"º / "+f.tn.toFixed(0)+"º":"?"}</td><td class="num">${f.pp.toFixed(1)} mm${f.prob!=null?" ("+f.prob+"%)":""}</td><td class="num">${f.w!=null?f.w.toFixed(0)+" km/h":"?"}</td></tr>`;}).join("");
    const T=(id,v)=>{document.getElementById(id).textContent=v;};
    T("locationName",lugar?lugar.split(",").slice(0,2).join(","):(etiqueta||"Punto manual"));
    T("coordinatesValue",`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    T("altitudeValue",alt!=null?Math.round(alt)+" m":"?");
    T("airNowValue",clima.ahora.ta!=null?clima.ahora.ta.toFixed(1)+" ºC":"?");
    T("humNowValue",clima.ahora.hr!=null?clima.ahora.hr+" %":"?");
    T("windNowValue",(clima.ahora.viento!=null?clima.ahora.viento.toFixed(0)+" km/h":"?")+(clima.ahora.prec!=null?` · hoy ${clima.ahora.prec.toFixed(1)} mm`:""));
    T("soilTypeValue",suelo.textura?`${suelo.textura[0].toUpperCase()+suelo.textura.slice(1)}${suelo.soc!=null?", "+(suelo.soc>=25?"muy fértil":suelo.soc>=12?"fértil":suelo.soc>=6?"fertilidad media":"pobre"):""}`:"?");
    T("phValue",suelo.ph!=null?suelo.ph.toFixed(1):"sin dato");
    det.textContent=floraCat||"sin determinar";
    det.title=habitatTxt||"";
    document.getElementById("lastUpdate").textContent="Actualizado "+new Date().toLocaleString("es-ES");
    renderAll();
  }catch(e){
    document.getElementById("condList").innerHTML=`<div class="alert-box">Error red/API: ${e.message}. Revisa conexión y reintenta.</div>`;
    document.getElementById("bannerTxt").textContent="No se pudo calcular.";
  }
}
function renderAll(){
  if(!lastCalc)return;
  const{clima,alt,mes,fuenteHab,habitatTxt}=lastCalc;
  const floraCat=lastCalc.floraCat, floraNota=lastCalc.floraNota, phV=lastCalc.phVal;
  const r=score({p14:clima.p14,p30:clima.p30,ta:clima.ta,ts:clima.ts,hr:clima.hr,alt:alt??1000,
    ph:phV??6.0,flora:"Matorral",tmin:clima.tmin,tmax:clima.tmax,viento:clima.vientoMax>45,mes});
  // neutros automáticos cuando la fuente falla: nadie mete nada a mano
  r.suelo=phV!=null?r.suelo:1.0;
  r.flora=floraNota??0.70;
  r.score=+(r.clima*r.terreno*r.suelo*r.flora*r.temp*100).toFixed(1);
  r.nivel=r.score<25?"frío":r.score<50?"tibio":r.score<75?"caliente":"óptimo";
  r.pico=r.score>=40?15:null;
  const floraTxt=floraCat||"sin hábitat conocido", sueloTxt=phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH";
  document.getElementById("ringFill").style.strokeDasharray=`${(r.score/100*RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  document.getElementById("ringPct").textContent=r.score;
  document.getElementById("ringNivel").textContent=r.nivel;
  const banner=document.getElementById("banner");
  banner.className="prediction-banner "+nivelClase(r.nivel);
  // lectura hacia atrás: con lo de hace 15 días, ¿toca cosecha hoy?
  const cR=clima.retro;
  const rR=score({p14:cR.p14,p30:cR.p30,ta:cR.ta,ts:cR.ts,hr:cR.hr,alt:alt??1000,
    ph:phV??6.0,flora:"Matorral",tmin:cR.tmin,tmax:cR.tmax,viento:cR.vientoMax>45,mes});
  rR.suelo=phV!=null?rR.suelo:1.0;
  rR.flora=floraNota??0.70;
  rR.score=+(rR.clima*rR.terreno*rR.suelo*rR.flora*rR.temp*100).toFixed(1);
  const hoy=r.score>=40, hubo=rR.score>=40;
  lastCalc.r=r;lastCalc.rR=rR;lastCalc.cR=cR;
  document.getElementById("bannerTxt").textContent=
    hoy&&hubo?`🟢 En pico: salir ya. Sigue bueno, más en +15 días.`:
    !hoy&&hubo?`🟡 El pico es ahora; la ventana se cierra.`:
    hoy&&!hubo?`🟡 Sin cosecha hoy; pico en +15 días si se mantiene.`:
    `🔴 Sin ventana de fructificación.`;
  const ci=(k,v,n)=>`<div class="condition-item"><span>${k}</span><span class="condition-value">${v} ${badge(n)}</span></div>`;
  document.getElementById("condList").innerHTML=
    ci("Lluvia 14 días",clima.p14.toFixed(0)+" mm",r.d.P14)+ci("Reserva lluvia 30 días",clima.p30.toFixed(0)+" mm",r.d.res)+
    ci("Temp aire 7 días (media)",clima.ta.toFixed(1)+" ºC",r.d.TA)+ci("Temp suelo 18 cm 7 días (media)",clima.ts.toFixed(1)+" ºC",r.d.TS)+
    ci("Humedad relativa 7 días (media)",clima.hr.toFixed(0)+" %",r.d.HR)+(()=>{const v=[];if(clima.tmin<=0)v.push("Helada");if(clima.tmax>=28)v.push("Calor");if(clima.vientoMax>45)v.push("Viento");
    return `<div class="condition-item"><span>Veto</span><span class="condition-value" title="${v.map(x=>VETO_TXT[x]).join(" ")}">${v.length?v.join(" + "):"Ninguno"} ${badge(r.veto?0:1)}</span></div>`;})();
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const di=(k,v)=>`<div class="mushroom-detail-item"><span class="mushroom-detail-label">${k}</span><span class="mushroom-detail-value">${v}</span></div>`;
  document.getElementById("detailList").innerHTML=
    di("Altitud",`${alt!=null?Math.round(alt)+" m":"?"} ${badge(r.terreno)}`)+
    di("pH del suelo",`${sueloTxt} ${badge(r.suelo)}`)+
    di("Estación",`${MESES[mes-1]} ${badge(r.temp)}`)+di("Cosecha hoy",hubo?`SI · hace 15 días llovió bien ${badge(1)}`:`NO · hace 15 días ${cR.p14<30?"no llovió suficiente":"hizo mal tiempo"} ${badge(0)}`)+`<div class="mushroom-detail-item"><span class="mushroom-detail-label">Hábitat</span><span class="mushroom-detail-value" title="${(fuenteHab?fuenteHab+" — ":"")+habitatTxt}">${floraTxt} ${badge(r.flora)}</span></div>`;
  renderAnalysis();
  renderNiscalo();
}
let specAn="edulis";
function renderNiscalo(){
  if(!lastCalc)return;
  const{clima,alt,mes,fuenteHab,habitatTxt}=lastCalc;
  const phV=lastCalc.phVal, fN=lastCalc.floraNotaN;
  const floraTxt=lastCalc.floraCat||"sin hábitat conocido";
  const base={alt:alt??1000,ph:phV??6.0,mes};
  const rN=scoreNiscalo({p14:clima.p14,p30:clima.p30,ta:clima.ta,ts:clima.ts,hr:clima.hr,
    ...base,tmin:clima.tmin,tmax:clima.tmax,vientoMax:clima.vientoMax,floraNota:fN??0.70});
  const cN=clima.retro21;
  const rNR=scoreNiscalo({p14:cN.p14,p30:cN.p30,ta:cN.ta,ts:cN.ts,hr:cN.hr,
    ...base,tmin:cN.tmin,tmax:cN.tmax,vientoMax:cN.vientoMax,floraNota:fN??0.70});
  const hoy=rN.score>=40, hubo=rNR.score>=40;
  lastCalc.rN=rN;lastCalc.rNR=rNR;lastCalc.cRN=cN;
  document.getElementById("ringFillN").style.strokeDasharray=`${(rN.score/100*RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  document.getElementById("ringPctN").textContent=rN.score;
  document.getElementById("ringNivelN").textContent=rN.nivel;
  document.getElementById("bannerN").className="prediction-banner "+nivelClase(rN.nivel);
  document.getElementById("bannerTxtN").textContent=
    hoy&&hubo?`En pico: salir ya. Sigue bueno, más en +21 días.`:
    !hoy&&hubo?`El pico es ahora; la ventana se cierra.`:
    hoy&&!hubo?`Sin cosecha hoy; pico en +21 días si se mantiene.`:
    `Sin ventana de fructificación.`;
  const vn=[];if(clima.tmin<=-3)vn.push("Helada");if(clima.tmax>=28)vn.push("Calor");if(clima.vientoMax>45)vn.push("Viento");
  const vtxt=n=>n==="Helada"?"Helada con mínimas de −3 ºC o menos: quema los primordios. El aborto es total.":VETO_TXT[n];
  const ci=(k,v,n)=>`<div class="condition-item"><span>${k}</span><span class="condition-value">${v} ${badge(n)}</span></div>`;
  document.getElementById("condListN").innerHTML=
    ci("Lluvia 14 días",clima.p14.toFixed(0)+" mm",rN.d.P14)+ci("Reserva lluvia 30 días",clima.p30.toFixed(0)+" mm",rN.d.res)+
    ci("Temp aire 7 días (media)",clima.ta.toFixed(1)+" ºC",rN.d.TA)+ci("Temp suelo 18 cm 7 días (media)",clima.ts.toFixed(1)+" ºC",rN.d.TS)+
    ci("Humedad relativa 7 días (media)",clima.hr.toFixed(0)+" %",rN.d.HR)+
    `<div class="condition-item"><span>Veto</span><span class="condition-value" title="${vn.map(vtxt).join(" ")}">${vn.length?vn.join(" + "):"Ninguno"} ${badge(rN.veto?0:1)}</span></div>`;
  const di=(k,v)=>`<div class="mushroom-detail-item"><span class="mushroom-detail-label">${k}</span><span class="mushroom-detail-value">${v}</span></div>`;
  const MESESN=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  document.getElementById("detailListN").innerHTML=
    di("Altitud",`${alt!=null?Math.round(alt)+" m":"?"} ${badge(rN.terreno)}`)+
    di("pH del suelo",`${phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH"} ${badge(rN.suelo)}`)+
    di("Estación",`${MESESN[mes-1]} ${badge(rN.temp)}`)+
    di("Cosecha hoy",hubo?`SI · hace 21 días llovió bien ${badge(1)}`:`NO · hace 21 días ${cN.p14<25?"no llovió suficiente":"hizo mal tiempo"} ${badge(0)}`)+
    `<div class="mushroom-detail-item"><span class="mushroom-detail-label">Hábitat</span><span class="mushroom-detail-value" title="${(fuenteHab?fuenteHab+" — ":"")+habitatTxt}">${floraTxt} ${badge(rN.flora)}</span></div>`;
  renderAnalysis();
}
function renderAnalysis(){
  if(!document.getElementById("analysisBody"))return;
  if(!lastCalc||!lastCalc.r)return;
  renderSpeciesSelector();
  const{clima,alt,mes}=lastCalc;
  const MMS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mm=MMS[mes-1];
  const fr=(f,nota,txt)=>`<tr><td>${f}</td><td>${badge(nota)}</td><td style="text-align:left">${txt}</td></tr>`;
  let html="";
  if(specAn==="edulis"){
    const r=lastCalc.r, phV=lastCalc.phVal, floraTxt=lastCalc.floraCat||"sin hábitat conocido";
    html=
    fr("Lluvia 14 días",r.d.P14,`${clima.p14.toFixed(0)} mm caídos: ${clima.p14>=60?"suficiente para disparar":clima.p14>=30?"justa, necesita más agua":"insuficiente"}`)+
    fr("Reserva 30 días",r.d.res,`${clima.p30.toFixed(0)} mm acumulados: ${clima.p30>=70?"el suelo guarda reserva":clima.p30>=30?"reserva a medias":"suelo seco, la primera lluvia solo recarga"}`)+
    fr("Temp aire",r.d.TA,`${clima.ta.toFixed(1)} ºC de media: ${(clima.ta>=10&&clima.ta<=20)?"en ventana otoñal":"fuera de ventana"}`)+
    fr("Temp suelo",r.d.TS,`${clima.ts.toFixed(1)} ºC a 18 cm: ${(clima.ts>=12&&clima.ts<=16)?"óptima, dispara primordios":(clima.ts>=10&&clima.ts<=18)?"aceptable":"fuera de rango"}`)+
    fr("Humedad",r.d.HR,`${clima.hr.toFixed(0)} % de media: ${clima.hr>=75?"suficiente para el primordio":"ambiente seco"}`)+
    fr("Altitud",r.terreno,`${alt!=null?Math.round(alt)+" m":"?"}: ${(alt??1000)>=600&&(alt??1000)<=1800?"en cota del boleto":"fuera de cota"}`)+
    fr("pH del suelo",r.suelo,`${phV!=null?`pH ${phV.toFixed(1)}`:"sin dato"}: ${phV!=null?(phV>=4.5&&phV<=6.5?"ácido ideal":phV<=7.2?"tolerable, al límite":"no apto para boleto"):"sin dato, no penaliza"}`)+
    fr("Hábitat",r.flora,`${floraTxt}: ${r.flora>0?"hay árbol hospedante":"sin hospedante, aquí no fructifica"}`)+
    fr("Estación",r.temp,`${mm}: ${(mes>=9&&mes<=11)?"plena temporada":"fuera de temporada"}`)+
    fr("Veto",r.veto?0:1,r.veto?"activo: anula el clima aunque lo demás acompañe":"ninguno");
  }else{
    const r=lastCalc.rN, phV=lastCalc.phVal, floraTxt=lastCalc.floraCat||"sin hábitat conocido";
    html=
    fr("Lluvia 14 días",r.d.P14,`${clima.p14.toFixed(0)} mm caídos: ${clima.p14>=50?"suficiente para disparar":clima.p14>=25?"justa, necesita más agua":"insuficiente"}`)+
    fr("Reserva 30 días",r.d.res,`${clima.p30.toFixed(0)} mm acumulados: ${clima.p30>=60?"el suelo guarda reserva":clima.p30>=25?"reserva a medias":"suelo seco, la primera lluvia solo recarga"}`)+
    fr("Temp aire",r.d.TA,`${clima.ta.toFixed(1)} ºC de media: ${(clima.ta>=12&&clima.ta<=18)?"en óptimo del níscalo":(clima.ta>=5&&clima.ta<=20)?"tolerable":"fuera de rango"}`)+
    fr("Temp suelo",r.d.TS,`${clima.ts.toFixed(1)} ºC a 18 cm: mismo criterio que el boleto, sin dato propio de la especie`)+
    fr("Humedad",r.d.HR,`${clima.hr.toFixed(0)} % de media: ${clima.hr>=75?"suficiente para el primordio":"ambiente seco"}`)+
    fr("Altitud",r.terreno,`${alt!=null?Math.round(alt)+" m":"?"}: ${(alt??1000)>=100&&(alt??1000)<=1600?"en cota del níscalo":"fuera de cota"}`)+
    fr("pH del suelo",r.suelo,`${phV!=null?`pH ${phV.toFixed(1)}`:"sin dato"}: ${phV!=null?(phV>=4.5&&phV<=8?"dentro de su amplio rango":"fuera de rango"):"sin dato, no penaliza"}`)+
    fr("Hábitat",r.flora,`${floraTxt}: ${r.flora>0?"hay pino hospedante":"sin pino, aquí no fructifica"}`)+
    fr("Estación",r.temp,`${mm}: ${(mes>=9&&mes<=12)?"temporada (pico octubre)":"fuera de temporada"}`)+
    fr("Veto",r.veto?0:1,r.veto?"activo (frío desde −3 ºC): anula el clima":"ninguno");
  }
  document.getElementById("analysisBody").innerHTML=html;
  document.getElementById("anEdulis").className="btn"+(specAn==="edulis"?"":" btn-ghost");
  document.getElementById("anNiscalo").className="btn"+(specAn==="niscalo"?"":" btn-ghost");
}
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  document.getElementById(b.dataset.section).classList.add("active");
  if(b.dataset.section==="dashboard")setTimeout(()=>map.invalidateSize(),50);
});
const SPECIES=[
  {id:"edulis",name:"Boleto / Hongo",latin:"Boletus edulis",color:"#8b4513",card:"cardEdulis",an:"anEdulis"},
  {id:"niscalo",name:"Níscalo / Rovelló",latin:"Lactarius deliciosus",color:"#e07b1a",card:"cardNiscalo",an:"anNiscalo"}
];
const VIS_KEY="especies_visibles_v1";
const getVis=()=>{try{return JSON.parse(localStorage.getItem(VIS_KEY))||{edulis:true,niscalo:true};}catch{return{edulis:true,niscalo:true};}};
function estadoEspecie(id){
  // líneas de estado para el punto actual; null si aún no hay cálculo
  if(!lastCalc||!lastCalc.r)return null;
  const L=[];
  if(id==="edulis"){
    if((lastCalc.floraNota??0.70)===0)L.push("Fuera de su hábitat");
    if(lastCalc.r.temp<0.5)L.push("Fuera de temporada");
    if(!L.length&&lastCalc.r.score<25)L.push("No disponible aquí");
  }else{
    if(!lastCalc.rN)return null;
    if((lastCalc.floraNotaN??0.70)===0)L.push("Fuera de su hábitat");
    if(lastCalc.rN.temp<0.5)L.push("Fuera de temporada");
    if(!L.length&&lastCalc.rN.score<25)L.push("No disponible aquí");
  }
  return L.length?L:["Disponible en este punto"];
}
function renderSpeciesSelector(){
  const vis=getVis(), box=document.getElementById("speciesSelector");
  box.innerHTML=SPECIES.map(sp=>{
    const on=vis[sp.id]!==false, st=estadoEspecie(sp.id);
    return `<label class="mushroom-option${on?" selected":" off"}"><input type="checkbox" data-sp="${sp.id}"${on?" checked":""}>
      <span class="sp-dot" style="background:${sp.color}"></span>
      <span class="mushroom-option-info"><span class="mushroom-option-name">${sp.name}</span><br>
      <span class="mushroom-option-scientific">${sp.latin}</span>
      <span class="sp-status">${st?st.join(" · "):"Pulsa el mapa"}</span></span></label>`;
  }).join("");
  box.querySelectorAll("input").forEach(cb=>cb.onchange=()=>{
    const v=getVis();v[cb.dataset.sp]=cb.checked;
    localStorage.setItem(VIS_KEY,JSON.stringify(v));
    applyVisibility();renderSpeciesSelector();
  });
}
function applyVisibility(){
  const vis=getVis();
  for(const sp of SPECIES){
    const on=vis[sp.id]!==false;
    const card=document.getElementById(sp.card);
    if(card)card.style.display=on?"":"none";
    const an=document.getElementById(sp.an);
    if(an)an.style.display=on?"":"none";
  }
  if(specAn==="niscalo"&&vis.niscalo===false){specAn="edulis";renderAnalysis();}
  if(specAn==="edulis"&&vis.edulis===false){specAn="niscalo";renderAnalysis();}
}
const FAV_KEY="boleto_setales_v1";
const getFavs=()=>{try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch{return[];}};
const saveFavs=f=>localStorage.setItem(FAV_KEY,JSON.stringify(f));
function renderFavs(){
  const f=getFavs();
  document.getElementById("favCount").textContent=f.length||"";
  document.getElementById("favList").innerHTML=f.length?f.map((s,i)=>
    `<div class="favorite-item"><span class="favorite-icon">⭐</span><div class="favorite-info"><div class="favorite-name">${s.name}</div><div class="favorite-coords">${s.lat}, ${s.lon}</div></div><div class="favorite-actions"><button class="favorite-btn load" data-i="${i}">Ir</button><button class="favorite-btn delete" data-d="${i}">Borrar</button></div></div>`
  ).join(""):'<p class="hint-text">Sin setales guardados.</p>';
  document.querySelectorAll("#favList .favorite-btn.load").forEach(b=>b.onclick=()=>{const s=getFavs()[+b.dataset.i];if(s)goTo(s.lat,s.lon,s.name);});
  document.querySelectorAll("#favList .favorite-btn.delete").forEach(b=>b.onclick=()=>{const a=getFavs();a.splice(+b.dataset.d,1);saveFavs(a);renderFavs();});
  renderFavSelect();
}
function renderFavSelect(){
  const sel=document.getElementById("favSelect"), f=getFavs();
  sel.innerHTML='<option value="">⭐ Setales guardados…</option>'+f.map((s,i)=>`<option value="${i}">${s.name}</option>`).join("");
}
document.getElementById("favSelect").addEventListener("change",e=>{
  const s=getFavs()[+e.target.value];
  if(s){goTo(s.lat,s.lon,s.name);e.target.value="";}
});
document.getElementById("saveFavBtn").onclick=()=>{
  const p=document.getElementById("saveFavPanel");p.hidden=!p.hidden;
  document.getElementById("saveFavCoords").textContent=`${lat}, ${lon}`;
};
document.getElementById("saveFavCancel").onclick=()=>{document.getElementById("saveFavPanel").hidden=true;};
document.getElementById("saveFavConfirm").onclick=()=>{
  const name=document.getElementById("saveFavName").value.trim()||`${lat}, ${lon}`;
  const f=getFavs();f.push({name,lat,lon});saveFavs(f);renderFavs();
  document.getElementById("saveFavName").value="";document.getElementById("saveFavPanel").hidden=true;
};
document.getElementById("addFav").onclick=()=>{
  const name=document.getElementById("favName").value.trim();
  const la=parseFloat(document.getElementById("favLat").value),lo=parseFloat(document.getElementById("favLng").value);
  if(!name||isNaN(la)||isNaN(lo))return;
  const f=getFavs();f.push({name,lat:la,lon:lo});saveFavs(f);renderFavs();
  document.getElementById("favName").value="";document.getElementById("favLat").value="";document.getElementById("favLng").value="";
};
document.getElementById("find").onclick=buscar;
document.getElementById("search").addEventListener("keydown",e=>{if(e.key==="Enter")buscar();});
document.getElementById("gps").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>{
  lat=+p.coords.latitude.toFixed(4);lon=+p.coords.longitude.toFixed(4);
  marker.setLatLng([lat,lon]);map.setView([lat,lon],11);predecir();});
renderFavs();
applyVisibility();
renderSpeciesSelector();

// punto inicial: calcula ya con Soria y centra en tu ubicación cuando el GPS responde
predecir();
if(navigator.geolocation){
  navigator.geolocation.getCurrentPosition(p=>{
    lat=+p.coords.latitude.toFixed(4);lon=+p.coords.longitude.toFixed(4);
    marker.setLatLng([lat,lon]);map.setView([lat,lon],11);predecir();
  },()=>{},{timeout:8000});
}

