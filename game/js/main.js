/* ==========================================================================
   هسته اصلی برنامه: باز کردن درس‌ها، مدیریت مراحل مربی، اجرای شبیه‌سازی،
   اعتبارسنجی پاسخ کاربر و مدیریت تکمیل مرحله
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.App = (function(){
  let currentLesson = null;
  let stepKey = 'concept';
  let running = false;
  let scanTimer = null;
  let lastOutputs = {};

  /* ---------------- راه‌اندازی ---------------- */
  function init(){
    PLC.Nav.renderMap();

    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn.textContent = PLC.Sound.isEnabled() ? '🔊' : '🔇';
    soundBtn.addEventListener('click', ()=>{
      PLC.Sound.setEnabled(!PLC.Sound.isEnabled());
      soundBtn.textContent = PLC.Sound.isEnabled() ? '🔊' : '🔇';
      if(PLC.Sound.isEnabled()){ PLC.Sound.click(); }
    });

    document.getElementById('btn-start-journey').addEventListener('click', ()=>{
      PLC.Nav.showScreen('screen-map');
    });
    document.getElementById('btn-map-home').addEventListener('click', ()=> PLC.Nav.showScreen('screen-home'));
    document.getElementById('btn-workshop-back').addEventListener('click', ()=>{
      stopRun();
      PLC.Nav.showScreen('screen-map');
      PLC.Nav.renderMap();
    });
    document.getElementById('btn-restart-stage').addEventListener('click', ()=>{
      if(!currentLesson) return;
      stopRun();
      PLC.LadderEditor.reset();
      PLC.Engine.resetTimers();
      resetFactory();
      goToStep('concept');
    });

    document.getElementById('btn-run').addEventListener('click', startRun);
    document.getElementById('btn-stop').addEventListener('click', stopRun);
    document.getElementById('btn-check').addEventListener('click', checkAnswer);

    document.getElementById('btn-complete-map').addEventListener('click', ()=>{
      document.getElementById('complete-overlay').classList.remove('show');
      PLC.Nav.showScreen('screen-map');
      PLC.Nav.renderMap();
    });
    document.getElementById('btn-complete-next').addEventListener('click', ()=>{
      document.getElementById('complete-overlay').classList.remove('show');
      const idx = PLC.LESSONS.findIndex(l=> l.id === currentLesson.id);
      const next = PLC.LESSONS[idx+1];
      if(next && next.equipment && PLC.State.isUnlocked(next, idx+1)){
        openLesson(next.id);
      } else {
        PLC.Nav.showScreen('screen-map');
        PLC.Nav.renderMap();
      }
    });
  }

  /* ---------------- باز کردن یک درس ---------------- */
  function openLesson(id){
    const idx = PLC.LESSONS.findIndex(l=> l.id === id);
    currentLesson = PLC.LESSONS[idx];
    if(!currentLesson || !currentLesson.equipment) return;

    document.getElementById('workshop-title').textContent = currentLesson.title;
    PLC.Nav.renderPalette(currentLesson);
    PLC.LadderEditor.build(currentLesson, onUserEditedLadder);
    PLC.Engine.resetTimers();
    PLC.Factory.init(currentLesson, onFactoryIoChange);
    PLC.State.setCurrentLesson(id);

    goToStep('concept');
    PLC.Nav.showScreen('screen-workshop');
  }

  function goToStep(key){
    stopRun();
    stepKey = key;
    PLC.Nav.renderCoach(currentLesson, stepKey);
    PLC.State.setStepIndex(PLC.Nav.STEP_ORDER.indexOf(key));
  }

  /* ---------------- اکشن‌های دکمه‌های مربی ---------------- */
  function handleCoachAction(action){
    if(action === 'next'){
      const order = PLC.Nav.STEP_ORDER;
      let idx = order.indexOf(stepKey);
      idx = Math.min(idx+1, order.length-1);
      const nextKey = order[idx];
      if(nextKey === 'practice'){
        PLC.LadderEditor.reset();
        PLC.Engine.resetTimers();
        resetFactory();
      }
      goToStep(nextKey);
      return;
    }
    if(action === 'autodemo'){ runAutoDemo(); return; }
    if(action === 'complete'){ completeStage(); return; }
  }

  function runAutoDemo(){
    PLC.LadderEditor.loadRungs(currentLesson.target);
    PLC.Engine.resetTimers();
    resetFactory();

    let io = {};
    currentLesson.io.inputs.forEach(i=> io[i.addr]=false);
    currentLesson.io.outputs.forEach(o=> io[o.addr]=false);
    lastOutputs = Object.assign({}, io);

    function step(overrides, delay){
      return new Promise(resolve=>{
        setTimeout(()=>{
          io = Object.assign({}, io, overrides);
          const res = PLC.Engine.scan(currentLesson.target, io, delay);
          io = res.io;
          PLC.LadderEditor.applyEnergized(res.rungStates);
          PLC.Factory.setIo(io);
          announceIoChanges(io);
          resolve();
        }, delay);
      });
    }

    function defaultSteps(){
      const startAddr = (currentLesson.io.inputs.find(i=> i.equip==='start_button' || i.equip==='sensor')||{}).addr;
      if(!startAddr) return [];
      return [[{[startAddr]:true},500], [{},1100], [{[startAddr]:false},1300]];
    }

    const steps = currentLesson.demoSteps || defaultSteps();
    if(!steps.length) return;

    let chain = Promise.resolve();
    steps.forEach(([overrides, delay])=>{
      chain = chain.then(()=> step(overrides, delay));
    });
    chain.then(()=>{
      setTimeout(()=>{ PLC.LadderEditor.clearEnergized(); PLC.Engine.resetTimers(); resetFactory(); }, 1600);
    });
  }

  /* ---------------- اجرای زنده شبیه‌سازی ---------------- */
  function scanOnce(){
    if(!currentLesson) return;
    const res = PLC.Engine.scan(PLC.LadderEditor.getRungs(), PLC.Factory.getIo(), 130);
    PLC.LadderEditor.applyEnergized(res.rungStates);
    PLC.Factory.setIo(res.io);
    announceIoChanges(res.io);
  }

  function startRun(){
    if(running) return;
    running = true;
    PLC.Engine.resetTimers();
    document.getElementById('btn-run').classList.add('active-run');
    scanTimer = setInterval(scanOnce, 130);
    scanOnce();
  }

  function stopRun(){
    running = false;
    document.getElementById('btn-run').classList.remove('active-run');
    if(scanTimer){ clearInterval(scanTimer); scanTimer = null; }
    PLC.LadderEditor.clearEnergized();
  }

  function onFactoryIoChange(){
    if(running) scanOnce();
  }

  function onUserEditedLadder(){
    if(running) scanOnce();
  }

  function resetFactory(){
    if(!currentLesson) return;
    const off = {};
    currentLesson.io.inputs.forEach(i=> off[i.addr]=false);
    currentLesson.io.outputs.forEach(o=> off[o.addr]=false);
    PLC.Factory.setIo(off);
    lastOutputs = Object.assign({}, off);
  }

  function announceIoChanges(newIo){
    if(!currentLesson) return;
    currentLesson.io.outputs.forEach(o=>{
      const now = !!newIo[o.addr];
      const before = !!lastOutputs[o.addr];
      if(now !== before){
        if(now){ PLC.Sound.energizeOn(); } else { PLC.Sound.energizeOff(); }
      }
      lastOutputs[o.addr] = now;
    });
  }

  /* ---------------- اعتبارسنجی پاسخ کاربر ---------------- */
  function checkAnswer(){
    if(!currentLesson) return;
    const result = validate();
    if(result.ok){
      PLC.Sound.success();
      PLC.Feedback.show('عالی بود! مدار درست است. برو مرحله موفقیت را ببین.', 'ok');
      goToStep('success');
    } else {
      PLC.Sound.error();
      PLC.Feedback.show(result.msg, 'err');
    }
  }

  function compareSlot(u, t){
    const tGroup = !!t.branches;
    const uGroup = !!u.branches;
    if(tGroup && !uGroup){
      return {ok:false, msg:'این جایگاه باید شامل دو کنتاکت موازی (OR) باشد. برای مدار Self-Hold باید یک کنتاکت کمکی را روی همان جایگاه دکمه Start رها کنی تا موازی شود.'};
    }
    if(!tGroup && uGroup){
      return {ok:false, msg:'این جایگاه فقط باید یک کنتاکت ساده داشته باشد، نه دو کنتاکت موازی.'};
    }
    if(!tGroup){
      if(u.type !== t.type){
        const wanted = t.type === 'contact_no' ? 'NO' : 'NC';
        return {ok:false, msg:`نوع کنتاکت مناسب نیست. اینجا باید از کنتاکت ${wanted} با آدرس ${t.addr} استفاده کنی.`};
      }
      if(u.addr !== t.addr){
        return {ok:false, msg:`آدرس کنتاکت اشتباه است. باید ${t.addr} باشد، نه ${u.addr}.`};
      }
      return {ok:true};
    }
    if(u.branches.length !== t.branches.length){
      return {ok:false, msg: u.branches.length < t.branches.length
        ? 'یک کنتاکت موازی دیگر کم داری. یادت باشد کنتاکت نگه‌دارنده (Self-Hold) باید موازی با دکمه Start قرار بگیرد.'
        : 'تعداد کنتاکت‌های موازی بیشتر از حد نیاز است؛ کنتاکت اضافه را از این جایگاه حذف کن.'};
    }
    const remaining = u.branches.slice();
    for(const tb of t.branches){
      const idx = remaining.findIndex(b=> b.type === tb.type && b.addr === tb.addr);
      if(idx === -1){
        const wanted = tb.type === 'contact_no' ? 'NO' : 'NC';
        return {ok:false, msg:`در گروه موازی، یک کنتاکت ${wanted} با آدرس ${tb.addr} کم است یا آدرس/نوعش اشتباه وارد شده.`};
      }
      remaining.splice(idx,1);
    }
    return {ok:true};
  }

  const COIL_KIND_LABELS = {
    coil:'یک کویل ساده', timer_ton:'یک تایمر TON', timer_tof:'یک تایمر TOF', timer_tp:'یک تایمر TP',
    counter_ctu:'یک کانتر CTU', counter_ctd:'یک کانتر CTD', counter_ctud:'یک کانتر دوطرفهٔ CTUD'
  };

  function validate(){
    const userRungs = PLC.LadderEditor.getRungs();
    const targets = currentLesson.target;

    for(let i=0;i<targets.length;i++){
      const target = targets[i];
      const user = userRungs[i];
      if(!user){ return {ok:false, msg:'رانگ مورد نیاز پیدا نشد.'}; }

      const userFilled = user.slots.filter(s=>s);

      if(userFilled.length === 0 && !user.coil){
        return {ok:false, msg:'رانگ هنوز خالی است. تجهیزات لازم را از پالت سمت چپ به داخل رانگ بکش.'};
      }
      if(!user.coil){
        return {ok:false, msg:'خروجی رانگ جا افتاده است. دستور یا تجهیز مربوطه را از پالت بکش و در جایگاه «خروجی رانگ» سمت راست رانگ رها کن.'};
      }
      const tKind = target.coil.kind || 'coil';
      const uKind = user.coil.kind || 'coil';
      if(uKind !== tKind){
        return {ok:false, msg:`این جایگاه باید ${COIL_KIND_LABELS[tKind]||tKind} باشد، نه ${COIL_KIND_LABELS[uKind]||uKind}.`};
      }
      if(user.coil.addr !== target.coil.addr){
        return {ok:false, msg:`آدرس درست نیست. باید ${target.coil.addr} باشد ولی ${user.coil.addr} قرار داده‌ای.`};
      }
      if(tKind === 'counter_ctu' || tKind === 'counter_ctd'){
        const ctrlKey = tKind === 'counter_ctu' ? 'resetAddr' : 'setAddr';
        if((user.coil[ctrlKey] || null) !== (target.coil[ctrlKey] || null)){
          return {ok:false, msg:'آدرس ورودی ریست/بارگذاری کانتر درست تنظیم نشده است؛ از دستور صحیح موجود در پالت استفاده کن.'};
        }
      }
      if(tKind === 'counter_ctud'){
        const keys = ['upAddr','downAddr','resetAddr'];
        const mismatch = keys.some(k => (user.coil[k] || null) !== (target.coil[k] || null));
        if(mismatch){
          return {ok:false, msg:'آدرس‌های ورود/خروج/ریست کانتر دوطرفه درست تنظیم نشده‌اند؛ از دستور صحیح موجود در پالت استفاده کن.'};
        }
      }
      if(userFilled.length < target.slots.length){
        return {ok:false, msg:'یک یا چند جایگاه هنوز خالی است. مدار هنوز کامل نیست.'};
      }
      if(userFilled.length > target.slots.length){
        return {ok:false, msg:'تعداد جایگاه‌های پرشده بیشتر از حد نیاز است. مورد اضافه را حذف کن.'};
      }
      for(let j=0;j<target.slots.length;j++){
        const cmp = compareSlot(userFilled[j], target.slots[j]);
        if(!cmp.ok) return cmp;
      }
    }
    return {ok:true};
  }

  /* ---------------- پایان مرحله ---------------- */
  function completeStage(){
    stopRun();
    PLC.Sound.stageComplete();
    PLC.State.markCompleted(currentLesson.id);
    document.getElementById('complete-text').textContent =
      `درس «${currentLesson.title}» را با موفقیت تمام کردی. آماده مرحله بعدی هستی؟`;
    document.getElementById('complete-overlay').classList.add('show');
  }

  return { init, openLesson, handleCoachAction };
})();

document.addEventListener('DOMContentLoaded', PLC.App.init);
