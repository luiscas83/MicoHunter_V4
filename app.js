// Motor Boletus edulis — port exacto de boletus_engine.py (NO TOCAR pesos)
const FLORA = {"Pinar":1,"Hayedo":1,"Robledal":1,"Castañeral":1,"Quercíneas":0,"Pradera":0,"Pasto":0,"Bosque mixto":1,"Matorral":0}; // binario v1.40: hábitat de la especie = 1, resto = 0
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
const fMes2=m=>m===11?1:m===10?.9:m===9?.85:m===12?.6:m===8?.3:.1;
// --- Oronja (Amanita caesarea): calibrada v1.39 (MicoAragón, sporas.io, Charito, guía de campo).
// Lag 21: primer flush 15-22 d tras tormentas (hasta 40-50 en terreno duro/seco, no modelado)
const ORO_LAG=21;
const fTA3=t=>{if(t<10||t>28)return 0;if(t>=16&&t<=24)return 1;
  if(t>=12&&t<16)return .4+.6*(t-12)/4;if(t>24&&t<=28)return 1-.7*(t-24)/4;return .2;};
const fP14_3=p=>{if(p<30)return 0;if(p<50)return .3+.4*(p-30)/20;if(p<=80)return 1;
  if(p<=160)return 1-.4*(p-80)/80;return .3;};
const fPH3=p=>{if(p>=4&&p<=6)return 1;if(p>6&&p<=7)return .4;if(p>=3.5&&p<4)return .6;return 0;};
const fAlt3=h=>{if(h>=200&&h<=1200)return 1;if(h>1200&&h<=1500)return 1-.5*(h-1200)/300;
  if(h>=100&&h<200)return .6;return 0;};
const fMes3=m=>m===9?1:m===8?.9:m===10?.85:m===7?.5:m===6?.2:.1;
function floraOronja(cat,especies){ // binario v1.40: robledal/castañar/mixto/quercíneas = 1, resto = 0
  const esp=(especies||[]).join(" ").toLowerCase();
  const host=/quercus|castanea/.test(esp);
  if(cat==="Robledal"||cat==="Castañeral"||cat==="Quercíneas")return 1;
  if(cat==="Bosque mixto"||host)return 1;
  return 0;
}
function scoreOronja(o){
  const veto=o.tmin<=2||o.tmax>=28||o.viento;
  const d={P14:fP14_3(o.p14),res:fRes2(o.p30),TA:fTA3(o.ta),TS:fTS(o.ts),HR:fHR(o.hr)};
  let clima=.4*d.P14+.2*d.res+.2*d.TA+.1*d.TS+.1*d.HR; if(veto)clima=0;
  const ter=fAlt3(o.alt),sue=fPH3(o.ph),flo=o.floraNota??0.70,tem=fMes3(o.mes);
  const prob=clima*ter*sue*flo*tem, sc=+(prob*100).toFixed(1);
  return{score:sc,clima:+clima.toFixed(3),d,terreno:ter,suelo:sue,flora:flo,temp:tem,
    veto,vetoList:[...(o.tmin<=2?["Helada"]:[]),...(o.tmax>=28?["Calor"]:[]),...(o.viento?["Viento"]:[])],
    nivel:sc<25?"nulo":sc<50?"regular":sc<75?"bueno":"excelente",pico:sc>=40?ORO_LAG:null};
}
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
    veto:vd.veto,vetoList:vd.list,nivel:sc<25?"nulo":sc<50?"regular":sc<75?"bueno":"excelente",pico:sc>=40?NIS_LAG:null};
}
function score(o){
  const veto=o.tmin<=0||o.tmax>=28||o.viento;
  const d={P14:fP14(o.p14),res:fRes(o.p30),TA:fTA(o.ta),TS:fTS(o.ts),HR:fHR(o.hr)};
  let clima=.4*d.P14+.2*d.res+.2*d.TA+.1*d.TS+.1*d.HR; if(veto)clima=0;
  const ter=fAlt(o.alt),sue=fPH(o.ph),flo=FLORA[o.flora]??0,tem=fMes(o.mes);
  const prob=clima*ter*sue*flo*tem;
  return {score:+(prob*100).toFixed(1),clima:+clima.toFixed(3),d,terreno:ter,suelo:sue,flora:flo,temp:tem,veto,
    pico:prob*100>=40?15:null,nivel:prob*100<25?"nulo":prob*100<50?"regular":prob*100<75?"bueno":"excelente"};
}
// --- helpers ---
async function getJSON(url,ms,headers,reintento){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{signal:c.signal,headers});if(!r.ok)throw new Error("HTTP "+r.status);return await r.json();}
  catch(e){
    if(!reintento&&!/HTTP 4/.test(e.message)){ // un reintento ante fallos de red o 5xx
      await new Promise(r=>setTimeout(r,800));
      return getJSON(url,ms,headers,true);
    }
    throw e;
  }
  finally{clearTimeout(t);}
}
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
function restantes(arr,lag,umb){ // arr cronológico de lluvia diaria terminando hoy: días que faltan al pico
  for(let d=arr.length-1;d>=13;d--){ // día D más reciente cuya ventana de 14 d alcanzó el óptimo
    let s=0;for(let i=d-13;i<=d;i++)s+=arr[i]??0;
    if(s>=umb)return Math.max(0,lag-(arr.length-1-d));
  }
  return lag; // sin disparador claro: el plazo entero
}
// --- 1) Open-Meteo: 30 días atrás + hoy (observado), suelo 18 cm (micorriza) ---
async function fetchClima(la,lo){
  const [d,h,hh]=await Promise.all([
    getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=precipitation_sum,temperature_2m_mean,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,precipitation_probability_max&timezone=auto&past_days=65&forecast_days=8&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`,20000),
    getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=soil_temperature_18cm&timezone=auto&past_days=40&forecast_days=1`,20000),
    getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,wind_speed_10m&timezone=auto&past_days=1&forecast_days=2`,20000).catch(()=>null)
  ]);
  const FD=8, D=d.daily, n=D.time.length-FD; // hoy = len-8 (65 pasado + hoy + 7 futuro)
  const past=k=>D[k].slice(0,n); // 65 días observados (sin hoy)
  const P=past("precipitation_sum").map(v=>v??0);
  const T=past("temperature_2m_mean"), Mx=past("temperature_2m_max"),
        Mn=past("temperature_2m_min"), H=past("relative_humidity_2m_mean").map(v=>v??70),
        W=past("wind_speed_10m_max").map(v=>v??0);
  const hoyP=D.precipitation_sum[n]??0;
  const p14=P.slice(-14).reduce((s,v)=>s+v,0)+hoyP;
  const p30=P.reduce((s,v)=>s+v,0)+hoyP;
  const hist45=P.slice(-44).concat(hoyP); // 45 días terminando hoy, para el disparador
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
  const oT=past("time").slice(-7), oP=past("precipitation_sum").slice(-7),
        oX=past("temperature_2m_max").slice(-7), oN=past("temperature_2m_min").slice(-7);
  const obsDia=oT.map((f,i)=>({f,p:oP[i]??0,tx:oX[i]??null,tn:oN[i]??null}));
  // Hoy por tramos de 3 h (previsión horaria del día en curso)
  let hoyTramos=[];
  try{
    const H2=hh&&hh.hourly, hoyStr=D.time[n];
    if(H2&&H2.time){
      const idx=[];for(let i=0;i<H2.time.length;i++)if(String(H2.time[i]).slice(0,10)===hoyStr)idx.push(i);
      for(const i of idx){
        hoyTramos.push({h:String(H2.time[i]).slice(11,13)+":00",
          ta:H2.temperature_2m[i]??null,pp:H2.precipitation[i]??0,hr:H2.relative_humidity_2m[i]??null,
          w:H2.wind_speed_10m[i]??null,prob:H2.precipitation_probability[i]??null});
      }
    }
  }catch(e){hoyTramos=[];}
  return {p14,p30,ta:avg(t7),ts,hr:avg(H.slice(-7)),tmin:Math.min(...mn7),tmax:Math.max(...mx7),
    vientoMax:Math.max(...W.slice(-7)),hoyP,retro,retro21,ahora,fc,obsDia,hoyTramos,
    restB:restantes(hist45,15,60),restN:restantes(hist45,21,50)};
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
  if(/pinus|larix|pseudotsuga|cedrus|cupressus/.test(t))return{categoria:"Pinar",nota:1};
  if(/fagus/.test(t))return{categoria:"Hayedo",nota:1};
  if(/quercus (robur|petraea|pyrenaica|pubescens|humilis|faginea|rubra)/.test(t))return{categoria:"Robledal",nota:1};
  if(/quercus/.test(t))return{categoria:"Quercíneas",nota:0}; // encina, carrasca, alcornoque y quejigos meridionales: solo oronja
  if(/castanea/.test(t))return{categoria:"Castañeral",nota:1};
  // binario v1.40: lo que no es hábitat (abetal, encinar, sabinar, resto) = 0
  return{categoria:"Matorral",nota:0};
}
const CAT_NOBLE=["Pinar","Hayedo","Robledal","Castañeral","Quercíneas"];
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
  else{categoria="Matorral";nota=0;}
  // acompañantes no nobles para la etiqueta visible (puntuación intacta): abetal, fresneda, etc.
  const COMP_TXT=[[/abies/i,"abetal"],[/fraxinus/i,"fresneda"],[/betula/i,"abedular"],[/corylus/i,"avellaneda"],[/alnus/i,"aliseda"],[/populus/i,"chopera"],[/salix/i,"sauceda"],[/ulmus/i,"olmeda"],[/acer/i,"arceda"],[/tilia/i,"tilar"],[/juniperus/i,"sabinar"],[/eucalyptus/i,"eucaliptal"]];
  const comp=[];
  for(const n of esp.keys()){
    if(categoriaDeEspecie(n).categoria!=="Matorral")continue;
    const f=COMP_TXT.find(([re])=>re.test(n));
    if(f&&!comp.includes(f[1]))comp.push(f[1]);
  }
  const etiqueta=comp.length?`${categoria} + ${comp.slice(0,2).join(" + ")}`:categoria;
  return{hits,especies:[...esp.entries()].map(([n,v])=>({n,...v})),categoria,nota,componentes:nobles,etiqueta};
}
async function mfeUso(la,lo){
  const p=await mfeGFI("ff_uso",la,lo);
  if(!p)return null;
  const txt=((p.descr_clamfe||"")+" "+(p.agrupacion_clamfe||"")+" "+(p.nb_lulucf_nivel1||"")).toLowerCase();
  let clase=null,categoria=null,nota=null;
  if(/artificial|asentamiento|urbano/.test(txt))clase="artificial";
  else if(/dehesa/.test(txt)){clase="dehesa";categoria="Pasto";nota=0;}
  else if(/matorral/.test(txt)){clase="matorral";categoria="Matorral";nota=0;}
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
// --- 6) AEMET OpenData (opcional): pluviómetro real más cercano. Clave gratuita
// en opendata.aemet.es; se guarda SOLO en este navegador (localStorage), nunca en el repo.
const AEMET_BASE="https://opendata.aemet.es/opendata";
const AEMET_KEY="aemet_key_v1", AEMET_INV="aemet_inv_v1";
// Clave ofuscada (invertida + base64) para no dejarla legible en el código.
// Ojo: ofuscación, no cifrado real — el navegador la necesita en claro para llamar a AEMET.
const AEMET_KX="RS04bHF4cUwzTmthd3pucl9FWGhuM2ZkVHlxb0NLdTFLY2VodkZOaFhJcy45SmlJNklTWnM5bWNpd2lJNFlETzFnalo1RURaM01UTXRjVE9tSldMMUFUWTAwU1p5a2pZdGNETWhKRFppVkdNaW9qSWtsa2NsTlhkaXdTTjJJek01TVRNNWNUTTZJQ2RobG1Jc0lDVkYxVVJCSmlPaU0zY3BKQ0wxWWpNek1ETXdBRE94b2pJd2hYWml3aUk0WURPMWdqWjVFRFozTVRNdGNUT21KV0wxQVRZMDBTWnlrall0Y0RNaEpEWmlWR01pb2pJcFJuYWl3aUl0OTJZdXdXYWgxMlpBTkRPekYyWXpsV2RzSmlPaUlXZHpKeWUuOUppTjFJelVJSmlPaWNHYmhKeWU=";
function aemetBuiltin(){try{return atob(AEMET_KX).split("").reverse().join("");}catch{return "";}}
const getAemetKey=()=>{try{const p=(localStorage.getItem(AEMET_KEY)||"").trim();if(p)return p;}catch{}return aemetBuiltin();};
function aemetErrMsg(e){
  const m=String((e&&e.message)||e||"error");
  if(/401/.test(m))return "clave no válida o caducada: consigue una gratis en opendata.aemet.es y guárdala de nuevo";
  if(/429/.test(m))return "límite de peticiones AEMET: espera unos minutos y reintenta";
  return m;
}
async function aemetGet(path,ms){
  const key=getAemetKey();
  if(!key)throw new Error("sin clave");
  const meta=await getJSON(`${AEMET_BASE}${path}${path.includes("?")?"&":"?"}api_key=${encodeURIComponent(key)}`,ms||25000);
  if(!meta||!meta.datos)throw new Error("AEMET estado "+((meta&&meta.estado)||"?"));
  return getJSONLatin(meta.datos,ms||25000); // URL temporal firmada, sin clave
}
async function getJSONLatin(url,ms,reintento){ // AEMET sirve ISO-8859-15: response.json() rompería
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{
    const r=await fetch(url,{signal:c.signal});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return JSON.parse(new TextDecoder("iso-8859-1").decode(await r.arrayBuffer()));
  }catch(e){
    if(!reintento&&!/HTTP 4/.test(e.message)){
      await new Promise(r=>setTimeout(r,800));
      return getJSONLatin(url,ms,true);
    }
    throw e;
  }
  finally{clearTimeout(t);}
}
function havKm(a,b,c,d){const R=6371,r=x=>x*Math.PI/180;
  const h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));}
function coordA(v,esLat){ // formatos AEMET: decimal (coma o punto), GMS, o compacto DDMMSS+NSEWO
  if(v==null)return null;
  const s=String(v).trim().toUpperCase().replace(",",".");
  let m=s.match(/(\d+)[°\s]+(\d+)[’'\s]+([\d.]+)["”\s]*([NSEWO])/);
  if(m){const g=+m[1]+ +m[2]/60+parseFloat(m[3])/3600;return /[SWO]/.test(m[4])?-g:g;}
  m=s.match(/^(\d{2,3})(\d{2})(\d{2})\s*([NSEWO])/);
  if(m){const g=+m[1]+ +m[2]/60+ +m[3]/3600;return /[SWO]/.test(m[4])?-g:g;}
  m=s.match(/^([NSEWO])\s*([\d.]+)/);
  if(m)return /[SWO]/.test(m[1])?-+m[2]:+m[2];
  m=s.match(/([\d.]+)\s*([NSEWO])/);
  if(m)return /[SWO]/.test(m[2])?-+m[1]:+m[1];
  const n=parseFloat(s);
  if(isNaN(n))return null;
  if(esLat&&Math.abs(n)>90||!esLat&&Math.abs(n)>180)return null;
  return n;
}
function numA(v){ // decimales con coma; "Ip" (inapreciable) = 0; vacío = null
  if(v==null)return null;
  const s=String(v).trim();
  if(!s)return null;
  if(/^ip$/i.test(s))return 0;
  const n=parseFloat(s.replace(",","."));
  return isNaN(n)?null:n;
}
let aemetInvMem=null;
async function aemetInventario(){ // ~900 estaciones; caché 90 días
  if(aemetInvMem)return aemetInvMem;
  try{const c=JSON.parse(localStorage.getItem(AEMET_INV)||"null");
    if(c&&Date.now()-c.t<90*864e5&&c.list&&c.list.length){aemetInvMem=c.list;return c.list;}}catch{}
  const list=await aemetGet("/api/valores/climatologicos/inventarioestaciones/todasestaciones");
  const norm=(list||[]).map(e=>({ind:e.indicativo,nombre:e.nombre,
    la:coordA(e.latitud,true),lo:coordA(e.longitud,false)}))
    .filter(e=>e.ind&&e.la!=null&&e.lo!=null);
  if(!norm.length)throw new Error("inventario AEMET vacío");
  aemetInvMem=norm;
  try{localStorage.setItem(AEMET_INV,JSON.stringify({t:Date.now(),list:norm}));}catch{}
  return norm;
}
const aemetDayCache=new Map(); // ind -> {dia, by:{fecha:{prec,tmin,tmax}}}
async function aemetOverride(la,lo){
  // Devuelve {estado:"ok",...} o {estado:"sin-clave"|"lejos"|"pocos-datos"}; lanza en error de red/clave.
  // Solo AEMET, sin mezclas: las ventanas terminan en el último dato del pluviómetro.
  if(!getAemetKey())return{estado:"sin-clave"};
  const inv=await aemetInventario();
  let best=null,bd=1e9;
  for(const e of inv){const d=havKm(la,lo,e.la,e.lo);if(d<bd){bd=d;best=e;}}
  if(!best||bd>25)return{estado:"lejos"};
  const hoy=new Date(), pad=n=>String(n).padStart(2,"0");
  const f=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const ini=new Date(hoy);ini.setDate(ini.getDate()-62);
  let serie=aemetDayCache.get(best.ind);
  if(!serie||serie.dia!==f(hoy)){
    const rows=await aemetGet(`/api/valores/climatologicos/diarios/datos/fechaini/${f(ini)}T00:00:00UTC/fechafin/${f(hoy)}T00:00:00UTC/estacion/${best.ind}`);
    const by={};
    for(const r of rows||[]){if(r&&r.fecha)by[r.fecha.slice(0,10)]={prec:numA(r.prec),tmin:numA(r.tmin),tmax:numA(r.tmax),
      tmed:numA(r.tmed),hrmed:numA(r.hrMedia),racha:numA(r.racha)};}
    serie={dia:f(hoy),by};
    aemetDayCache.set(best.ind,serie);
  }
  const fechas=Object.keys(serie.by).sort();
  if(fechas.length<20)return{estado:"pocos-datos"};
  const ultG=fechas[fechas.length-1];
  const hoy0=new Date();hoy0.setHours(0,0,0,0);
  if(Math.round((hoy0-new Date(ultG+"T00:00:00Z"))/864e5)>10)return{estado:"pocos-datos"}; // estación desactualizada
  const ultD=new Date(ultG+"T00:00:00Z");
  const dia=n=>{const d=new Date(ultD);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
  const rec=k=>serie.by[k];
  const suma=n=>{let s=0,c=0;for(let i=0;i<n;i++){const v=rec(dia(i));if(v&&v.prec!=null){s+=v.prec;c++;}}return{s,c};};
  const ext=n=>{let mn=null,mx=null,c=0;for(let i=0;i<n;i++){const v=rec(dia(i));if(!v)continue;
    if(v.tmin!=null){mn=mn==null?v.tmin:Math.min(mn,v.tmin);}
    if(v.tmax!=null){mx=mx==null?v.tmax:Math.max(mx,v.tmax);}
    if(v.tmin!=null||v.tmax!=null)c++;}return{mn,mx,c};};
  const s14=suma(14), s30=suma(30), e7=ext(7);
  const media=(n,k)=>{let s=0,c=0;for(let i=0;i<n;i++){const v=rec(dia(i));if(v&&v[k]!=null){s+=v[k];c++;}}return{s,c};};
  const rmax=n=>{let m=null,c=0;for(let i=0;i<n;i++){const v=rec(dia(i));if(v&&v.racha!=null){m=m==null?v.racha:Math.max(m,v.racha);c++;}}return{m,c};};
  const ta7=media(7,"tmed"), hr7=media(7,"hrmed"), w7=rmax(7);
  if(s14.c<10||s30.c<20||e7.mn==null||e7.mx==null||e7.c<5)return{estado:"pocos-datos"};
  const retro=lag=>{let p14=0,p30=0,c14=0,mn=null,mx=null,sta=0,shr=0,cta=0,chr=0,vm=null;
    for(let i=0;i<14;i++){const v=rec(dia(lag+i));if(v&&v.prec!=null){p14+=v.prec;c14++;}}
    for(let i=0;i<30;i++){const v=rec(dia(lag+i));if(v&&v.prec!=null)p30+=v.prec;}
    for(let i=0;i<7;i++){const v=rec(dia(lag+i));if(!v)continue;
      if(v.tmin!=null)mn=mn==null?v.tmin:Math.min(mn,v.tmin);
      if(v.tmax!=null)mx=mx==null?v.tmax:Math.max(mx,v.tmax);
      if(v.tmed!=null){sta+=v.tmed;cta++;}
      if(v.hrmed!=null){shr+=v.hrmed;chr++;}
      if(v.racha!=null)vm=vm==null?v.racha:Math.max(vm,v.racha);}
    return{p14,p30,tmin:mn,tmax:mx,ok:c14>=10&&mn!=null&&mx!=null,
      ta:cta>=5?+(sta/cta).toFixed(1):null,hr:chr>=5?+(shr/chr).toFixed(0):null,vmax:vm};};
  const r15=retro(15), r21=retro(21);
  const semana=[];for(let i=6;i>=0;i--){const k=dia(i),v=rec(k);semana.push({f:k,p:v&&v.prec!=null?v.prec:null});}
  const serie45=[];for(let i=43;i>=0;i--){const k=dia(i),v=rec(k);serie45.push(v&&v.prec!=null?v.prec:0);}
  return{estado:"ok",ind:best.ind,est:best.nombre||best.ind,dist:+bd.toFixed(1),fecha:ultG,semana,
    p14:+s14.s.toFixed(1),p30:+s30.s.toFixed(1),tmin:e7.mn,tmax:e7.mx,
    ta:ta7.c>=5?+(ta7.s/ta7.c).toFixed(1):null,hr:hr7.c>=5?+(hr7.s/hr7.c).toFixed(0):null,vmax:w7.m,
    r15,r21,serie45};
}
const aemetLiveCache=new Map(); // ind -> {t, live} (el directo cambia cada hora: TTL 30 min)
async function aemetAhora(ind){ // parte horario en directo: temp/HR/viento ahora + lluvia de hoy
  const c=aemetLiveCache.get(ind);
  if(c&&Date.now()-c.t<30*60e3)return c.live;
  const rows=await aemetGet(`/api/observacion/convencional/datos/estacion/${ind}`);
  if(!rows||!rows.length)throw new Error("sin parte horario");
  const mad=d=>new Date(String(d).replace(/([+-]\d{2})(\d{2})$/,"$1:$2")).toLocaleDateString("en-CA",{timeZone:"Europe/Madrid"});
  const hoyM=mad(new Date());
  let precHoy=0, horas=0;
  for(const r of rows){
    if(r&&r.fint&&mad(r.fint)===hoyM&&r.prec!=null){precHoy+=+r.prec;horas++;}
  }
  const u=rows[rows.length-1];
  const live={ta:u.ta??null,hr:u.hr??null,vv:u.vv??null,vmax:u.vmax??null,
    precHoy:+precHoy.toFixed(1),horas,fint:u.fint||null};
  aemetLiveCache.set(ind,{t:Date.now(),live});
  return live;
}
function renderAemetStatus(txt){const el=document.getElementById("aemetStatus");if(el)el.textContent=txt;}
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
function nivelClase(n){return n==="excelente"?"nivel-alto":n==="bueno"?"nivel-medio":n==="regular"?"nivel-bajo":"nivel-nulo";}
function T2(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function setHTML(id,h){const el=document.getElementById(id);if(el)el.innerHTML=h;}
const VETO_TXT={Helada:"Helada (mínima 7 días ≤ 0 ºC): quema los primordios bajo la hojarasca. El aborto es total, no hay cosecha que salvar.",
Calor:"Calor (máxima 7 días ≥ 28 ºC): deshidrata el micelio y el primordio; a más de 21 ºC en suelo ya aborta, a 28 en aire se veta.",
Viento:"Viento (racha máxima > 45 km/h): seca la seta en horas aunque el suelo esté húmedo. Es el que más cosechas arruina con buena lluvia."};
function nivelIcon(n){return n==="excelente"?"🟢":n==="bueno"?"🟡":n==="regular"?"🟠":"🔴";}
const calcCache=new Map(); // punto -> {t, calc}: sin recargar antes de 10 min
function pintar(calc,ageMin){
  lastCalc=calc;
  const{clima,alt,mes,lugar,fuenteHab,habitatTxt,suelo,floraCat,floraNota,phVal}=calc;
  const floraEtiq=calc.floraEtiq||floraCat;
  const prov=calc.prov||null, live=calc.live||null, am=calc.am||null;
  const det=document.getElementById("habitatLine");
  const DIAS=["dom","lun","mar","mié","jue","vie","sáb"];
  const fcEl=document.getElementById("forecastBody");
  if(fcEl)fcEl.innerHTML=clima.fc.map(f=>{
    const dt=new Date(f.d+"T12:00");
    return `<tr><td>${DIAS[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}</td><td class="num">${f.tx!=null?f.tx.toFixed(0)+"º / "+f.tn.toFixed(0)+"º":"?"}</td><td class="num">${f.pp.toFixed(1)} mm${f.prob!=null?" ("+f.prob+"%)":""}</td><td class="num">${f.w!=null?f.w.toFixed(0)+" km/h":"?"}</td></tr>`;}).join("");
  const T=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  T("locationName",lugar||"Punto manual");
  T("coordinatesValue",`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  T("altitudeValue",alt!=null?Math.round(alt)+" m":"?");
  T("airNowValue",live&&live.ta!=null?live.ta.toFixed(1)+" ºC":(clima.ahora.ta!=null?clima.ahora.ta.toFixed(1)+" ºC":"?"));
  T("humNowValue",live&&live.hr!=null?live.hr+" %":(clima.ahora.hr!=null?clima.ahora.hr+" %":"?"));
  T("windNowValue",live&&live.vv!=null?(live.vv*3.6).toFixed(0)+" km/h"+` · hoy ${live.precHoy.toFixed(1)} mm`:((clima.ahora.viento!=null?clima.ahora.viento.toFixed(0)+" km/h":"?")+(clima.ahora.prec!=null?` · hoy ${clima.ahora.prec.toFixed(1)} mm`:"")));
  const ahT=document.getElementById("airNowValue");
  if(ahT)ahT.title=live&&live.ta!=null?`Directo de ${prov.est}`:"Modelo Open-Meteo";
  T("rain14Value",`${clima.p14.toFixed(0)} mm = ${clima.p14.toFixed(0)} L/m²${prov?` · ${prov.est} (${prov.dist} km)`:""}`);
  T("rain30Value",`${clima.p30.toFixed(0)} mm = ${clima.p30.toFixed(0)} L/m²${prov?` · ${prov.est} (${prov.dist} km)`:""}`);
  const r14t=document.getElementById("rain14Value"), r30t=document.getElementById("rain30Value");
  const rTitle=prov?`Pluviómetro AEMET ${prov.est}, a ${prov.dist} km (datos hasta ${prov.fecha}${prov.hoyParcial?` + hoy ${prov.hoyParcial.mm} parcial`:""})`:"Modelo Open-Meteo (1 mm = 1 L/m²)";
  if(r14t)r14t.title=rTitle;
  if(r30t)r30t.title=rTitle;
  T2("rainSrc",prov?"pluviómetro":"modelo");
  T("metStationValue",prov?`${prov.est} · a ${prov.dist} km`:"Modelo Open-Meteo (rejilla ~10 km)");
  const msEl=document.getElementById("metStationValue");
  if(msEl)msEl.title=(am&&am.estado==="error")?`Modelo Open-Meteo · AEMET falló: ${am.msg||"error de red"}`:rTitle;
  renderAemetStatus(
    !am||am.estado==="sin-clave"?"Sin clave: lluvia según modelo.":
    am.estado==="ok"?`Pluviómetro ${prov.est}, a ${prov.dist} km (hasta ${prov.fecha}${prov.hoyParcial?` + hoy ${prov.hoyParcial.mm} parcial`:""}).`:
    am.estado==="lejos"?"Sin estación AEMET a menos de 25 km: lluvia según modelo.":
    am.estado==="pocos-datos"?"La estación AEMET aún no tiene serie suficiente: lluvia según modelo.":
    `AEMET falló (${am.msg||"error de red"}): lluvia según modelo.`);
  T("soilTypeValue",suelo.textura?`${suelo.textura[0].toUpperCase()+suelo.textura.slice(1)}${suelo.soc!=null?", "+(suelo.soc>=25?"muy fértil":suelo.soc>=12?"fértil":suelo.soc>=6?"fertilidad media":"pobre"):""}`:"?");
  T("phValue",suelo.ph!=null?suelo.ph.toFixed(1):"sin dato");
  if(det){det.textContent=floraEtiq||"sin determinar";det.title=habitatTxt||"";}
  T("lastUpdate",ageMin>0?`Datos de hace ${ageMin} min`:"Actualizado "+new Date().toLocaleString("es-ES"));
  renderAll();
  renderMeteo();
}
async function predecir(etiqueta){
  const det=document.getElementById("habitatLine");
  const ringPctEl=document.getElementById("ringPct"), bannerTxtEl=document.getElementById("bannerTxt");
  const ld=document.getElementById("loader");
  const pkey=lat.toFixed(4)+","+lon.toFixed(4);
  const hit=calcCache.get(pkey); // punto ya visitado: sin red si tiene menos de 10 min
  if(ringPctEl)ringPctEl.textContent="…";
  const rpN=document.getElementById("ringPctN");if(rpN)rpN.textContent="…";
  if(bannerTxtEl)bannerTxtEl.textContent="Detectando parámetros del punto…";
  try{
    if(hit&&Date.now()-hit.t<10*60e3){
      pintar(hit.calc,Math.max(1,Math.round((Date.now()-hit.t)/60e3)));
      return;
    }
    if(ld)ld.hidden=false;
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
      mfe=await mfeBosque(lat,lon,(h,n)=>{if(det)det.textContent=`MFE: ${h}/${n} formaciones…`;});
      mfeCache.set(key,mfe);
    }
    let floraCat=null,floraNota=null,floraEtiq=null,habitatTxt="",fuenteHab="",uso=null,floraNotaN=null,floraNotaO=null;
    if(mfe&&mfe.categoria){
      floraCat=mfe.categoria;floraNota=mfe.nota;floraEtiq=mfe.etiqueta||mfe.categoria;fuenteHab="MFE";
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
    // AEMET (opcional): si hay clave, el pluviómetro manda sobre el modelo en lluvia y extremos
    let am=null;
    try{am=await aemetOverride(lat,lon);}
    catch(e){console.warn("AEMET:",e);am={estado:"error",msg:aemetErrMsg(e)};}
    const prov=(am&&am.estado==="ok")?am:null;
    let live=null;
    if(prov){
      try{live=await aemetAhora(prov.ind);}catch(e){live=null;}
      // Hoy parcial del parte horario (mismo pluviómetro): la ventana termina hoy, no en el último diario
      if(live&&live.horas>0&&live.precHoy!=null){
        prov.hoyParcial={mm:live.precHoy,horas:live.horas};
        clima.p14=+(prov.p14+live.precHoy).toFixed(1);
        clima.p30=+(prov.p30+live.precHoy).toFixed(1);
      }else{
        clima.p14=prov.p14;clima.p30=prov.p30;
      }
      const arr45=[...prov.serie45];
      if(prov.hoyParcial)arr45.push(prov.hoyParcial.mm);
      const gapD=Math.max(0,Math.round((Date.now()-new Date(prov.fecha+"T00:00:00Z"))/864e5));
      clima.restB=Math.max(0,restantes(arr45,15,60)-gapD);
      clima.restN=Math.max(0,restantes(arr45,21,50)-gapD);
      clima.tmin=prov.tmin;clima.tmax=prov.tmax;
      if(prov.ta!=null)clima.ta=prov.ta;
      if(prov.hr!=null)clima.hr=prov.hr;
      if(prov.vmax!=null)clima.vientoMax=prov.vmax;
      Object.assign(clima.retro,{p14:prov.r15.p14,p30:prov.r15.p30});
      Object.assign(clima.retro21,{p14:prov.r21.p14,p30:prov.r21.p30});
      if(prov.r15.ok)Object.assign(clima.retro,{tmin:prov.r15.tmin,tmax:prov.r15.tmax});
      if(prov.r21.ok)Object.assign(clima.retro21,{tmin:prov.r21.tmin,tmax:prov.r21.tmax});
      for(const par of[[clima.retro,prov.r15],[clima.retro21,prov.r21]]){
        if(par[1].ta!=null)par[0].ta=par[1].ta;
        if(par[1].hr!=null)par[0].hr=par[1].hr;
        if(par[1].vmax!=null)par[0].vientoMax=par[1].vmax;
      }
    }
    const mes=new Date().getMonth()+1;
    if(mfe&&mfe.categoria)floraNotaN=floraNiscalo(mfe.categoria,mfe.componentes);
    else if(uso&&uso.categoria)floraNotaN=uso.categoria==="Pinar"?1:0;
    const floraEsp=mfe&&mfe.especies?mfe.especies.map(e=>e.n):(uso&&uso.sp1?[uso.sp1]:[]);
    if(mfe&&mfe.categoria)floraNotaO=floraOronja(mfe.categoria,floraEsp);
    else if(uso&&uso.categoria)floraNotaO=(uso.categoria==="Robledal"||uso.categoria==="Castañeral"||uso.categoria==="Quercíneas"||/quercus|castanea/i.test(uso.sp1||""))?1:0;
    const calc={clima,alt,mes,lugar:lugar||etiqueta||"",fuenteHab,habitatTxt,suelo,
      floraCat,floraEtiq:floraEtiq||floraCat,floraNota,floraNotaN,floraNotaO,phVal:suelo.ph??null,prov,live,am};
    calcCache.set(pkey,{t:Date.now(),calc});
    if(calcCache.size>50)calcCache.delete(calcCache.keys().next().value);
    pintar(calc,0);
  }catch(e){
    console.error("predecir:",e);
    const cEl=document.getElementById("condList"), bEl=document.getElementById("bannerTxt");
    if(cEl)cEl.innerHTML=`<div class="alert-box">Error red/API: ${e.message}. Revisa conexión y reintenta (F12 → Console para detalle).</div>`;
    if(bEl)bEl.textContent="No se pudo calcular.";
  }finally{
    const ld2=document.getElementById("loader");if(ld2)ld2.hidden=true;
  }
}
function resumenCond(r, clima, o){
  const ok=[], mid=[], mal=[];
  const put=(txt,n)=>{(n>=0.8?ok:n>=0.4?mid:mal).push(txt);};
  put(`lluvia ${clima.p14.toFixed(0)} mm`,r.d.P14);
  put(`reserva ${clima.p30.toFixed(0)} mm`,r.d.res);
  put(`aire ${clima.ta.toFixed(1)} ºC`,r.d.TA);
  put(`suelo ${clima.ts.toFixed(1)} ºC`,r.d.TS);
  put(`humedad ${clima.hr.toFixed(0)} %`,r.d.HR);
  put(`altitud ${o.altTxt}`,r.terreno);
  put(o.sueloTxt,r.suelo);
  put(`hábitat: ${o.floraTxt}`,r.flora);
  put(`estación: ${o.mesTxt}`,r.temp);
  let h="";
  if(ok.length)h+=`<div><span class="ok">✓ Cumple:</span> ${ok.join(" · ")}</div>`;
  if(mid.length)h+=`<div><span class="mid">~ A medias:</span> ${mid.join(" · ")}</div>`;
  if(mal.length)h+=`<div><span class="bad">✗ Falla:</span> ${mal.join(" · ")}</div>`;
  if(o.vetoTxt)h+=`<div><span class="bad">⛔ Veto:</span> ${o.vetoTxt}</div>`;
  h+=`<div>${o.cosecha}</div>`;
  return h;
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
  r.nivel=r.score<25?"nulo":r.score<50?"regular":r.score<75?"bueno":"excelente";
  r.pico=r.score>=40?15:null;
  const floraTxt=lastCalc.floraEtiq||floraCat||"sin hábitat conocido", sueloTxt=phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH";
  const rf=document.getElementById("ringFill");if(rf)rf.style.strokeDasharray=`${(r.score/100*RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  T2("ringPct",r.score);T2("ringNivel",r.nivel);
  const banner=document.getElementById("banner");
  if(banner)banner.className="prediction-banner "+nivelClase(r.nivel);
  // lectura hacia atrás: con lo de hace 15 días, ¿toca cosecha hoy?
  const cR=clima.retro;
  const rR=score({p14:cR.p14,p30:cR.p30,ta:cR.ta,ts:cR.ts,hr:cR.hr,alt:alt??1000,
    ph:phV??6.0,flora:"Matorral",tmin:cR.tmin,tmax:cR.tmax,viento:cR.vientoMax>45,mes});
  rR.suelo=phV!=null?rR.suelo:1.0;
  rR.flora=floraNota??0.70;
  rR.score=+(rR.clima*rR.terreno*rR.suelo*rR.flora*rR.temp*100).toFixed(1);
  const hoy=r.score>=40, hubo=rR.score>=40;
  lastCalc.r=r;lastCalc.rR=rR;lastCalc.cR=cR;
  const rb=clima.restB??15;
  T2("bannerTxt",
    hoy&&hubo?`En pico: salir ya. ${rb} días estimados para fructificación.`:
    !hoy&&hubo?`El pico es ahora; la ventana se cierra.`:
    hoy&&!hubo?`Sin cosecha hoy. ${rb} días estimados para fructificación.`:
    `Sin ventana de fructificación.`);
  const ci=(k,v,n)=>`<div class="condition-item"><span>${k}</span><span class="condition-value">${v} ${badge(n)}</span></div>`;
  setHTML("condList",
    ci("Lluvia 14 días",clima.p14.toFixed(0)+" mm",r.d.P14)+ci("Reserva lluvia 30 días",clima.p30.toFixed(0)+" mm",r.d.res)+
    ci("Temp aire 7 días (media)",clima.ta.toFixed(1)+" ºC",r.d.TA)+ci("Temp suelo 18 cm 7 días (media)",clima.ts.toFixed(1)+" ºC",r.d.TS)+
    ci("Humedad relativa 7 días (media)",clima.hr.toFixed(0)+" %",r.d.HR)+(()=>{const v=[];if(clima.tmin<=0)v.push("Helada");if(clima.tmax>=28)v.push("Calor");if(clima.vientoMax>45)v.push("Viento");
    return `<div class="condition-item"><span>Veto</span><span class="condition-value" title="${v.map(x=>VETO_TXT[x]).join(" ")}">${v.length?v.join(" + "):"Ninguno"} ${badge(r.veto?0:1)}</span></div>`;})());
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const di=(k,v)=>`<div class="mushroom-detail-item"><span class="mushroom-detail-label">${k}</span><span class="mushroom-detail-value">${v}</span></div>`;
  setHTML("detailList",
    di("Altitud",`${alt!=null?Math.round(alt)+" m":"?"} ${badge(r.terreno)}`)+
    di("pH del suelo",`${sueloTxt} ${badge(r.suelo)}`)+
    di("Estación",`${MESES[mes-1]} ${badge(r.temp)}`)+di("Cosecha hoy",hubo?`SI · hace 15 días llovió bien ${badge(1)}`:`NO · hace 15 días ${cR.p14<30?"no llovió suficiente":"hizo mal tiempo"} ${badge(0)}`)+`<div class="mushroom-detail-item"><span class="mushroom-detail-label">Hábitat</span><span class="mushroom-detail-value" title="${(fuenteHab?fuenteHab+" — ":"")+habitatTxt}">${floraTxt} ${badge(r.flora)}</span></div>`);
  const vetE=[];if(clima.tmin<=0)vetE.push("helada");if(clima.tmax>=28)vetE.push("calor");if(clima.vientoMax>45)vetE.push("viento fuerte");
  const vetRE=[];if(cR.tmin<=0)vetRE.push("helada");if(cR.tmax>=28)vetRE.push("calor");if(cR.vientoMax>45)vetRE.push("viento fuerte");
  setHTML("verdictEdulis",resumenCond(r,clima,{
    altTxt:alt!=null?Math.round(alt)+" m":"?",sueloTxt:phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH",
    floraTxt:floraTxt,mesTxt:MESES[mes-1],
    vetoTxt:vetE.length?vetE.join(" + "):null,
    cosecha:hubo?`Cosecha hoy: sí, hace 15 días el agua acompañó.`:
      cR.p14<30?`Cosecha hoy: no, hace 15 días apenas cayeron ${cR.p14.toFixed(0)} mm.`:
      vetRE.length?`Cosecha hoy: no, hace 15 días hubo ${vetRE.join(" + ")}.`:
      `Cosecha hoy: no, hace 15 días falló la temperatura.`}));
  renderAnalysis();
  renderNiscalo();
  renderOronja();
}
function renderMeteo(){
  if(!document.getElementById("metTitle"))return;
  if(!lastCalc){T2("metTitle","Pulsa el mapa para ver la meteo del punto.");return;}
  const{clima,alt}=lastCalc, prov=lastCalc.prov||null;
  const DIAS=["dom","lun","mar","mié","jue","vie","sáb"];
  const fD=s=>{const d=new Date(String(s).slice(0,10)+"T12:00");return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;};
  T2("metTitle",(lastCalc.lugar?lastCalc.lugar.split(",").slice(0,2).join(","):"Punto")+` · ${lat.toFixed(4)}, ${lon.toFixed(4)}`+(alt!=null?` · ${Math.round(alt)} m`:"")+(prov?` · ${prov.est} (${prov.dist} km)`:""));
  const tramos=clima.hoyTramos||[];
  setHTML("metNow",tramos.length?
    `<div class="table-wrapper"><table class="param-table"><thead><tr><th>Hora</th><th style="text-align:right">Temp</th><th style="text-align:right">Lluvia</th><th style="text-align:right">HR</th><th style="text-align:right">Viento</th></tr></thead><tbody>`+
    tramos.map(s=>`<tr><td>${s.h}</td><td class="num">${s.ta!=null?s.ta.toFixed(0)+"º":"—"}</td><td class="num">${s.pp.toFixed(1)} mm${s.prob!=null?" ("+s.prob+"%)":""}</td><td class="num">${s.hr!=null?s.hr.toFixed(0)+" %":"—"}</td><td class="num">${s.w!=null?s.w.toFixed(0)+" km/h":"—"}</td></tr>`).join("")+
    `</tbody></table></div>`
    :`<p class="hint-text">Tramos horarios no disponibles.</p>`);
  const fcD=(clima.fc||[]);
  setHTML("metFcBody",fcD.map(f=>`<tr><td>${fD(f.d)}</td><td class="num">${f.tx!=null?f.tx.toFixed(0)+"º / "+f.tn.toFixed(0)+"º":"—"}</td><td class="num">${f.pp.toFixed(1)} mm</td><td class="num">${f.prob!=null?f.prob+" %":"—"}</td><td class="num">${f.w!=null?f.w.toFixed(0)+" km/h":"—"}</td></tr>`).join(""));
  const sem={};if(prov&&prov.semana)for(const s of prov.semana)sem[s.f]=s.p;
  let ac=0;
  const obsRows=(clima.obsDia||[]).map(o=>{
    const g=sem[o.f], p=g!=null?g:o.p;
    if(p!=null)ac+=p;
    return{f:o.f,p,tx:o.tx,tn:o.tn,ac};
  });
  setHTML("metObsBody",obsRows.map(o=>`<tr><td>${fD(o.f)}</td><td class="num">${o.p!=null?o.p.toFixed(1)+" mm"+(sem[o.f]!=null?" *":""):"—"}</td><td class="num">${o.tx!=null?o.tx.toFixed(0)+"º / "+o.tn.toFixed(0)+"º":"—"}</td><td class="num">${o.ac.toFixed(1)} mm</td></tr>`).join(""));
  T2("metNote",prov?`* lluvia de pluviómetro AEMET ${prov.est} (el cálculo usa el pluviómetro; el resto, modelo).`:`Observado y previsión del modelo (sin pluviómetro AEMET en 25 km).`);
}
let specAn="edulis";
function renderNiscalo(){
  if(!lastCalc)return;
  const{clima,alt,mes,fuenteHab,habitatTxt}=lastCalc;
  const phV=lastCalc.phVal, fN=lastCalc.floraNotaN;
  const floraTxt=lastCalc.floraEtiq||lastCalc.floraCat||"sin hábitat conocido";
  const base={alt:alt??1000,ph:phV??6.0,mes};
  const rN=scoreNiscalo({p14:clima.p14,p30:clima.p30,ta:clima.ta,ts:clima.ts,hr:clima.hr,
    ...base,tmin:clima.tmin,tmax:clima.tmax,vientoMax:clima.vientoMax,floraNota:fN??0.70});
  const cN=clima.retro21;
  const rNR=scoreNiscalo({p14:cN.p14,p30:cN.p30,ta:cN.ta,ts:cN.ts,hr:cN.hr,
    ...base,tmin:cN.tmin,tmax:cN.tmax,vientoMax:cN.vientoMax,floraNota:fN??0.70});
  const hoy=rN.score>=40, hubo=rNR.score>=40;
  lastCalc.rN=rN;lastCalc.rNR=rNR;lastCalc.cRN=cN;
  const rfN=document.getElementById("ringFillN");if(rfN)rfN.style.strokeDasharray=`${(rN.score/100*RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  T2("ringPctN",rN.score);
  T2("ringNivelN",rN.nivel);
  const bN=document.getElementById("bannerN");if(bN)bN.className="prediction-banner "+nivelClase(rN.nivel);
  const rn=clima.restN??21;
  T2("bannerTxtN",
    hoy&&hubo?`En pico: salir ya. ${rn} días estimados para fructificación.`:
    !hoy&&hubo?`El pico es ahora; la ventana se cierra.`:
    hoy&&!hubo?`Sin cosecha hoy. ${rn} días estimados para fructificación.`:
    `Sin ventana de fructificación.`);
  const vn=[];if(clima.tmin<=-3)vn.push("Helada");if(clima.tmax>=28)vn.push("Calor");if(clima.vientoMax>45)vn.push("Viento");
  const vtxt=n=>n==="Helada"?"Helada con mínimas de −3 ºC o menos: quema los primordios. El aborto es total.":VETO_TXT[n];
  const ci=(k,v,n)=>`<div class="condition-item"><span>${k}</span><span class="condition-value">${v} ${badge(n)}</span></div>`;
  setHTML("condListN",
    ci("Lluvia 14 días",clima.p14.toFixed(0)+" mm",rN.d.P14)+ci("Reserva lluvia 30 días",clima.p30.toFixed(0)+" mm",rN.d.res)+
    ci("Temp aire 7 días (media)",clima.ta.toFixed(1)+" ºC",rN.d.TA)+ci("Temp suelo 18 cm 7 días (media)",clima.ts.toFixed(1)+" ºC",rN.d.TS)+
    ci("Humedad relativa 7 días (media)",clima.hr.toFixed(0)+" %",rN.d.HR)+
    `<div class="condition-item"><span>Veto</span><span class="condition-value" title="${vn.map(vtxt).join(" ")}">${vn.length?vn.join(" + "):"Ninguno"} ${badge(rN.veto?0:1)}</span></div>`);
  const di=(k,v)=>`<div class="mushroom-detail-item"><span class="mushroom-detail-label">${k}</span><span class="mushroom-detail-value">${v}</span></div>`;
  const MESESN=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  setHTML("detailListN",
    di("Altitud",`${alt!=null?Math.round(alt)+" m":"?"} ${badge(rN.terreno)}`)+
    di("pH del suelo",`${phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH"} ${badge(rN.suelo)}`)+
    di("Estación",`${MESESN[mes-1]} ${badge(rN.temp)}`)+
    di("Cosecha hoy",hubo?`SI · hace 21 días llovió bien ${badge(1)}`:`NO · hace 21 días ${cN.p14<25?"no llovió suficiente":"hizo mal tiempo"} ${badge(0)}`)+
    `<div class="mushroom-detail-item"><span class="mushroom-detail-label">Hábitat</span><span class="mushroom-detail-value" title="${(fuenteHab?fuenteHab+" — ":"")+habitatTxt}">${floraTxt} ${badge(rN.flora)}</span></div>`);
  const vetRN=[];if(cN.tmin<=-3)vetRN.push("helada");if(cN.tmax>=28)vetRN.push("calor");if(cN.vientoMax>45)vetRN.push("viento fuerte");
  setHTML("verdictNiscalo",resumenCond(rN,clima,{
    altTxt:alt!=null?Math.round(alt)+" m":"?",sueloTxt:phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH",
    floraTxt:floraTxt||"sin hábitat conocido",mesTxt:MESESN[mes-1],
    vetoTxt:vn.length?vn.join(" + "):null,
    cosecha:hubo?`Cosecha hoy: sí, hace 21 días el agua acompañó.`:
      cN.p14<25?`Cosecha hoy: no, hace 21 días apenas cayeron ${cN.p14.toFixed(0)} mm.`:
      vetRN.length?`Cosecha hoy: no, hace 21 días hubo ${vetRN.join(" + ")}.`:
      `Cosecha hoy: no, hace 21 días falló la temperatura.`}));
  renderAnalysis();
}
function renderOronja(){
  if(!lastCalc)return;
  const{clima,alt,mes,fuenteHab,habitatTxt}=lastCalc;
  const phV=lastCalc.phVal, fO=lastCalc.floraNotaO;
  const floraTxt=lastCalc.floraEtiq||lastCalc.floraCat||"sin hábitat conocido";
  const base={alt:alt??1000,ph:phV??5.0,mes};
  const rO=scoreOronja({p14:clima.p14,p30:clima.p30,ta:clima.ta,ts:clima.ts,hr:clima.hr,
    ...base,tmin:clima.tmin,tmax:clima.tmax,viento:clima.vientoMax>45,floraNota:fO??0.70});
  const cO=clima.retro21;
  const rOR=scoreOronja({p14:cO.p14,p30:cO.p30,ta:cO.ta,ts:cO.ts,hr:cO.hr,
    ...base,tmin:cO.tmin,tmax:cO.tmax,viento:cO.vientoMax>45,floraNota:fO??0.70});
  const hoy=rO.score>=40, hubo=rOR.score>=40;
  lastCalc.rO=rO;lastCalc.rOR=rOR;lastCalc.cRO=cO;
  const rfO=document.getElementById("ringFillO");if(rfO)rfO.style.strokeDasharray=`${(rO.score/100*RING_C).toFixed(1)} ${RING_C.toFixed(1)}`;
  T2("ringPctO",rO.score);
  T2("ringNivelO",rO.nivel);
  const bO=document.getElementById("bannerO");if(bO)bO.className="prediction-banner "+nivelClase(rO.nivel);
  const ro=clima.restN??ORO_LAG;
  T2("bannerTxtO",
    hoy&&hubo?`En pico: salir ya. ${ro} días estimados para fructificación.`:
    !hoy&&hubo?`El pico es ahora; la ventana se cierra.`:
    hoy&&!hubo?`Sin cosecha hoy. ${ro} días estimados para fructificación.`:
    `Sin ventana de fructificación.`);
  const vo=[];if(clima.tmin<=2)vo.push("Helada");if(clima.tmax>=28)vo.push("Calor");if(clima.vientoMax>45)vo.push("Viento");
  const vtx=n=>n==="Helada"?"Helada con mínimas de +2 ºC o menos: es termófila y aborta.":VETO_TXT[n];
  const ci=(k,v,n)=>`<div class="condition-item"><span>${k}</span><span class="condition-value">${v} ${badge(n)}</span></div>`;
  setHTML("condListO",
    ci("Lluvia 14 días",clima.p14.toFixed(0)+" mm",rO.d.P14)+ci("Reserva lluvia 30 días",clima.p30.toFixed(0)+" mm",rO.d.res)+
    ci("Temp aire 7 días (media)",clima.ta.toFixed(1)+" ºC",rO.d.TA)+ci("Temp suelo 18 cm 7 días (media)",clima.ts.toFixed(1)+" ºC",rO.d.TS)+
    ci("Humedad relativa 7 días (media)",clima.hr.toFixed(0)+" %",rO.d.HR)+
    `<div class="condition-item"><span>Veto</span><span class="condition-value" title="${vo.map(vtx).join(" ")}">${vo.length?vo.join(" + "):"Ninguno"} ${badge(rO.veto?0:1)}</span></div>`);
  const di=(k,v)=>`<div class="mushroom-detail-item"><span class="mushroom-detail-label">${k}</span><span class="mushroom-detail-value">${v}</span></div>`;
  const MESO=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  setHTML("detailListO",
    di("Altitud",`${alt!=null?Math.round(alt)+" m":"?"} ${badge(rO.terreno)}`)+
    di("pH del suelo",`${phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH"} ${badge(rO.suelo)}`)+
    di("Estación",`${MESO[mes-1]} ${badge(rO.temp)}`)+
    di("Cosecha hoy",hubo?`SI · hace 21 días llovió bien ${badge(1)}`:`NO · hace 21 días ${cO.p14<30?"no llovió suficiente":"hizo mal tiempo"} ${badge(0)}`)+
    `<div class="mushroom-detail-item"><span class="mushroom-detail-label">Hábitat</span><span class="mushroom-detail-value" title="${(fuenteHab?fuenteHab+" — ":"")+habitatTxt}">${floraTxt} ${badge(rO.flora)}</span></div>`);
  const vetRO=[];if(cO.tmin<=2)vetRO.push("helada");if(cO.tmax>=28)vetRO.push("calor");if(cO.vientoMax>45)vetRO.push("viento fuerte");
  setHTML("verdictOronja",resumenCond(rO,clima,{
    altTxt:alt!=null?Math.round(alt)+" m":"?",sueloTxt:phV!=null?`pH ${phV.toFixed(1)}`:"sin dato de pH",
    floraTxt:floraTxt,mesTxt:MESO[mes-1],
    vetoTxt:vo.length?vo.join(" + "):null,
    cosecha:hubo?`Cosecha hoy: sí, hace 21 días el agua acompañó.`:
      cO.p14<30?`Cosecha hoy: no, hace 21 días apenas cayeron ${cO.p14.toFixed(0)} mm.`:
      vetRO.length?`Cosecha hoy: no, hace 21 días hubo ${vetRO.join(" + ")}.`:
      `Cosecha hoy: no, hace 21 días falló la temperatura.`}));
  renderAnalysis();
}
function renderAnalysis(){
  try{renderSpeciesSelector();}catch(e){console.warn("speciesSelector:",e);}
  if(!document.getElementById("analysisBody"))return;
  if(!lastCalc||!lastCalc.r)return;
  const{clima,alt,mes}=lastCalc;
  const MMS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mm=MMS[mes-1];
  const fr=(f,nota,txt)=>`<tr><td>${f}</td><td>${badge(nota)}</td><td style="text-align:left">${txt}</td></tr>`;
  let html="";
  if(specAn==="edulis"){
    const r=lastCalc.r, phV=lastCalc.phVal, floraTxt=lastCalc.floraEtiq||lastCalc.floraCat||"sin hábitat conocido";
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
    const r=lastCalc.rN, phV=lastCalc.phVal, floraTxt=lastCalc.floraEtiq||lastCalc.floraCat||"sin hábitat conocido";
    html=
    fr("Lluvia 14 días",r.d.P14,`${clima.p14.toFixed(0)} mm caídos: ${clima.p14>=50?"suficiente para disparar":clima.p14>=25?"justa, necesita más agua":"insuficiente"}`)+
    fr("Reserva 30 días",r.d.res,`${clima.p30.toFixed(0)} mm acumulados: ${clima.p30>=60?"el suelo guarda reserva":clima.p30>=25?"reserva a medias":"suelo seco, la primera lluvia solo recarga"}`)+
    fr("Temp aire",r.d.TA,`${clima.ta.toFixed(1)} ºC de media: ${(clima.ta>=12&&clima.ta<=18)?"en óptimo del níscalo":(clima.ta>=5&&clima.ta<=20)?"tolerable":"fuera de rango"}`)+
    fr("Temp suelo",r.d.TS,`${clima.ts.toFixed(1)} ºC a 18 cm: mismo criterio que el boleto, sin dato propio de la especie`)+
    fr("Humedad",r.d.HR,`${clima.hr.toFixed(0)} % de media: ${clima.hr>=75?"suficiente para el primordio":"ambiente seco"}`)+
    fr("Altitud",r.terreno,`${alt!=null?Math.round(alt)+" m":"?"}: ${(alt??1000)>=100&&(alt??1000)<=1600?"en cota del níscalo":"fuera de cota"}`)+
    fr("pH del suelo",r.suelo,`${phV!=null?`pH ${phV.toFixed(1)}`:"sin dato"}: ${phV!=null?(phV>=4.5&&phV<=8?"dentro de su amplio rango":"fuera de rango"):"sin dato, no penaliza"}`)+
    fr("Hábitat",r.flora,`${floraTxt}: ${r.flora>0?"hay pino hospedante":"sin pino, aquí no fructifica"}`)+
    fr("Estación",r.temp,`${mm}: ${(mes>=9&&mes<=12)?"temporada (pico noviembre)":"fuera de temporada"}`)+
    fr("Veto",r.veto?0:1,r.veto?"activo (frío desde −3 ºC): anula el clima":"ninguno");
  }
  document.getElementById("analysisBody").innerHTML=html;
  const ae=document.getElementById("anEdulis"), an=document.getElementById("anNiscalo");
  if(ae)ae.className="btn"+(specAn==="edulis"?"":" btn-ghost");
  if(an)an.className="btn"+(specAn==="niscalo"?"":" btn-ghost");
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
  {id:"niscalo",name:"Níscalo / Rovelló",latin:"Lactarius deliciosus",color:"#e07b1a",card:"cardNiscalo",an:"anNiscalo"},
  {id:"oronja",name:"Oronja / Huevo de rey",latin:"Amanita caesarea",color:"#d4a017",card:"cardOronja",an:"anOronja"}
];
const VIS_KEY="especies_visibles_v1";
const getVis=()=>{try{return JSON.parse(localStorage.getItem(VIS_KEY))||{edulis:true,niscalo:true,oronja:true};}catch{return{edulis:true,niscalo:true,oronja:true};}};
function estadoEspecie(id){
  // líneas de estado para el punto actual; null si aún no hay cálculo
  if(!lastCalc||!lastCalc.r)return null;
  const L=[];
  if(id==="edulis"){
    if((lastCalc.floraNota??0.70)===0)L.push("Fuera de su hábitat");
    if(lastCalc.r.temp<0.5)L.push("Fuera de temporada");
    if(!L.length&&lastCalc.r.score<25)L.push("No disponible aquí");
  }else if(id==="niscalo"){
    if(!lastCalc.rN)return null;
    if((lastCalc.floraNotaN??0.70)===0)L.push("Fuera de su hábitat");
    if(lastCalc.rN.temp<0.5)L.push("Fuera de temporada");
    if(!L.length&&lastCalc.rN.score<25)L.push("No disponible aquí");
  }else{
    if(!lastCalc.rO)return null;
    if((lastCalc.floraNotaO??0.70)===0)L.push("Fuera de su hábitat");
    if(lastCalc.rO.temp<0.5)L.push("Fuera de temporada");
    if(!L.length&&lastCalc.rO.score<25)L.push("No disponible aquí");
  }
  return L.length?L:["Disponible en este punto"];
}
function renderSpeciesSelector(){
  const vis=getVis(), box=document.getElementById("speciesSelector");
  if(!box)return;
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
  if(!sel)return;
  const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
  const cs=typeof COTOS!=="undefined"?COTOS:[];
  const CCAA=["Castilla y León","Aragón","Navarra","Comunidad de Madrid","Cataluña"];
  const grupos=CCAA.map(cc=>{
    const l=cs.map((c,i)=>({c,i})).filter(x=>x.c.ccaa===cc);
    return l.length?`<optgroup label="🍄 ${cc} · de pago">${l.map(x=>`<option value="c${x.i}">🍄 ${esc(x.c.n)}</option>`).join("")}</optgroup>`:"";
  }).join("");
  sel.innerHTML='<option value="">⭐ Setales y cotos…</option>'+
    '<optgroup label="⭐ Mis setales">'+f.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join("")+'</optgroup>'+grupos;
}
document.getElementById("favSelect").addEventListener("change",e=>{
  const v=e.target.value;
  if(v.startsWith("c")){
    const c=(typeof COTOS!=="undefined"?COTOS:[])[+v.slice(1)];
    if(c){goTo(c.la,c.lo,c.n);e.target.value="";}
    return;
  }
  const s=getFavs()[+v];
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

// punto inicial: Soria; la ubicación solo con el botón GPS
predecir();

