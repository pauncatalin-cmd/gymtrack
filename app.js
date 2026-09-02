const EX=[
 {type:'cardio',name:'Alergare pe bandă',muscle:'Încălzire',image:'assets/treadmill.svg',minutes:10,guide:'Aleargă 10 minute într-un ritm confortabil. Scopul este să te încălzești pentru antrenament.'},
 {name:'Fluturări la aparat',sub:'Butterfly cu mânere',muscle:'Piept',image:'assets/butterfly_transparent.png',sets:3,reps:'10-12',weight:'30-35',rest:90,guide:'Ține spatele lipit de spătar. Adu mânerele în față controlat și revino lent.'},
 {name:'Flexii biceps la aparat',sub:'Bizepsmaschine',muscle:'Biceps',image:'assets/biceps_transparent.png',sets:3,reps:'10-12',weight:'25-30',rest:90,guide:'Ține brațele pe suport și coatele stabile. Ridică greutatea fără balans.'},
 {name:'Presă pentru picioare',sub:'Beinpresse',muscle:'Picioare',image:'assets/presa_picioare_transparent.png',sets:3,reps:'10-12',weight:'60',rest:90,guide:'Ține spatele pe spătar. Coboară controlat și împinge prin toată talpa.'},
 {name:'Ramat la aparat',sub:'Rudern',muscle:'Spate',image:'assets/ramat_transparent.png',sets:3,reps:'10-12',weight:'35-40',rest:90,guide:'Ține pieptul stabil și trage mânerele spre trunchi. Apropie omoplații.'},
 {name:'Presă pentru piept',sub:'Brustpresse',muscle:'Piept',image:'assets/presa_piept_transparent.png',sets:3,reps:'10-12',weight:'30-35',rest:90,guide:'Reglează scaunul cu mânerele la nivelul pieptului. Împinge controlat.'},
 {name:'Tracțiuni la helcometru',sub:'Latzug',muscle:'Spate',image:'assets/helcometru_transparent.png',sets:3,reps:'10-12',weight:'50',rest:90,guide:'Fixează coapsele și trage bara spre partea superioară a pieptului, fără balans.'},
 {name:'Flexii pentru picioare la aparat',sub:'Beinbeuger / Leg Curl',muscle:'Femurali',image:'assets/beinbeuger_transparent.png',sets:3,reps:'10-12',weight:'50',rest:90,guide:'Fixează coapsele și trage suportul cu picioarele. Revino lent, fără să ridici bazinul.'},
 {name:'Extensii triceps la aparat',sub:'Triceps Extension Machine',muscle:'Triceps',image:'assets/triceps_transparent.png',sets:3,reps:'10-12',weight:'30',rest:90,guide:'Ține coatele stabile pe suport. Împinge mânerele până aproape de extensia completă și revino controlat.'}
];
const $=x=>document.getElementById(x),load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let timer=null,rt=null,filter='all',calDate=new Date();
function H(){return load('fb-history',[])} function D(){return load('fb-draft',{})}
function fmt(s){s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function activeStart(){return Number(localStorage.getItem('fb-active-start')||0)}
function parseRoDate(s){let p=String(s).match(/(\d{1,2})[.\/]\s*(\d{1,2})[.\/]\s*(\d{4})/);return p?new Date(+p[3],+p[2]-1,+p[1]):null}
function last(n){let h=H();for(let i=h.length-1;i>=0;i--){let e=(h[i].exercises||[]).find(x=>x.name===n);if(e)return e}}
function totalTime(h){return h.reduce((a,x)=>a+Number(x.duration||0),0)}
function humanTime(sec){let m=Math.round(sec/60);if(m<60)return `${m} min`;let h=Math.floor(m/60),r=m%60;return r?`${h} h ${r} min`:`${h} h`}
function home(){
 let h=H(); $('count').textContent=h.length; $('vol').textContent=(h.at(-1)?.volume||0)+' kg'; $('totalTime').textContent=humanTime(totalTime(h)); $('visits').textContent=h.length;
 $('history').innerHTML=h.length?h.slice().reverse().slice(0,10).map(x=>`<div class="history"><b>${x.date}</b><span>${x.done}/${EX.length} exerciții · ${Math.round((x.duration||0)/60)} min · ${x.volume||0} kg volum</span></div>`).join(''):'<p class="muted">Primul antrenament va apărea aici.</p>';
 renderCalendar();
 let a=activeStart(); $('start').textContent=a?'Continuă antrenamentul':'Începe antrenamentul';
}
function renderCalendar(){
 const h=H(), y=calDate.getFullYear(),m=calDate.getMonth(), first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), start=(first.getDay()+6)%7;
 const attended=new Set(h.map(x=>parseRoDate(x.date)).filter(Boolean).filter(d=>d.getFullYear()===y&&d.getMonth()===m).map(d=>d.getDate()));
 $('monthLabel').textContent=new Intl.DateTimeFormat('ro-RO',{month:'long',year:'numeric'}).format(first);
 let html=['Lu','Ma','Mi','Jo','Vi','Sâ','Du'].map(d=>`<b class="dow">${d}</b>`).join('');
 for(let i=0;i<start;i++)html+='<span class="day empty"></span>';
 for(let d=1;d<=days;d++)html+=`<span class="day ${attended.has(d)?'trained':''}">${d}</span>`;
 $('calendar').innerHTML=html;
}
function start(){
 if(!activeStart()) localStorage.setItem('fb-active-start',String(Date.now()));
 $('home').classList.add('hidden');$('workout').classList.remove('hidden');render();tick();clearInterval(timer);timer=setInterval(tick,1000);
}
function tick(){let s=activeStart();$('clock').textContent=s?fmt((Date.now()-s)/1000):'00:00'}
function render(){
 let d=D(),box=$('cards');box.innerHTML='';
 EX.forEach((e,i)=>{
  let x=d[i]||{sets:[],done:false,later:false}; if((filter==='todo'&&x.done)||(filter==='done'&&!x.done))return;
  let c=document.createElement('article');c.className='machine'+(x.done?' done':'');
  if(e.type==='cardio'){
   c.innerHTML=`<div class="machineImage"><img src="${e.image}" alt="${e.name}"></div><div class="head"><div><h3>${i+1}. ${e.name}</h3><b class="badge">${e.muscle}</b></div><b class="target">${e.minutes} MIN</b></div><p>${e.guide}</p><div class="cardioTarget"><b>Țintă</b><strong>${e.minutes} minute</strong></div><div class="actions single"><button class="complete">${x.done?'Terminat ✓':'Marchează terminat'}</button></div>`;
   c.querySelector('.complete').onclick=()=>toggleComplete(i);box.appendChild(c);return;
  }
  let l=last(e.name),ls=l?l.sets.filter(s=>s.done).map(s=>`${s.kg} kg × ${s.reps}`).join(' · '):'Prima sesiune.';
  c.innerHTML=`<div class="machineImage"><img src="${e.image}" alt="${e.name}"></div><div class="head"><div><h3>${i+1}. ${e.name}</h3><span class="sub">${e.sub||''}</span><div><b class="badge">${e.muscle}</b><b class="rir">RIR 1-2</b></div></div><b class="target">${e.weight} KG</b></div><p>${e.guide}</p><div class="prescription"><span>Program</span><b>${e.sets} × ${e.reps} repetări</b><span>Greutate orientativă</span><b>${e.weight} kg</b></div><div class="last"><b>Ultima dată</b><br>${ls}</div><p class="advice">Păstrează aproximativ 1-2 repetări în rezervă. După fiecare set bifat pornește pauza de 01:30.</p><div class="setshead"><span>Set</span><span>kg</span><span>reps</span><span></span></div><div class="sets"></div><div class="actions"><button class="later">${x.later?'Revin aici ✓':'Ocupat · mai târziu'}</button><button class="complete">${x.done?'Terminat ✓':'Marchează terminat'}</button></div>`;
  let sb=c.querySelector('.sets');
  for(let j=0;j<e.sets;j++){
   let s=x.sets[j]||{kg:'',reps:'',done:false},r=document.createElement('div');r.className='set';r.innerHTML=`<b>${j+1}</b><input inputmode="decimal" placeholder="${e.weight}" value="${s.kg}"><input inputmode="numeric" placeholder="${e.reps}" value="${s.reps}"><button class="${s.done?'done':''}" aria-label="Bifează setul">${s.done?'✓':'○'}</button>`;
   let ins=r.querySelectorAll('input'),b=r.querySelector('button');
   function persist(){let q=D();q[i]??={sets:[],done:false,later:false};q[i].sets[j]={kg:ins[0].value,reps:ins[1].value,done:b.classList.contains('done')};save('fb-draft',q)}
   ins.forEach(z=>z.oninput=persist); b.onclick=()=>{let was=b.classList.contains('done');b.classList.toggle('done');b.textContent=b.classList.contains('done')?'✓':'○';persist();if(!was&&b.classList.contains('done'))rest(90)};sb.appendChild(r);
  }
  c.querySelector('.later').onclick=()=>{let q=D();q[i]??={sets:[],done:false,later:false};q[i].later=!q[i].later;save('fb-draft',q);render()};
  c.querySelector('.complete').onclick=()=>toggleComplete(i);box.appendChild(c);
 });
 let n=EX.filter((e,i)=>d[i]?.done).length;$('prog').textContent=`${n}/${EX.length} exerciții terminate`;$('bar').style.width=n/EX.length*100+'%';
}
function toggleComplete(i){let q=D();q[i]??={sets:[],done:false,later:false};q[i].done=!q[i].done;q[i].later=false;save('fb-draft',q);render()}
function rest(s){clearInterval(rt);$('rest').classList.remove('hidden');$('restClock').textContent=fmt(s);rt=setInterval(()=>{s--;$('restClock').textContent=fmt(s);if(s<=0)closeRest()},1000)}
function closeRest(){clearInterval(rt);$('rest').classList.add('hidden')}
function finish(){
 let start=activeStart();if(!start)return;let d=D(),duration=Math.floor((Date.now()-start)/1000),volume=0,done=0;
 let exercises=EX.map((e,i)=>{let x=d[i]||{sets:[]};if(x.done)done++;let sets=(x.sets||[]).map(s=>({kg:Number(s.kg||0),reps:Number(s.reps||0),done:!!s.done}));sets.filter(s=>s.done).forEach(s=>volume+=s.kg*s.reps);return{name:e.name,sets}});
 let h=H();h.push({date:new Date().toLocaleDateString('ro-RO'),timestamp:Date.now(),duration,volume:Math.round(volume),done,exercises});save('fb-history',h);localStorage.removeItem('fb-draft');localStorage.removeItem('fb-active-start');clearInterval(timer);$('workout').classList.add('hidden');$('home').classList.remove('hidden');home();alert(`Antrenament salvat!\n${done}/${EX.length} exerciții\n${Math.round(duration/60)} minute\n${Math.round(volume)} kg volum`)
}
$('start').onclick=start;$('back').onclick=()=>{$('workout').classList.add('hidden');$('home').classList.remove('hidden');home()};$('finish').onclick=finish;$('skip').onclick=closeRest;
$('prevMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};$('nextMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};
document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-f]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.f;render()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');home();
