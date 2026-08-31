const PROGRAM = {"luni": {"day": "LUNI", "title": "Piept + Triceps", "exercises": [{"name": "Împins la piept cu bara", "sets": 4, "reps": "6-8", "rest": 150, "image": "assets/bankdruecken.jpg"}, {"name": "Presă pentru piept la aparat", "sets": 3, "reps": "8-12", "rest": 120, "image": "assets/brustpresse.jpg"}, {"name": "Fluturări la aparat", "sets": 3, "reps": "12-15", "rest": 90, "image": "assets/butterfly.jpg"}, {"name": "Extensii triceps la cablu", "sets": 3, "reps": "10-12", "rest": 90}, {"name": "Extensii triceps deasupra capului", "sets": 3, "reps": "10-12", "rest": 90}]}, "marti": {"day": "MARȚI", "title": "Spate + Biceps", "exercises": [{"name": "Tracțiuni la helcometru", "sets": 4, "reps": "8-12", "rest": 120}, {"name": "Ramat la aparat", "sets": 4, "reps": "8-12", "rest": 120}, {"name": "Ramat la cablu", "sets": 3, "reps": "10-12", "rest": 90}, {"name": "Fluturări inverse la aparat", "sets": 3, "reps": "12-15", "rest": 90}, {"name": "Flexii biceps cu bara EZ", "sets": 3, "reps": "8-12", "rest": 90}, {"name": "Flexii ciocan cu gantere", "sets": 3, "reps": "10-12", "rest": 90}]}, "joi": {"day": "JOI", "title": "Picioare", "exercises": [{"name": "Presă pentru picioare", "sets": 4, "reps": "8-12", "rest": 150}, {"name": "Extensii pentru cvadriceps", "sets": 3, "reps": "12-15", "rest": 90, "image": "assets/beinstrecker.jpg"}, {"name": "Flexii pentru femurali", "sets": 4, "reps": "10-12", "rest": 90, "image": "assets/beinbeuger.jpg"}, {"name": "Îndreptări românești", "sets": 3, "reps": "8-10", "rest": 120}, {"name": "Ridicări pe vârfuri", "sets": 4, "reps": "12-15", "rest": 90}]}, "sambata": {"day": "SÂMBĂTĂ", "title": "Piept + Spate + Brațe", "exercises": [{"name": "Presă pentru piept la aparat", "sets": 3, "reps": "8-12", "rest": 120, "image": "assets/brustpresse.jpg"}, {"name": "Fluturări la aparat", "sets": 3, "reps": "12-15", "rest": 90, "image": "assets/butterfly.jpg"}, {"name": "Tracțiuni la helcometru", "sets": 3, "reps": "8-12", "rest": 120}, {"name": "Ramat la aparat", "sets": 3, "reps": "8-12", "rest": 120}, {"name": "Flexii biceps cu bara EZ", "sets": 3, "reps": "8-12", "rest": 90}, {"name": "Flexii ciocan cu gantere", "sets": 2, "reps": "10-12", "rest": 90}, {"name": "Extensii triceps la cablu", "sets": 3, "reps": "10-12", "rest": 90}, {"name": "Extensii triceps deasupra capului", "sets": 2, "reps": "10-12", "rest": 90}]}};
const MET = 5.0;

const state = {
  activeDay:null, startedAt:null, workoutInterval:null, restInterval:null, restRemaining:0
};
const $ = id => document.getElementById(id);

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function formatTime(sec) {
  const m=Math.floor(sec/60).toString().padStart(2,"0"), s=Math.floor(sec%60).toString().padStart(2,"0");
  return `${m}:${s}`;
}
function todayText() {
  return new Intl.DateTimeFormat("ro-RO",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date());
}
function getSettings() { return load("gymtrack-settings", {weight:0}); }
function estimateCalories(seconds) {
  const kg = Number(getSettings().weight || 0);
  if (!kg) return 0;
  const minutes = seconds/60;
  return Math.round(MET*3.5*kg/200*minutes);
}
function allExerciseNames() {
  return [...new Set(Object.values(PROGRAM).flatMap(w=>w.exercises.map(e=>e.name)))];
}

function renderHome() {
  $("todayLabel").textContent=todayText();
  const cards=$("dayCards"); cards.innerHTML="";
  Object.entries(PROGRAM).forEach(([key,w])=>{
    const sets=w.exercises.reduce((a,e)=>a+e.sets,0);
    const c=document.createElement("div"); c.className="day-card";
    c.innerHTML=`<div><p class="eyebrow">${w.day}</p><h3>${w.title}</h3><p>${w.exercises.length} exerciții, ${sets} serii</p></div><button data-day="${key}">Start</button>`;
    cards.appendChild(c);
  });
  cards.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>startWorkout(b.dataset.day));
  renderStats(); renderHistory(); renderPRs(); setupChartPicker();
}

function renderStats() {
  const h=load("gymtrack-history",[]);
  $("workoutsDone").textContent=h.length;
  $("totalTime").textContent=Math.round(h.reduce((a,x)=>a+(x.duration||0),0)/60)+" min";
  $("setsDone").textContent=h.reduce((a,x)=>a+(x.completedSets||0),0);
  $("totalCalories").textContent=h.reduce((a,x)=>a+(x.calories||0),0)+" kcal";
}

function renderHistory() {
  const h=load("gymtrack-history",[]);
  $("historyList").innerHTML = h.length ? h.slice().reverse().slice(0,8).map(x=>`
    <div class="history-item"><strong>${x.title}</strong>
    <span>${x.date} · ${Math.round(x.duration/60)} min · ${x.completedSets} serii · ~${x.calories||0} kcal</span></div>
  `).join("") : `<div class="empty">Încă nu ai antrenamente salvate.</div>`;
}

function exercisePR(name) {
  let best=0, bestReps=0, date="";
  load("gymtrack-history",[]).forEach(h=>{
    const ex=h.exercises?.find(e=>e.name===name);
    ex?.sets?.forEach(s=>{
      if(s.done && Number(s.kg)>best) { best=Number(s.kg); bestReps=Number(s.reps||0); date=h.date; }
    });
  });
  return {best,bestReps,date};
}

function renderPRs() {
  const box=$("prList");
  const rows=allExerciseNames().map(name=>({name,...exercisePR(name)})).filter(x=>x.best>0).sort((a,b)=>b.best-a.best);
  box.innerHTML = rows.length ? rows.map(x=>`
    <div class="pr-item"><div><strong style="color:var(--text)">${x.name}</strong><span>${x.date}</span></div>
    <strong>${x.best} kg × ${x.bestReps}</strong></div>
  `).join("") : `<div class="empty">PR-urile apar după primul antrenament salvat.</div>`;
}

function setupChartPicker() {
  const sel=$("chartExercise");
  const old=sel.value;
  sel.innerHTML=allExerciseNames().map(n=>`<option>${n}</option>`).join("");
  if(old && allExerciseNames().includes(old)) sel.value=old;
  sel.onchange=renderChart;
  renderChart();
}

function renderChart() {
  const name=$("chartExercise").value;
  const points=[];
  load("gymtrack-history",[]).forEach((h,idx)=>{
    const ex=h.exercises?.find(e=>e.name===name);
    const vals=ex?.sets?.filter(s=>s.done).map(s=>Number(s.kg||0)).filter(v=>v>0) || [];
    if(vals.length) points.push({x:points.length,y:Math.max(...vals),label:h.date});
  });
  const canvas=$("progressChart"), ctx=canvas.getContext("2d");
  const dpr=window.devicePixelRatio||1;
  const cssW=canvas.clientWidth||700, cssH=180;
  canvas.width=cssW*dpr; canvas.height=cssH*dpr; ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,cssW,cssH);
  $("chartEmpty").textContent = points.length<2 ? "Ai nevoie de cel puțin două antrenamente cu acest exercițiu pentru un grafic util." : "";
  if(!points.length) return;

  const pad=28, w=cssW-pad*2, h=cssH-pad*2;
  const minY=Math.min(...points.map(p=>p.y)), maxY=Math.max(...points.map(p=>p.y));
  const lo=Math.max(0,minY-5), hi=maxY+5, span=Math.max(1,hi-lo);

  ctx.strokeStyle="rgba(255,255,255,.10)"; ctx.lineWidth=1;
  for(let i=0;i<4;i++) {
    const y=pad+i*h/3; ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(cssW-pad,y); ctx.stroke();
  }

  ctx.strokeStyle="#f4c430"; ctx.lineWidth=3; ctx.beginPath();
  points.forEach((p,i)=>{
    const x=pad+(points.length===1?w/2:i*w/(points.length-1));
    const y=pad+h-(p.y-lo)/span*h;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }); ctx.stroke();

  ctx.fillStyle="#f4c430";
  points.forEach((p,i)=>{
    const x=pad+(points.length===1?w/2:i*w/(points.length-1));
    const y=pad+h-(p.y-lo)/span*h;
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
  });
}

function startWorkout(key) {
  state.activeDay=key; state.startedAt=Date.now();
  $("homeView").classList.add("hidden"); $("workoutView").classList.remove("hidden");
  const w=PROGRAM[key]; $("workoutDay").textContent=w.day; $("workoutTitle").textContent=w.title;
  renderExercises(); clearInterval(state.workoutInterval);
  state.workoutInterval=setInterval(()=>{
    const sec=Math.floor((Date.now()-state.startedAt)/1000);
    $("workoutTimer").textContent=formatTime(sec);
    $("liveCalories").textContent=`Calorii estimate: ~${estimateCalories(sec)} kcal`;
  },1000);
}

function getDraft() { return load(`gymtrack-draft-${state.activeDay}`,{}); }
function setDraft(d) { save(`gymtrack-draft-${state.activeDay}`,d); }
function getLastExerciseData(name) {
  const h=load("gymtrack-history",[]);
  for(let i=h.length-1;i>=0;i--) {
    const ex=h[i].exercises?.find(e=>e.name===name); if(ex) return ex;
  }
  return null;
}

function renderExercises() {
  const w=PROGRAM[state.activeDay], draft=getDraft(), container=$("exerciseList"); container.innerHTML="";
  w.exercises.forEach((ex,exIndex)=>{
    const node=$("exerciseTemplate").content.cloneNode(true), card=node.querySelector(".exercise-card");
    card.dataset.exIndex=exIndex;
    const img=node.querySelector(".exercise-image");
    if(ex.image) { img.src=ex.image; img.alt=ex.name; img.classList.remove("hidden"); }
    node.querySelector(".exercise-name").textContent=ex.name;
    node.querySelector(".exercise-meta").textContent=`${ex.sets} serii × ${ex.reps} reps · pauză ${ex.rest} sec`;
    const pr=exercisePR(ex.name);
    node.querySelector(".pr-line").textContent=pr.best ? `Record: ${pr.best} kg × ${pr.bestReps}` : "Record: încă nesetat";
    const last=getLastExerciseData(ex.name);
    node.querySelector(".last-session").textContent=last
      ? "Ultima dată: "+last.sets.filter(s=>s.done).map(s=>`${s.kg||0} kg × ${s.reps||0}`).join(" | ")
      : "Prima sesiune pentru acest exercițiu.";
    const setsBox=node.querySelector(".sets"); let doneCount=0;

    for(let i=0;i<ex.sets;i++) {
      const s=draft?.[exIndex]?.[i]||{}; if(s.done)doneCount++;
      const row=document.createElement("div"); row.className="set-row";
      row.innerHTML=`<div class="set-index">${i+1}</div>
        <input inputmode="decimal" placeholder="kg" value="${s.kg??""}">
        <input inputmode="numeric" placeholder="reps" value="${s.reps??""}">
        <button class="check-btn ${s.done?"done":""}">${s.done?"✓":"○"}</button>`;
      const [kgInput,repsInput]=row.querySelectorAll("input"), check=row.querySelector(".check-btn");
      const persist=()=>{
        const d=getDraft(); d[exIndex] ||= {}; d[exIndex][i] ||= {};
        d[exIndex][i]={kg:kgInput.value,reps:repsInput.value,done:check.classList.contains("done")}; setDraft(d);
      };
      kgInput.oninput=persist; repsInput.oninput=persist;
      check.onclick=()=>{
        const was=check.classList.contains("done"); check.classList.toggle("done");
        check.textContent=was?"○":"✓"; persist(); updateExerciseProgress(card,ex.sets);
        if(!was) startRestTimer(ex.rest);
      };
      setsBox.appendChild(row);
    }
    node.querySelector(".exercise-progress").textContent=`${doneCount}/${ex.sets}`;
    container.appendChild(node);
  });
}
function updateExerciseProgress(card,total) {
  const done=card.querySelectorAll(".check-btn.done").length;
  card.querySelector(".exercise-progress").textContent=`${done}/${total}`;
}
function startRestTimer(sec) {
  state.restRemaining=sec; $("restTimer").textContent=formatTime(sec); $("restTimerOverlay").classList.remove("hidden");
  clearInterval(state.restInterval); state.restInterval=setInterval(()=>{
    state.restRemaining--; $("restTimer").textContent=formatTime(Math.max(0,state.restRemaining));
    if(state.restRemaining<=0) { clearInterval(state.restInterval); if("vibrate" in navigator) navigator.vibrate([150,100,150]); setTimeout(closeRestTimer,500); }
  },1000);
}
function closeRestTimer() { clearInterval(state.restInterval); $("restTimerOverlay").classList.add("hidden"); }

function finishWorkout() {
  const w=PROGRAM[state.activeDay], draft=getDraft(), duration=Math.max(1,Math.floor((Date.now()-state.startedAt)/1000));
  let completedSets=0;
  const exercises=w.exercises.map((ex,exIndex)=>{
    const sets=[];
    for(let i=0;i<ex.sets;i++) {
      const s=draft?.[exIndex]?.[i]||{}; if(s.done)completedSets++;
      sets.push({kg:Number(s.kg||0),reps:Number(s.reps||0),done:Boolean(s.done)});
    }
    return {name:ex.name,sets};
  });
  const h=load("gymtrack-history",[]);
  h.push({
    id:Date.now(),dayKey:state.activeDay,title:w.title,
    date:new Intl.DateTimeFormat("ro-RO",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date()),
    duration,completedSets,calories:estimateCalories(duration),exercises
  });
  save("gymtrack-history",h); localStorage.removeItem(`gymtrack-draft-${state.activeDay}`);
  clearInterval(state.workoutInterval); closeRestTimer(); state.activeDay=null;
  $("workoutView").classList.add("hidden"); $("homeView").classList.remove("hidden");
  $("workoutTimer").textContent="00:00"; renderHome();
}

$("finishWorkoutBtn").onclick=finishWorkout;
$("backBtn").onclick=()=>{ clearInterval(state.workoutInterval); closeRestTimer(); $("workoutView").classList.add("hidden"); $("homeView").classList.remove("hidden"); renderHome(); };
$("skipTimerBtn").onclick=closeRestTimer;
$("minus15Btn").onclick=()=>{ state.restRemaining=Math.max(0,state.restRemaining-15); $("restTimer").textContent=formatTime(state.restRemaining); };
$("plus15Btn").onclick=()=>{ state.restRemaining+=15; $("restTimer").textContent=formatTime(state.restRemaining); };
$("clearHistoryBtn").onclick=()=>{ if(confirm("Ștergi tot istoricul?")) { localStorage.removeItem("gymtrack-history"); renderHome(); } };

$("settingsBtn").onclick=()=>{
  $("bodyWeightInput").value=getSettings().weight||"";
  $("settingsOverlay").classList.remove("hidden");
};
$("closeSettingsBtn").onclick=()=>$("settingsOverlay").classList.add("hidden");
$("saveSettingsBtn").onclick=()=>{
  const weight=Number(String($("bodyWeightInput").value).replace(",","."));
  save("gymtrack-settings",{weight: weight>0?weight:0});
  $("settingsOverlay").classList.add("hidden"); renderStats();
};

if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
window.addEventListener("resize",()=>{ if(!$("homeView").classList.contains("hidden")) renderChart(); });
renderHome();
