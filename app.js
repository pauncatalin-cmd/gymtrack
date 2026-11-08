import {createBackup, createStorage, historyTotals, parseBackup, planImport} from './backup.js?v=15';
import {bestSet, betterSet, exerciseTimeline, filterHistory, localDay, loggedSet, MACHINE_DEFAULTS,
 MACHINE_DEFAULTS_VERSION, machineProgramUpdate, prefillDraft, programLabel, setNumber, workoutDate} from './workouts.js?v=15';
import {CARDIO_MODES, DEFAULT_WEEKLY_GOAL, MAX_WEEKLY_GOAL, estimateEnergy, latestWeight, sessionHighlights,
 weeklyStats} from './fitness.js?v=15';

const DEFAULT_EX=[
 {type:'cardio',name:'Alergare pe bandă',muscle:'Încălzire',minutes:10,guide:'Aleargă 10 minute într-un ritm confortabil. Scopul este să te încălzești pentru antrenament.'},
 {name:'Fluturări la aparat',sub:'Butterfly cu mânere',muscle:'Piept',image:'assets/butterfly_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Ține spatele lipit de spătar. Adu mânerele în față controlat și revino lent.'},
 {name:'Flexii biceps la aparat',sub:'Bizepsmaschine',muscle:'Biceps',image:'assets/biceps_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Ține brațele pe suport și coatele stabile. Ridică greutatea fără balans.'},
 {name:'Presă pentru picioare',sub:'Beinpresse',muscle:'Picioare',image:'assets/presa_picioare_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Ține spatele pe spătar. Coboară controlat și împinge prin toată talpa.'},
 {name:'Ramat la aparat',sub:'Rudern',muscle:'Spate',image:'assets/ramat_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Ține pieptul stabil și trage mânerele spre trunchi. Apropie omoplații.'},
 {name:'Presă pentru piept',sub:'Brustpresse',muscle:'Piept',image:'assets/presa_piept_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Reglează scaunul cu mânerele la nivelul pieptului. Împinge controlat.'},
 {name:'Tracțiuni la helcometru',sub:'Latzug',muscle:'Spate',image:'assets/helcometru_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Fixează coapsele și trage bara spre partea superioară a pieptului, fără balans.'},
 {name:'Flexii pentru picioare la aparat',sub:'Beinbeuger / Leg Curl',muscle:'Femurali',image:'assets/beinbeuger_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Fixează coapsele și trage suportul cu picioarele. Revino lent, fără să ridici bazinul.'},
 {name:'Extensii triceps la aparat',sub:'Triceps Extension Machine',muscle:'Triceps',image:'assets/triceps_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Ține coatele stabile pe suport. Împinge mânerele până aproape de extensia completă și revino controlat.'},
 {name:'Abdomene la aparat',sub:'Abdominal Crunch Machine',muscle:'Abdomen',image:'assets/abdomen_transparent.png',...MACHINE_DEFAULTS,reps:'10-12',rest:90,guide:'Ține spatele sprijinit și contractă abdomenul controlat. Nu trage din brațe și revino lent.'}
];
const $=id=>document.getElementById(id);
function initialPrograms(){
 return [{id:'full-body',name:'Full Body',machineDefaults:MACHINE_DEFAULTS_VERSION,exercises:structuredClone(DEFAULT_EX)}];
}
const storage=createStorage(localStorage,initialPrograms());
function programs(){return storage.get('programs')}
function activeProgram(){return storage.activeProgram()}
function saveFields(fields, expected){
 try{storage.update(fields,expected);return true}
 catch(error){alert(error.name==='QuotaExceededError'?'Spațiul local este insuficient. Datele salvate anterior au rămas intacte.':error.message);return false}
}
function applyMachineDefaults(){
 if(workoutPending()||programs().every(program=>program.machineDefaults===MACHINE_DEFAULTS_VERSION))return;
 const snapshot=storage.snapshot();
 const update=machineProgramUpdate(snapshot.data);
 if(update&&saveFields(update,snapshot))refreshProgram();
}
let EX;
try{EX=activeProgram().exercises}
catch(error){alert('Datele locale nu pot fi citite. Păstrează aplicația instalată.');throw error}
function refreshProgram(){EX=activeProgram().exercises;$('programName')&&($('programName').textContent=activeProgram().name);$('programSelect')&&renderProgramSelect()}
function renderProgramSelect(){let sel=$('programSelect');if(!sel)return;let p=programs();sel.innerHTML=p.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)}</option>`).join('');sel.value=activeProgram().id}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function savePrograms(p){if(!saveFields({programs:p}))return false;refreshProgram();return true}
function workoutPending(){return activeStart()>0||Object.keys(D()).length>0}
function switchProgram(id){if(workoutPending()){alert('Termină sau anulează antrenamentul curent înainte să schimbi programul.');renderProgramSelect();return}if(saveFields({activeProgramId:id})){refreshProgram();home()}else renderProgramSelect()}
function openProgramManager(){if(workoutPending()){alert('Termină sau anulează antrenamentul curent înainte să modifici programul.');return}renderProgramManager();$('programManager').classList.remove('hidden')}
function closeProgramManager(){$('programManager').classList.add('hidden')}
function renderProgramManager(){
 const program=activeProgram();
 const list=$('programExerciseList');
 $('managerProgramName').textContent=program.name;
 list.innerHTML=program.exercises.map((exercise,index)=>{
  const name=escapeHtml(exercise.name);
  const cardio=exercise.type==='cardio';
  const prescription=cardio?`${exercise.minutes||10} min`:`${exercise.sets||MACHINE_DEFAULTS.sets} × ${escapeHtml(exercise.reps||'10-12')}`;
  const strengthControls=cardio?'':`<div class="seriesControl"><button data-series-minus="${index}" aria-label="Scade o serie">−</button><b>${exercise.sets||MACHINE_DEFAULTS.sets} serii</b><button data-series-plus="${index}" aria-label="Adaugă o serie">+</button></div><label class="exerciseRest">Pauză (sec)<input data-rest-index="${index}" type="number" inputmode="numeric" min="0" step="1" value="${exercise.rest??90}" aria-label="Pauză în secunde pentru ${name}"></label>`;
  return `<div class="programExerciseRow"><div><b>${index+1}. ${name}</b><span>${escapeHtml(exercise.muscle||'')} · ${prescription}</span></div><div class="exerciseRowActions">${strengthControls}<div class="exerciseMove"><button data-move-index="${index}" data-direction="-1" aria-label="Mută mai sus: ${name}" ${index===0?'disabled':''}>↑</button><button data-move-index="${index}" data-direction="1" aria-label="Mută mai jos: ${name}" ${index===program.exercises.length-1?'disabled':''}>↓</button><button data-del-ex="${index}" class="rowDelete">Șterge</button></div></div></div>`;
 }).join('')||'<p class="muted">Programul nu are încă exerciții.</p>';
 list.querySelectorAll('[data-del-ex]').forEach(button=>button.onclick=()=>deleteExercise(Number(button.dataset.delEx)));
 list.querySelectorAll('[data-series-minus]').forEach(button=>button.onclick=()=>changeExerciseSets(Number(button.dataset.seriesMinus),-1));
 list.querySelectorAll('[data-series-plus]').forEach(button=>button.onclick=()=>changeExerciseSets(Number(button.dataset.seriesPlus),1));
 list.querySelectorAll('[data-move-index]').forEach(button=>button.onclick=()=>moveExercise(Number(button.dataset.moveIndex),Number(button.dataset.direction)));
 list.querySelectorAll('[data-rest-index]').forEach(input=>input.onchange=()=>changeExerciseRest(Number(input.dataset.restIndex),input));
 $('deleteProgramBtn').style.display=(program.id==='full-body'||programs().length===1)?'none':'block';
}

function moveExercise(index,direction){
 if(workoutPending())return;
 const all=programs();
 const program=all.find(item=>item.id===activeProgram().id);
 const destination=index+direction;
 if(!program.exercises[index]||!program.exercises[destination])return;
 const [exercise]=program.exercises.splice(index,1);
 program.exercises.splice(destination,0,exercise);
 if(!savePrograms(all))return;
 renderProgramManager();
 const buttons=$('programExerciseList').querySelectorAll(`[data-move-index="${destination}"]:not(:disabled)`);
 (Array.from(buttons).find(button=>Number(button.dataset.direction)===direction)??buttons[0])?.focus();
}

function changeExerciseRest(index,input){
 if(workoutPending())return;
 const all=programs();
 const exercise=all.find(item=>item.id===activeProgram().id).exercises[index];
 const seconds=input.valueAsNumber;
 const previous=exercise.rest??90;
 if(!Number.isSafeInteger(seconds)||seconds<0){
  alert('Introdu un număr întreg de secunde. Pentru fără pauză, folosește 0.');
  input.value=previous;
  return;
 }
 exercise.rest=seconds;
 if(!savePrograms(all))input.value=previous;
}
function createProgram(){let name=prompt('Cum se numește noul antrenament? De exemplu: Upper Body');if(!name||!name.trim())return;let p=programs(),id='program-'+Date.now();p.push({id,name:name.trim(),machineDefaults:MACHINE_DEFAULTS_VERSION,exercises:[]});if(!saveFields({programs:p,activeProgramId:id}))return;refreshProgram();renderProgramManager();home()}
function deleteProgram(){const snapshot=storage.snapshot(),{programs,activeProgramId}=snapshot.data;let a=programs.find(p=>p.id===activeProgramId);if(a.id==='full-body'||programs.length===1)return;if(!confirm(`Ștergi programul „${a.name}”? Istoricul antrenamentelor deja făcute rămâne salvat.`))return;let p=programs.filter(x=>x.id!==a.id);if(!saveFields({programs:p,activeProgramId:p[0].id},snapshot))return;refreshProgram();renderProgramManager();home()}
function addExerciseToProgram(){let name=$('newExName').value.trim(),muscle=$('newExMuscle').value.trim(),type=$('newExType').value;if(!name){alert('Scrie numele exercițiului sau aparatului.');return}let e;if(type==='cardio'){e={type:'cardio',name,muscle:muscle||'Cardio',minutes:Math.max(1,Number($('newExMinutes').value)||10),guide:$('newExGuide').value.trim()||'Execută exercițiul într-un ritm controlat.'}}else{e={name,sub:$('newExSub').value.trim(),muscle:muscle||'Altele',image:'assets/kip-training-logo.png',sets:Math.max(1,Number($('newExSets').value)||MACHINE_DEFAULTS.sets),reps:$('newExReps').value.trim()||'10-12',weight:$('newExWeight').value.trim()||MACHINE_DEFAULTS.weight,rest:$('newExRest').value===''?90:Math.max(0,Math.round(Number($('newExRest').value))),guide:$('newExGuide').value.trim()||'Execută mișcarea controlat și păstrează tehnica corectă.'}}let p=programs(),a=p.find(x=>x.id===activeProgram().id);a.exercises.push(e);if(!savePrograms(p))return;['newExName','newExSub','newExMuscle','newExGuide'].forEach(id=>$(id).value='');$('newExSets').value=MACHINE_DEFAULTS.sets;$('newExWeight').value=MACHINE_DEFAULTS.weight;renderProgramManager();home()}
function deleteExercise(i){const snapshot=storage.snapshot(),{programs,activeProgramId}=snapshot.data;let a=programs.find(x=>x.id===activeProgramId),e=a.exercises[i];if(!e||!confirm(`Ștergi „${e.name}” din acest program?`))return;a.exercises.splice(i,1);if(!saveFields({programs},snapshot))return;refreshProgram();renderProgramManager();home()}
function changeExerciseSets(i,delta){let p=programs(),a=p.find(x=>x.id===activeProgram().id),e=a?.exercises?.[i];if(!e||e.type==='cardio')return;let current=Math.max(1,Number(e.sets)||3),next=Math.max(1,Math.min(12,current+delta));if(next===current)return;e.sets=next;if(!savePrograms(p))return;renderProgramManager();home()}

let timer=null,rt=null,filter='all',calDate=new Date(),restRemaining=0;
function H(){return storage.get('history')} function D(){return storage.get('draft')}
function calcVolume(exercises){return Math.round((exercises||[]).reduce((total,e)=>total+(e.sets||[]).reduce((sum,s)=>{let kg=setNumber(s?.kg),reps=setNumber(s?.reps);return sum+(Number.isFinite(kg)&&Number.isFinite(reps)&&kg>0&&reps>0?kg*reps:0)},0),0))}
function fmt(s){s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function activeStart(){return storage.get('activeStart')}
function last(n){let h=H();for(let i=h.length-1;i>=0;i--){let e=(h[i].exercises||[]).find(x=>x.name===n);if(e)return e}}
function record(name){return exerciseTimeline(H(),name).reduce(betterSet,null)}
function progression(e,l){if(!l)return 'După primul antrenament îți voi sugera dacă merită să crești greutatea.';let s=(l.sets||[]).filter(x=>x?.done&&Number(x.kg)>0&&Number(x.reps)>0);let required=Math.max(1,Number(e.sets)||3);if(s.length<required)return `Păstrează greutatea și completează toate cele ${required} serii pentru o recomandare.`;let max=Math.max(...s.map(x=>Number(x.kg)||0));let all12=s.every(x=>Number(x.reps)>=12);let allRir2=s.every(x=>x.rir!==''&&x.rir!=null&&Number(x.rir)>=2);let hard=s.some(x=>Number(x.reps)<=10&&(x.rir!==''&&x.rir!=null&&Number(x.rir)<=0));if(all12&&allRir2)return `Progres recomandat: încearcă aproximativ ${max+5} kg data viitoare.`;if(hard)return `Recomandare: păstrează aproximativ ${max} kg până controlezi 10-12 repetări.`;return `Recomandare: păstrează aproximativ ${max} kg și urmărește 12 repetări cu RIR 1-2.`}
function totalTime(h){return h.reduce((a,x)=>a+Number(x.duration||0),0)}
function humanTime(sec){let m=Math.round(sec/60);if(m<60)return `${m} min`;let h=Math.floor(m/60),r=m%60;return r?`${h} h ${r} min`:`${h} h`}

function formatKg(n){let v=Math.round(Number(n||0));try{return v.toLocaleString('ro-RO')+' kg'}catch{return String(v)+' kg'}}
function setText(id,value){let el=$(id);if(el)el.textContent=value}
function renderTrend(id,measurements,title){
 const box=$(id);
 if(!measurements.length){box.replaceChildren();return}
 const width=280,height=92,pad=12,min=Math.min(...measurements),max=Math.max(...measurements);
 const points=measurements.map((value,i)=>[
  measurements.length===1?width/2:pad+i*(width-2*pad)/(measurements.length-1),
  min===max?height/2:height-pad-(value-min)/(max-min)*(height-2*pad),
 ]);
 box.innerHTML=`<small>${escapeHtml(title)}</small><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}"><polyline points="${points.map(point=>point.join(',')).join(' ')}" class="chartLine"/>${points.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="4"/>`).join('')}</svg>`;
}

function renderWeekly(history){
 const goal=storage.get('weeklyGoal')??DEFAULT_WEEKLY_GOAL;
 const week=weeklyStats(history,new Date());
 setText('weeklyGoalStatus',`${week.workouts} din ${goal} antrenamente`);
 $('weeklyGoalBar').max=goal;
 $('weeklyGoalBar').value=Math.min(week.workouts,goal);
 setText('weeklyCalories',week.estimates?`~ ${week.kcal.toLocaleString('ro-RO')} kcal`:'–');
 setText('weeklyCaloriesNote',week.estimates?`Estimări pentru ${week.estimates} din ${week.workouts} sesiuni`:'Estimarea apare după prima sesiune calculată');
}

function renderWeightLog(){
 const entries=(storage.get('weightLog')??[]).sort((a,b)=>a.date.localeCompare(b.date)||a.recordedAt-b.recordedAt);
 renderTrend('weightTrend',entries.slice(-30).map(entry=>entry.kg),'Greutate corporală · ultimele 30 de măsurători');
 $('weightEntries').innerHTML=entries.length?entries.slice().reverse().map(entry=>
  `<li><span>${escapeHtml(isoDateToRo(entry.date))}</span><b>${entry.kg.toLocaleString('ro-RO')} kg</b></li>`
 ).join(''):'<li class="muted">Adaugă prima măsurătoare.</li>';
}

function openFitnessSettings(){
 const today=localDay(new Date());
 const latest=latestWeight(storage.get('weightLog')??[],today);
 $('appSettings').open=false;
 $('weeklyGoalInput').value=storage.get('weeklyGoal')??DEFAULT_WEEKLY_GOAL;
 $('bodyWeightDate').max=today;
 $('bodyWeightDate').value=today;
 $('bodyWeightInput').value='';
 setText('fitnessStatus',latest?`Ultima greutate: ${latest.kg.toLocaleString('ro-RO')} kg`:'');
 renderWeightLog();
 $('fitnessDialog').showModal();
}

function saveWeeklyGoal(event){
 event.preventDefault();
 const goal=$('weeklyGoalInput').valueAsNumber;
 if(!Number.isSafeInteger(goal)||goal<1||goal>MAX_WEEKLY_GOAL)return;
 if(!saveFields({weeklyGoal:goal}))return;
 renderWeekly(H());
 setText('fitnessStatus','Obiectivul săptămânal a fost salvat.');
}

function saveBodyWeight(event){
 event.preventDefault();
 const date=$('bodyWeightDate').value;
 const kg=setNumber($('bodyWeightInput').value);
 if(!date||date!==localDay(workoutDate({date}))||date>localDay(new Date())||!Number.isFinite(kg)||kg<=0||kg>1000){
  setText('fitnessStatus','Verifică data și greutatea în kg.');
  return;
 }
 const snapshot=storage.snapshot();
 const entries=snapshot.data.weightLog??[];
 const entry={date,kg,recordedAt:Date.now()};
 if(!saveFields({weightLog:[...entries,entry]},snapshot))return;
 $('bodyWeightInput').value='';
 renderWeightLog();
 setText('fitnessStatus','Măsurătoarea a fost salvată.');
}

function renderDashboard(history, totals, recovery){
 // Dashboard-ul citește direct fb-history. O intrare validă nu mai este ignorată doar din cauza formatului datei.
 let h=Array.isArray(history)?history:[],now=new Date(),y=now.getFullYear(),m=now.getMonth();
 let valid=h.map(w=>({w,d:workoutDate(w)})).filter(x=>x.d&&!isNaN(x.d.getTime()));
 const monthEntries=valid.filter(x=>x.d.getFullYear()===y&&x.d.getMonth()===m);
 const month=monthEntries.map(x=>x.w);
 let monthSeconds=totalTime(month);
 const captureDate=recovery?.month?workoutDate({date:recovery.through}):null;
 if(captureDate?.getFullYear()===y&&captureDate.getMonth()===m){
  captureDate.setHours(23,59,59,999);
  const capturedMonth=monthEntries.filter(entry=>entry.d<=captureDate).map(entry=>entry.w);
  if(capturedMonth.length===recovery.month.workoutCount){
   monthSeconds+=recovery.month.minutes*60-totalTime(capturedMonth);
  }
 }
 setText('monthWorkouts',month.length);
 setText('monthTime',humanTime(monthSeconds));
 setText('monthVolume',formatKg(month.reduce((a,w)=>a+Number(w.volume||0),0)));
 setText('avgTime',totals.count?humanTime(totals.seconds/totals.count):'0 min');
 let today=new Date(y,m,now.getDate()),cutoff=new Date(today);cutoff.setDate(cutoff.getDate()-29);
 let last30=valid.filter(x=>{let d=new Date(x.d.getFullYear(),x.d.getMonth(),x.d.getDate());return d>=cutoff&&d<=today}).length;
 setText('weeklyFreq',(last30/30*7).toFixed(1).replace('.',',')+' / săpt.');
 let dates=valid.map(x=>x.d).sort((a,b)=>b-a);
 setText('daysSince',dates.length?Math.max(0,Math.floor((today-new Date(dates[0].getFullYear(),dates[0].getMonth(),dates[0].getDate()))/86400000)):'–');
 try{renderVolumeChart(h)}catch(e){console.error('volume chart',e)}
 try{renderExerciseProgress(h,recovery)}catch(e){console.error('exercise progress',e)}
}

function renderVolumeChart(h){
 let items=h.slice(-10),box=$('volumeChart');if(!items.length){box.innerHTML='<p class="muted">Graficul apare după primul antrenament.</p>';$('volumeTrend').textContent='0%';return}
 let vals=items.map(w=>Number(w.volume||0)),max=Math.max(...vals,1),w=620,hgt=170,pad=18,step=items.length>1?(w-pad*2)/(items.length-1):0;
 let pts=vals.map((v,i)=>[pad+i*step,hgt-pad-(v/max)*(hgt-pad*2)]),poly=pts.map(p=>p.join(',')).join(' ');
 let circles=pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="5"><title>${escapeHtml(items[i].date)}: ${formatKg(vals[i])}</title></circle>`).join('');
 box.innerHTML=`<svg viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Volumul ultimelor antrenamente"><line x1="${pad}" y1="${hgt-pad}" x2="${w-pad}" y2="${hgt-pad}" class="chartBase"/><polyline points="${poly}" class="chartLine"/>${circles}</svg><div class="chartLabels"><span>${escapeHtml(items[0].date)}</span><span>${escapeHtml(items.at(-1).date)}</span></div>`;
 let trend=vals.length>1&&vals[0]>0?((vals.at(-1)-vals[0])/vals[0]*100):0;$('volumeTrend').textContent=(trend>0?'+':'')+Math.round(trend)+'%';$('volumeTrend').className=trend>0?'up':trend<0?'down':'';
}
function renderExerciseProgress(history,recovery){
 const rows=[];
 const recoveredByName=new Map(recovery?.exercises.map(exercise=>[exercise.name,exercise]));
 const cutoff=recovery?workoutDate({date:recovery.through}):null;
 cutoff?.setHours(23,59,59,999);
 for(const exercise of EX.filter(item=>item.type!=='cardio')){
  const recovered=recoveredByName.get(exercise.name);
  let first=recovered?{kg:recovered.first.kg,reps:recovered.first.repetitions}:null;
  let last=recovered?{kg:recovered.last.kg,reps:recovered.last.repetitions}:null;
  for(const workout of history){
   const date=recovered?workoutDate(workout):null;
   if(recovered && (!date || date<=cutoff))continue;
   const logged=(workout.exercises||[]).find(item=>item.name===exercise.name);
   const performance=bestSet(logged);
   if(performance){first??=performance;last=performance}
  }
  if(!last)continue;
  const diff=last.kg-first.kg;
  rows.push(`<div class="progressRow"><div><b>${escapeHtml(exercise.name)}</b><span>Prima: ${first.kg} kg × ${first.reps} · Ultima: ${last.kg} kg × ${last.reps}</span></div><strong class="${diff>0?'positive':diff<0?'negative':''}">${diff>0?'+':''}${diff} kg</strong></div>`);
 }
 $('exerciseProgressList').innerHTML=rows.length?rows.join(''):'<p class="muted">Progresul apare după ce salvezi exercițiile.</p>';
}

function openExerciseDetails(){
 const history=H();
 const recovery=storage.get('recovery');
 const names=new Set([
  ...programs().flatMap(program=>program.exercises.filter(exercise=>exercise.type!=='cardio').map(exercise=>exercise.name)),
  ...history.flatMap(workout=>workout.exercises?.filter(exercise=>bestSet(exercise)).map(exercise=>exercise.name)??[]),
  ...(recovery?.exercises.map(exercise=>exercise.name)??[]),
 ]);
 const select=$('progressExercise');
 const previous=select.value;
 select.replaceChildren(...[...names].sort((a,b)=>a.localeCompare(b,'ro')).map(name=>new Option(name,name)));
 if(names.has(previous))select.value=previous;
 renderExerciseDetails();
 $('exerciseProgressDialog').showModal();
}

function renderExerciseDetails(){
 const name=$('progressExercise').value;
 const timeline=exerciseTimeline(H(),name);
 const recovery=storage.get('recovery');
 const recovered=recovery?.exercises.find(exercise=>exercise.name===name);
 const capturedLast=recovered?{kg:recovered.last.kg,reps:recovered.last.repetitions}:null;
 const capturedFirst=recovered?{kg:recovered.first.kg,reps:recovered.first.repetitions}:null;
 const best=timeline.reduce(betterSet,betterSet(capturedFirst,capturedLast));
 const format=set=>set?`${set.kg} kg × ${set.reps}`:'–';
 const loggedLatest=timeline.at(-1);
 const latest=(!capturedLast||localDay(loggedLatest?.date)>recovery.through)?loggedLatest:capturedLast;
 setText('exerciseLatest',format(latest));
 setText('exerciseBest',format(best));
 const history=$('exerciseTimeline');
 const dated=timeline.filter(item=>localDay(item.date));
 const recent=dated.slice(-12);
 renderTrend('exerciseTrend',recent.map(item=>item.kg),`Greutatea maximă pe sesiune · ultimele ${recent.length}`);
 const rows=timeline.slice().reverse().map(item=>`<li><span>${escapeHtml(localDay(item.date)||'Dată nespecificată')}</span><b>${format(item)}</b></li>`);
 if(recovered){
  rows.push(`<li><span>Ultima din capturi</span><b>${format(capturedLast)}</b></li>`);
  rows.push(`<li><span>Prima din capturi</span><b>${format(capturedFirst)}</b></li>`);
 }
 history.innerHTML=rows.length?rows.join(''):'<li class="muted">Fișa se completează după ce salvezi serii bifate.</li>';
}

function home(){
 applyMachineDefaults();
 const recovery=storage.get('recovery');
 const h=H().map(w=>({...w,volume:calcVolume(w.exercises)||w.volume}));
 const totals=historyTotals(h,recovery,workoutDate);
 renderDashboard(h,totals,recovery);
 renderWeekly(h);
 $('count').textContent=totals.count;
 $('vol').textContent=(h.at(-1)?.volume||0)+' kg';
 $('totalTime').textContent=humanTime(totals.seconds);
 const summary=$('recoverySummary');
 summary.hidden=!recovery;
 if(recovery){
  const partial=totals.summarizedCount?`${totals.summarizedCount} de antrenamente apar doar în totalurile din capturi. `:'';
  summary.textContent=partial+(recovery.frequency?`Frecvența din capturi: ${recovery.frequency} Calculul curent folosește datele din istoric.`:'');
 }
 renderHistory(h);
 renderCalendar(); let a=activeStart(); $('start').textContent=a?'Continuă antrenamentul':'Începe antrenamentul';
}

const HISTORY_PAGE_SIZE=20;
let historyLimit=HISTORY_PAGE_SIZE;

function renderHistory(history=H()){
 const program=$('historyProgram');
 const selected=program.value;
 const names=[...new Set(history.map(programLabel))]
  .sort((a,b)=>a.localeCompare(b,'ro'));
 program.replaceChildren(new Option('Toate programele',''),...names.map(name=>new Option(name,name)));
 if(names.includes(selected))program.value=selected;
 const matches=filterHistory(history,{program:program.value,from:$('historyFrom').value,to:$('historyTo').value});
 $('historyCount').textContent=`Afișate ${Math.min(matches.length,historyLimit)} din ${matches.length}`;
 $('moreHistory').hidden=matches.length<=historyLimit;
 const list=$('history');
 list.innerHTML=matches.length?matches.slice(0,historyLimit).map(({workout:x,index:i})=>{
  const date=x.date||localDay(workoutDate(x))||'Dată nespecificată';
  const volume=calcVolume(x.exercises)||x.volume||0;
  const exerciseCount=x.exerciseCount??(x.exercises?.length||EX.length);
  const energy=x.energy?` · ~ ${x.energy.kcal} kcal active`:'';
  return `<div class="history"><div class="historyInfo"><b>${escapeHtml(date)}</b><span>${escapeHtml(programLabel(x))}</span><span>${x.done??0}/${exerciseCount} exerciții · ${Math.round((x.duration||0)/60)} min · ${volume} kg volum${energy}</span></div><div class="historyButtons"><button class="editHistoryBtn" data-history-index="${i}">Editează</button><button class="deleteHistoryBtn" data-history-index="${i}">Șterge</button></div></div>`;
 }).join(''):`<p class="muted">${history.length?'Niciun antrenament pentru filtrele alese.':'Primul antrenament va apărea aici.'}</p>`;
 list.querySelectorAll('.editHistoryBtn').forEach(button=>button.onclick=()=>openHistoryEdit(Number(button.dataset.historyIndex)));
 list.querySelectorAll('.deleteHistoryBtn').forEach(button=>button.onclick=()=>deleteHistoryEntry(Number(button.dataset.historyIndex)));
}

function resetHistoryPage(){
 historyLimit=HISTORY_PAGE_SIZE;
 renderHistory();
}


function openAddHistory(){let now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);$('addHistoryDate').value=local;$('addHistoryMinutes').value=105;$('addHistoryDone').value=EX.length;$('addHistoryVolume').value=0;$('addHistory').classList.remove('hidden')}
function closeAddHistory(){$('addHistory').classList.add('hidden')}
function saveAddedHistory(){let date=$('addHistoryDate').value,minutes=Math.round(Number($('addHistoryMinutes').value)),done=Math.round(Number($('addHistoryDone').value)),volume=Math.max(0,Math.round(Number($('addHistoryVolume').value)||0));if(!date||!Number.isFinite(minutes)||minutes<1||!Number.isFinite(done)||done<0||done>EX.length){alert('Verifică data, durata și numărul de exerciții.');return}let parts=date.split('-').map(Number),ts=new Date(parts[0],parts[1]-1,parts[2],12,0,0).getTime(),h=H();h.push({date:isoDateToRo(date),timestamp:ts,duration:minutes*60,volume,done,programId:activeProgram().id,programName:activeProgram().name,exerciseCount:EX.length,exercises:[]});h.sort((a,b)=>(Number(a.timestamp)||0)-(Number(b.timestamp)||0));if(!saveFields({history:h}))return;closeAddHistory();home()}
async function exportBackup(){
 try{
  const data=createBackup(storage.snapshot().data);
  const filename=`KIP-Training-backup-${data.exportedAt.replace(/[:.]/g,'-')}.json`;
  const file=new File([JSON.stringify(data,null,2)],filename,{type:'application/json'});
  if(navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file]});return}
   catch(error){if(error.name==='AbortError')return}
  }
  const url=URL.createObjectURL(file);
  const link=document.createElement('a');
  link.href=url;
  link.download=filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch{alert('Backupul nu a putut fi exportat.')}
}

async function importBackupFile(file){
 let incoming;
 try{incoming=parseBackup(await file.text())}
 catch(error){alert(error instanceof SyntaxError?'Fișierul de backup nu este un JSON valid.':error.message);return}
 let current, merged;
 try{
  current=storage.snapshot();
  if(incoming.programs){
   const update=machineProgramUpdate(incoming);
   if(update)incoming={...incoming,...update};
  }
  merged=planImport(current.data,incoming,initialPrograms());
 }catch(error){alert(error.message);return}
 const added=merged.history.length-current.data.history.length;
 const archivedDraft=incoming.archive.some(item=>item.key==='kip-backup-v10-draft');
 const draftNote=archivedDraft?'\nCiorna din backupul vechi va fi păstrată în arhivă pentru recuperare manuală.':'';
 const recoveryNote=incoming.recovery?'\nVor fi preluate și totalurile și progresul din capturi.':'';
 const note=draftNote+recoveryNote;
 if(!confirm(`Importi backupul? Vor fi adăugate ${added} antrenamente. Istoricul existent se păstrează.${note}`))return;
 if(!saveFields(merged,current))return;
 clearInterval(timer);
 closeRest();
 refreshProgram();
 home();
 alert('Backup importat cu succes.');
}

let editingHistoryIndex=null;
function isoDateToRo(value){let m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:''}
function openHistoryEdit(index){let h=H(),w=h[index];if(!w)return;editingHistoryIndex=index;$('editHistoryDate').value=localDay(workoutDate(w));$('editHistoryMinutes').value=Math.max(1,Math.round(Number(w.duration||0)/60));$('editHistoryDone').value=Math.max(0,Math.min(EX.length,Number(w.done||0)));$('editHistory').classList.remove('hidden')}
function closeHistoryEdit(){editingHistoryIndex=null;$('editHistory').classList.add('hidden')}
function deleteHistoryEntry(index){const snapshot=storage.snapshot(),h=snapshot.data.history;let w=h[index];if(!w)return;if(!confirm(`Ștergi complet antrenamentul din ${w.date}?\n\nAceastă acțiune va elimina ziua din istoric și calendar.`))return;h.splice(index,1);if(saveFields({history:h},snapshot))home()}
function deleteEditingHistory(){if(editingHistoryIndex===null)return;const snapshot=storage.snapshot(),h=snapshot.data.history;let w=h[editingHistoryIndex];if(!w)return closeHistoryEdit();if(!confirm(`Ștergi COMPLET antrenamentul din ${w.date}?\n\nVa dispărea din istoric, calendar și toate statisticile.`))return;h.splice(editingHistoryIndex,1);if(!saveFields({history:h},snapshot))return;closeHistoryEdit();home()}
function saveHistoryEdit(){
 if(editingHistoryIndex===null)return;
 const history=H();
 const workout=history[editingHistoryIndex];
 if(!workout)return closeHistoryEdit();
 const date=$('editHistoryDate').value;
 const minutes=Math.round(Number($('editHistoryMinutes').value));
 const done=Math.round(Number($('editHistoryDone').value));
 if(!date){alert('Alege data antrenamentului.');return}
 if(!Number.isFinite(minutes)||minutes<1){alert('Introdu o durată validă în minute.');return}
 if(!Number.isFinite(done)||done<0||done>EX.length){alert(`Exercițiile efectuate trebuie să fie între 0 și ${EX.length}.`);return}
 if(workout.energy&&minutes!==Math.round(workout.duration/60)){
  const cardio=(workout.exercises??[]).flatMap(exercise=>exercise.cardio?[exercise.cardio]:[]);
  const estimate=estimateEnergy({bodyKg:workout.energy.bodyKg,duration:minutes*60,
   strength:workout.energy.strengthSeconds>0,cardio});
  if(!estimate.energy){alert(estimate.reason);return}
  workout.energy=estimate.energy;
 }
 const [year,month,day]=date.split('-').map(Number);
 const old=workout.timestamp?new Date(workout.timestamp):new Date();
 const updated=new Date(year,month-1,day,old.getHours(),old.getMinutes(),old.getSeconds());
 workout.date=isoDateToRo(date);
 if(minutes!==Math.round(workout.duration/60))workout.duration=minutes*60;
 workout.done=done;
 workout.timestamp=updated.getTime();
 if(!saveFields({history}))return;
 closeHistoryEdit();
 home();
}
function renderCalendar(){
 const h=H(), y=calDate.getFullYear(),m=calDate.getMonth(), first=new Date(y,m,1), days=new Date(y,m+1,0).getDate(), start=(first.getDay()+6)%7;
 const attended=new Set(h.map(workoutDate).filter(Boolean).filter(d=>d.getFullYear()===y&&d.getMonth()===m).map(d=>d.getDate()));
 $('monthLabel').textContent=new Intl.DateTimeFormat('ro-RO',{month:'long',year:'numeric'}).format(first);
 let html=['Lu','Ma','Mi','Jo','Vi','Sâ','Du'].map(d=>`<b class="dow">${d}</b>`).join('');
 for(let i=0;i<start;i++)html+='<span class="day empty"></span>'; for(let d=1;d<=days;d++)html+=`<span class="day ${attended.has(d)?'trained':''}">${d}</span>`; $('calendar').innerHTML=html;
}
function start(){if(!activeStart()&&!saveFields({activeStart:Date.now()}))return;$('home').classList.add('hidden');$('workout').classList.remove('hidden');setText('prefillStatus','');render();tick();clearInterval(timer);timer=setInterval(tick,1000)}
function prefillValues(){
 const snapshot=storage.snapshot();
 const {history,activeStart}=snapshot.data;
 if(!activeStart)return;
 const draft=structuredClone(snapshot.data.draft);
 const program=snapshot.data.programs.find(item=>item.id===snapshot.data.activeProgramId);
 const count=prefillDraft(draft,program,history);
 if(!count){setText('prefillStatus','Nu sunt valori anterioare pentru seriile rămase libere.');return}
 if(!saveFields({draft},snapshot))return;
 render();
 setText('prefillStatus',`Serii precompletate: ${count}. Bifează fiecare serie după ce o faci.`);
}
function tick(){let s=activeStart();$('clock').textContent=s?fmt((Date.now()-s)/1000):'00:00'}

function renderCardioCard(card,exercise,draft,index){
 const options=Object.entries(CARDIO_MODES).map(([mode,data])=>
  `<option value="${mode}">${escapeHtml(data.label)}</option>`).join('');
 card.innerHTML=`<div class="head cardioHead"><div><h3>${index+1}. ${escapeHtml(exercise.name)}</h3><b class="badge">${escapeHtml(exercise.muscle)}</b></div><b class="target">${exercise.minutes} MIN</b></div><p>${escapeHtml(exercise.guide)}</p><div class="cardioEntry"><label>Minute efectuate<input class="cardioMinutes" type="number" inputmode="decimal" min="0" step="0.1" placeholder="${exercise.minutes||10}"></label><label>Tip de cardio<select class="cardioMode"><option value="">Alege pentru estimare</option>${options}</select></label></div><div class="actions single"><button class="complete">${draft.done?'Terminat ✓':'Marchează terminat'}</button></div>`;
 const minutes=card.querySelector('.cardioMinutes');
 const mode=card.querySelector('.cardioMode');
 minutes.value=draft.cardioMinutes??'';
 mode.value=draft.cardioMode??'';
 const persist=()=>{
  const current=D();
  current[index]??={sets:[],done:false,later:false};
  current[index].cardioMinutes=Number.isFinite(minutes.valueAsNumber)?minutes.valueAsNumber:null;
  current[index].cardioMode=mode.value;
  return saveFields({draft:current});
 };
 minutes.oninput=persist;
 mode.onchange=persist;
 card.querySelector('.complete').onclick=()=>{if(persist())toggleComplete(index)};
}

function render(){
 let d=D(),box=$('cards');box.innerHTML='';
 EX.forEach((e,i)=>{
  let x=d[i]||{sets:[],done:false,later:false}; if((filter==='todo'&&x.done)||(filter==='done'&&!x.done))return;
  let c=document.createElement('article');c.className='machine'+(x.done?' done':'');
  if(e.type==='cardio'){
   renderCardioCard(c,e,x,i);box.appendChild(c);return;
  }
  let l=last(e.name),rec=record(e.name),ls=l?(l.sets||[]).filter(s=>s?.done).map(s=>`${escapeHtml(s.kg||0)} kg × ${escapeHtml(s.reps||0)}${s.rir!==''&&s.rir!=null?` · RIR ${escapeHtml(s.rir)}`:''}`).join(' · '):'Prima sesiune.';
  let target=e.weight?`${escapeHtml(e.weight)} KG`:'ALEGE KG'; let ph=e.weight||'kg';
  c.innerHTML=`<div class="machineImage"><img src="${escapeHtml(e.image)}" alt="${escapeHtml(e.name)}"></div><div class="head"><div><h3>${i+1}. ${escapeHtml(e.name)}</h3><span class="sub">${escapeHtml(e.sub)}</span><div><b class="badge">${escapeHtml(e.muscle)}</b><b class="rir">Țintă RIR 1-2</b></div></div><b class="target">${target}</b></div><p>${escapeHtml(e.guide)}</p><div class="prescription"><span>Program</span><b>${e.sets} × ${escapeHtml(e.reps)} repetări</b><span>Greutate orientativă</span><b>${e.weight?escapeHtml(e.weight)+' kg':'alege în aparat'}</b></div><div class="last"><b>Ultima dată</b><br>${ls}</div><div class="record"><b>Record personal</b><span>${rec?`${rec.kg} kg × ${rec.reps}`:'Încă nu ai un record.'}</span></div><div class="progressTip">${progression(e,l)}</div><p class="advice">Scrie RIR-ul real după fiecare serie. RIR 2 înseamnă că mai puteai face aproximativ 2 repetări.</p><div class="setshead"><span>Set</span><span>kg</span><span>reps</span><span>RIR</span><span></span></div><div class="sets"></div><div class="actions"><button class="later">${x.later?'Revin aici ✓':'Ocupat · mai târziu'}</button><button class="complete">${x.done?'Terminat ✓':'Marchează terminat'}</button></div>`;
  let sb=c.querySelector('.sets');
  for(let j=0;j<e.sets;j++){
   let s=x.sets[j]||{kg:'',reps:'',rir:'',done:false},r=document.createElement('div');r.className='set';r.innerHTML=`<b>${j+1}</b><input inputmode="decimal" placeholder="${escapeHtml(ph)}" value="${escapeHtml(s.kg)}"><input inputmode="numeric" placeholder="${escapeHtml(e.reps)}" value="${escapeHtml(s.reps)}"><input inputmode="numeric" placeholder="RIR" value="${escapeHtml(s.rir)}"><button class="${s.done?'done':''}" aria-label="Bifează setul">${s.done?'✓':'○'}</button>`;
   let ins=r.querySelectorAll('input'),b=r.querySelector('button');
   function persist(){let q=D();q[i]??={sets:[],done:false,later:false};q[i].sets[j]={...q[i].sets[j],kg:ins[0].value,reps:ins[1].value,rir:ins[2].value,done:b.classList.contains('done')};if(!saveFields({draft:q}))return;updateProgress()}
   ins.forEach(z=>z.oninput=persist); b.onclick=()=>{let was=b.classList.contains('done');b.classList.toggle('done');b.textContent=b.classList.contains('done')?'✓':'○';persist();const pause=e.rest??90;if(!was&&pause>0)rest(pause)};sb.appendChild(r);
  }
  c.querySelector('.later').onclick=()=>{let q=D();q[i]??={sets:[],done:false,later:false};q[i].later=!q[i].later;if(!saveFields({draft:q}))return;render()}; c.querySelector('.complete').onclick=()=>toggleComplete(i);box.appendChild(c);
 }); updateProgress();
}
function updateProgress(){
 const draft=D();
 let strengthTotal=0,strengthDone=0,cardioTotal=0,cardioDone=0;
 EX.forEach((exercise,index)=>{
  if(exercise.type==='cardio'){
   cardioTotal++;
   if(draft[index]?.done)cardioDone++;
   return;
  }
  strengthTotal+=exercise.sets||0;
  strengthDone+=(draft[index]?.sets||[]).filter(set=>set?.done).length;
 });
 const cardio=cardioTotal?`Cardio ${cardioDone}/${cardioTotal} · `:'';
 $('prog').textContent=`${cardio}${strengthDone}/${strengthTotal} serii`;
 $('bar').style.width=`${(strengthDone+cardioDone)/Math.max(1,strengthTotal+cardioTotal)*100}%`;
}
function toggleComplete(i){let q=D();q[i]??={sets:[],done:false,later:false};q[i].done=!q[i].done;q[i].later=false;if(!saveFields({draft:q}))return;render()}
function rest(s){clearInterval(rt);restRemaining=s;$('rest').classList.remove('hidden');$('restClock').textContent=fmt(restRemaining);rt=setInterval(()=>{restRemaining--;$('restClock').textContent=fmt(restRemaining);if(restRemaining<=0){try{if(navigator.vibrate)navigator.vibrate([250,120,250])}catch{}closeRest()}},1000)}
function addRest(){restRemaining+=30;$('restClock').textContent=fmt(restRemaining)}
function closeRest(){clearInterval(rt);$('rest').classList.add('hidden')}
function cancelWorkout(){if(!confirm('Anulezi antrenamentul curent? Timpul și seriile nesalvate vor fi șterse.'))return;if(!saveFields({draft:{},activeStart:0}))return;clearInterval(timer);clearInterval(rt);$('rest').classList.add('hidden');$('workout').classList.add('hidden');$('home').classList.remove('hidden');home()}
function finish(){
 const snapshot=storage.snapshot();
 const {activeStart:start,draft,history,weightLog,recovery}=snapshot.data;
 if(!start)return;
 const now=new Date();
 const duration=Math.max(0,Math.floor((now.getTime()-start)/1000));
 const cardio=[];
 let done=0,strength=false;
 const exercises=EX.map((exercise,index)=>{
  const entry=draft[index]??{sets:[]};
  if(entry.done)done++;
  const sets=entry.sets.map(loggedSet);
  if(exercise.type==='cardio'&&entry.done){
   const segment={minutes:entry.cardioMinutes??null,mode:entry.cardioMode??''};
   cardio.push(segment);
   return {name:exercise.name,sets,cardio:segment};
  }
  if(exercise.type!=='cardio'&&(entry.done||sets.some(set=>set&&(set.done||(set.kg>0&&set.reps>0)))))strength=true;
  return {name:exercise.name,sets};
 });
 const program=activeProgram();
 const weight=latestWeight(weightLog??[],localDay(now));
 const estimate=estimateEnergy({bodyKg:weight?.kg,duration,strength,cardio});
 const workout={date:now.toLocaleDateString('ro-RO'),timestamp:now.getTime(),duration,volume:calcVolume(exercises),
  done,programId:program.id,programName:program.name,exerciseCount:EX.length,exercises};
 if(estimate.energy)workout.energy=estimate.energy;
 if(!saveFields({history:[...history,workout],draft:{},activeStart:0},snapshot))return;
 clearInterval(timer);
 closeRest();
 $('workout').classList.add('hidden');
 $('home').classList.remove('hidden');
 home();
 showSessionSummary(workout,history,recovery,estimate);
}

function showSessionSummary(workout,history,recovery,estimate){
 setText('summaryProgram',workout.programName);
 setText('summaryDuration',humanTime(workout.duration));
 setText('summaryVolume',formatKg(workout.volume));
 setText('summaryCalories',workout.energy?`~ ${workout.energy.kcal.toLocaleString('ro-RO')} kcal`:'–');
 setText('summaryExercises',`${workout.done}/${workout.exerciseCount}`);
 const prior=filterHistory(history,{to:localDay(workoutDate(workout))}).find(({workout:item})=>
  item.programId?item.programId===workout.programId:item.programName===workout.programName)?.workout;
 const difference=prior?workout.volume-(calcVolume(prior.exercises)||prior.volume||0):null;
 setText('summaryComparison',difference===null?'':`${difference>0?'+':''}${formatKg(difference)} față de ultima sesiune din acest program.`);
 setText('summaryEnergyNote',estimate.reason??'Estimare pe baza greutății și a duratei cronometrate.');
 $('summaryHighlights').innerHTML=sessionHighlights(workout,history,recovery?.exercises).map(item=>{
  const format=set=>`${set.kg.toLocaleString('ro-RO')} kg × ${set.reps}`;
  const previous=item.previous?` · înainte ${format(item.previous)}`:'';
  return `<li><b>${escapeHtml(item.name)}</b><span>${format(item.current)}${previous}</span>${item.record?'<small>Record nou</small>':''}</li>`;
 }).join('');
 $('sessionSummary').showModal();
}
refreshProgram();$('programSelect').onchange=e=>switchProgram(e.target.value);$('managePrograms').onclick=openProgramManager;$('closeProgramManager').onclick=closeProgramManager;$('createProgramBtn').onclick=createProgram;$('deleteProgramBtn').onclick=deleteProgram;$('addExerciseBtn').onclick=addExerciseToProgram;$('newExType').onchange=e=>{$('cardioFields').classList.toggle('hidden',e.target.value!=='cardio');$('strengthFields').classList.toggle('hidden',e.target.value==='cardio')};$('addHistoryBtn').onclick=openAddHistory;$('cancelAddHistory').onclick=closeAddHistory;$('saveAddHistory').onclick=saveAddedHistory;$('exportBackup').onclick=exportBackup;$('importBackup').onclick=()=>$('backupFile').click();$('backupFile').onchange=e=>{let f=e.target.files?.[0];if(f)importBackupFile(f);e.target.value=''};$('cancelHistoryEdit').onclick=closeHistoryEdit;$('saveHistoryEdit').onclick=saveHistoryEdit;$('deleteHistoryFromEdit').onclick=deleteEditingHistory;$('start').onclick=start;$('resetTimer').onclick=()=>{if(confirm('Resetezi timpul antrenamentului la 00:00?')){if(saveFields({activeStart:Date.now()}))tick()}};$('cancelWorkout').onclick=cancelWorkout;$('back').onclick=()=>{$('workout').classList.add('hidden');$('home').classList.remove('hidden');home()};$('finish').onclick=finish;$('skip').onclick=closeRest;$('plus30').onclick=addRest;
$('prevMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar()};$('nextMonth').onclick=()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar()};
for(const id of ['historyProgram','historyFrom','historyTo'])$(id).onchange=resetHistoryPage;
$('moreHistory').onclick=()=>{historyLimit+=HISTORY_PAGE_SIZE;renderHistory()};
$('prefillValues').onclick=prefillValues;
$('openExerciseProgress').onclick=openExerciseDetails;
$('progressExercise').onchange=renderExerciseDetails;
$('closeExerciseProgress').onclick=()=>$('exerciseProgressDialog').close();
$('openFitness').onclick=openFitnessSettings;
$('closeFitness').onclick=()=>$('fitnessDialog').close();
$('weeklyGoalForm').onsubmit=saveWeeklyGoal;
$('bodyWeightForm').onsubmit=saveBodyWeight;
$('closeSummary').onclick=()=>$('sessionSummary').close();
document.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-f]').forEach(x=>x.classList.remove('active'));b.classList.add('active');filter=b.dataset.f;render()});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js').catch(error=>console.error('Service worker',error));home();
