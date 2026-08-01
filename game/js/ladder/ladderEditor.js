/* ==========================================================================
   محیط Ladder Diagram: رسم رانگ‌ها، Drag & Drop تجهیزات/دستورات، و
   نمایش بصری جریان انرژی (سبز/کهربایی) هنگام اجرا
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.LadderEditor = (function(){
  const canvasEl = document.getElementById('ladder-canvas');
  const SLOTS_PER_RUNG = 4;

  let lesson = null;
  let rungs = [];        // ساختار کاری کاربر: [{slots:[null|{type,addr}], coil:null|{addr}}]
  let onChange = function(){};

  function elemSvg(type){
    if(type === 'contact_no'){
      return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="14" y2="17"/><line x1="14" y1="4" x2="14" y2="30"/><line x1="30" y1="4" x2="30" y2="30"/><line x1="30" y1="17" x2="44" y2="17"/></svg>`;
    }
    if(type === 'contact_nc'){
      return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="14" y2="17"/><line x1="14" y1="4" x2="14" y2="30"/><line x1="30" y1="4" x2="30" y2="30"/><line x1="30" y1="17" x2="44" y2="17"/><path d="M11 30 L33 4"/></svg>`;
    }
    if(type === 'coil'){
      return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="10" y2="17"/><path d="M10 17 a12 12 0 0 1 24 0 a12 12 0 0 1 -24 0"/><line x1="34" y1="17" x2="44" y2="17"/></svg>`;
    }
    if(type === 'timer_ton' || type === 'timer_tof' || type === 'timer_tp'){
      const tag = type === 'timer_tof' ? 'F' : type === 'timer_tp' ? 'P' : 'N';
      return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="8" y2="17"/><rect x="8" y="4" width="28" height="26" rx="4"/><line x1="22" y1="10" x2="22" y2="17"/><line x1="22" y1="17" x2="27" y2="20"/><line x1="36" y1="17" x2="44" y2="17"/></svg>`;
    }
    if(type === 'counter_ctu' || type === 'counter_ctd'){
      const up = type === 'counter_ctu';
      const tipY = up ? 10 : 24;
      const tailY = up ? 24 : 10;
      const wingY = up ? 14 : 20;
      return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="8" y2="17"/><rect x="8" y="4" width="28" height="26" rx="4"/>
        <line x1="18" y1="${tailY}" x2="18" y2="${tipY}"/>
        <line x1="18" y1="${tipY}" x2="14" y2="${wingY}"/>
        <line x1="18" y1="${tipY}" x2="22" y2="${wingY}"/>
        <line x1="36" y1="17" x2="44" y2="17"/></svg>`;
    }
    if(type === 'counter_ctud'){
      return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="8" y2="17"/><rect x="8" y="4" width="28" height="26" rx="4"/>
        <line x1="16" y1="22" x2="16" y2="10"/><line x1="16" y1="10" x2="13" y2="14"/><line x1="16" y1="10" x2="19" y2="14"/>
        <line x1="28" y1="10" x2="28" y2="22"/><line x1="28" y1="22" x2="25" y2="18"/><line x1="28" y1="22" x2="31" y2="18"/>
        <line x1="36" y1="17" x2="44" y2="17"/></svg>`;
    }
    return `<svg class="elem-svg" viewBox="0 0 44 34"><line x1="0" y1="17" x2="44" y2="17"/></svg>`;
  }

  function emptyRungs(count){
    const out = [];
    for(let i=0;i<count;i++){
      out.push({ slots: new Array(SLOTS_PER_RUNG).fill(null), coil: null });
    }
    return out;
  }

  function build(lsn, changeCb){
    lesson = lsn;
    onChange = changeCb || function(){};
    rungs = emptyRungs(lesson.rungs || 1);
    render();
  }

  function reset(){
    rungs = emptyRungs(lesson.rungs || 1);
    render();
  }

  function getRungs(){ return rungs; }

  // برای حالت «نمایش خودکار»: قرار دادن مستقیم یک آرایه رانگ هدف روی بوم
  function loadRungs(targetRungs){
    rungs = targetRungs.map(t=>{
      const slots = new Array(SLOTS_PER_RUNG).fill(null);
      (t.slots||[]).forEach((s, i)=>{ if(i < SLOTS_PER_RUNG) slots[i] = s; });
      return { slots, coil: t.coil || null };
    });
    render();
  }

  function render(){
    canvasEl.innerHTML = '';
    rungs.forEach((rung, ri)=>{
      const rungEl = document.createElement('div');
      rungEl.className = 'rung';
      rungEl.dataset.rung = ri;

      const num = document.createElement('div');
      num.className = 'rung-num';
      num.textContent = ri+1;
      rungEl.appendChild(num);

      const railL = document.createElement('div');
      railL.className = 'rail-v';
      railL.dataset.rail = 'l-'+ri;
      rungEl.appendChild(railL);

      const body = document.createElement('div');
      body.className = 'rung-body';

      const wire = document.createElement('div');
      wire.className = 'rung-wire';
      wire.dataset.wire = ri;
      body.appendChild(wire);

      rung.slots.forEach((slot, si)=>{
        body.appendChild(makeSlot(ri, si, slot));
      });

      const fill = document.createElement('div');
      fill.className = 'rung-fill';
      body.appendChild(fill);

      const coilZone = document.createElement('div');
      coilZone.className = 'rung-slot rung-coil-zone empty';
      coilZone.dataset.rung = ri;
      coilZone.dataset.zone = 'coil';
      coilZone.textContent = rung.coil ? '' : 'خروجی رانگ';
      attachDropHandlers(coilZone, ri, 'coil', null);
      if(rung.coil){ renderPlacedCoil(coilZone, ri, rung.coil); }
      body.appendChild(coilZone);

      rungEl.appendChild(body);

      const railR = document.createElement('div');
      railR.className = 'rail-v';
      railR.dataset.rail = 'r-'+ri;
      rungEl.appendChild(railR);

      canvasEl.appendChild(rungEl);
    });
  }

  function makeSlot(ri, si, slot){
    const el = document.createElement('div');
    el.dataset.rung = ri;
    el.dataset.slot = si;
    if(!slot){
      el.className = 'rung-slot empty';
      el.textContent = '+';
      attachDropHandlers(el, ri, 'slot', si);
    } else if(slot.branches){
      el.className = 'rung-slot parallel';
      renderPlacedGroup(el, ri, si, slot);
      attachDropHandlers(el, ri, 'slot', si);
    } else {
      el.className = 'rung-slot';
      renderPlacedContact(el, ri, si, slot);
      attachDropHandlers(el, ri, 'slot', si);
    }
    return el;
  }

  function renderPlacedContact(el, ri, si, slot){
    el.innerHTML = `
      <div class="ladder-elem" data-why="${slot.type}">
        ${elemSvg(slot.type)}
        <span class="addr">${slot.addr}</span>
      </div>
      <div class="elem-remove" data-remove="1">✕</div>`;
    el.querySelector('[data-why]').addEventListener('click', (e)=>{ e.stopPropagation(); PLC.WhyPanel.open(slot.type); });
    el.querySelector('[data-remove]').addEventListener('click', (e)=>{
      e.stopPropagation();
      rungs[ri].slots[si] = null;
      render();
      onChange();
    });
  }

  function renderPlacedGroup(el, ri, si, slot){
    el.innerHTML = '';
    slot.branches.forEach((b, bi)=>{
      const row = document.createElement('div');
      row.className = 'group-branch';
      row.innerHTML = `
        <div class="ladder-elem" data-why="1">
          ${elemSvg(b.type)}
          <span class="addr">${b.addr}</span>
        </div>
        <div class="elem-remove" data-remove="1">✕</div>`;
      row.querySelector('[data-why]').addEventListener('click', (e)=>{ e.stopPropagation(); PLC.WhyPanel.open(b.type); });
      row.querySelector('[data-remove]').addEventListener('click', (e)=>{
        e.stopPropagation();
        slot.branches.splice(bi,1);
        if(slot.branches.length === 1){ rungs[ri].slots[si] = slot.branches[0]; }
        else if(slot.branches.length === 0){ rungs[ri].slots[si] = null; }
        render();
        onChange();
      });
      el.appendChild(row);
    });
  }

  function renderPlacedCoil(el, ri, coil){
    el.classList.remove('empty');
    const kind = coil.kind || 'coil';
    const isTimer = kind === 'timer_ton' || kind === 'timer_tof' || kind === 'timer_tp';
    const isCounter = kind === 'counter_ctu' || kind === 'counter_ctd' || kind === 'counter_ctud';
    let addrText = coil.addr;
    if(isTimer) addrText += ` (${(coil.preset/1000)}s)`;
    if(isCounter) addrText += ` (PV=${coil.preset})`;
    el.innerHTML = `
      <div class="ladder-elem" data-why="1">
        ${elemSvg(kind)}
        <span class="addr">${addrText}</span>
      </div>
      <div class="elem-remove" data-remove="1">✕</div>`;
    el.querySelector('[data-why]').addEventListener('click', ()=> PLC.WhyPanel.open(kind));
    el.querySelector('[data-remove]').addEventListener('click', (e)=>{
      e.stopPropagation();
      rungs[ri].coil = null;
      render();
      onChange();
    });
  }

  /* ---------- Drag & Drop ---------- */
  function attachDropHandlers(el, ri, kind, si){
    el.addEventListener('dragover', (e)=>{ e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', ()=> el.classList.remove('drag-over'));
    el.addEventListener('drop', (e)=>{
      e.preventDefault();
      el.classList.remove('drag-over');
      let payload;
      try{ payload = JSON.parse(e.dataTransfer.getData('text/plain')); }catch(err){ return; }
      handleDrop(payload, ri, kind, si);
    });
  }

  function resolveDrop(payload){
    // equipment -> نگاشت به یک عنصر لدر پیش‌فرض با آدرس واقعی
    if(payload.source === 'equipment'){
      const eq = PLC.EQUIPMENT_CATALOG[payload.key];
      let addr = payload.addr;
      if(!addr){
        const ioList = eq.ioType === 'input' ? lesson.io.inputs : lesson.io.outputs;
        const match = ioList.find(x=>x.equip === payload.key);
        if(!match) return null;
        addr = match.addr;
      }
      if(eq.ioType === 'input'){
        return { kind:'contact', elem:{ type:'contact_no', addr } };
      } else {
        return { kind:'coil', elem:{ addr } };
      }
    }
    // instruction -> دستور خام؛ اگر آدرس صریح داده نشده باشد، از IO مناسب حدس می‌زنیم
    if(payload.source === 'instruction'){
      if(payload.key === 'coil'){
        const addr = payload.addr || (lesson.io.outputs[0] && lesson.io.outputs[0].addr);
        if(!addr) return null;
        return { kind:'coil', elem:{ addr } };
      }
      if(payload.key === 'timer_ton' || payload.key === 'timer_tof' || payload.key === 'timer_tp'){
        const addr = payload.addr;
        if(!addr) return null;
        return { kind:'coil', elem:{ kind: payload.key, addr, preset: payload.preset || 1000 } };
      }
      if(payload.key === 'counter_ctu'){
        const addr = payload.addr;
        if(!addr) return null;
        return { kind:'coil', elem:{ kind:'counter_ctu', addr, preset: payload.preset || 5, resetAddr: payload.resetAddr } };
      }
      if(payload.key === 'counter_ctd'){
        const addr = payload.addr;
        if(!addr) return null;
        return { kind:'coil', elem:{ kind:'counter_ctd', addr, preset: payload.preset || 5, setAddr: payload.setAddr } };
      }
      if(payload.key === 'counter_ctud'){
        const addr = payload.addr;
        if(!addr) return null;
        return { kind:'coil', elem:{ kind:'counter_ctud', addr, preset: payload.preset || 5, upAddr: payload.upAddr, downAddr: payload.downAddr, resetAddr: payload.resetAddr } };
      }
      if(payload.key === 'contact_no' || payload.key === 'contact_nc'){
        const addr = payload.addr || (lesson.io.inputs[0] && lesson.io.inputs[0].addr);
        if(!addr) return null;
        return { kind:'contact', elem:{ type: payload.key, addr } };
      }
      return null;
    }
    return null;
  }

  function handleDrop(payload, ri, targetKind, si){
    const resolved = resolveDrop(payload);
    if(!resolved){
      PLC.Feedback.show('این قطعه هنوز در این مرحله فعال نیست یا برای این تمرین لازم نیست.', 'info');
      return;
    }
    if(targetKind === 'coil'){
      if(resolved.kind !== 'coil'){
        PLC.Feedback.show('این یک خروجی نیست. کویل باید از یک خروجی مثل لامپ یا موتور ساخته شود و در انتهای رانگ قرار گیرد.', 'err');
        return;
      }
      rungs[ri].coil = resolved.elem;
    } else {
      if(resolved.kind !== 'contact'){
        PLC.Feedback.show('خروجی‌ها (مثل کویل) باید در جایگاه مخصوص انتهای رانگ قرار بگیرند، نه وسط شاخه.', 'err');
        return;
      }
      const existing = rungs[ri].slots[si];
      if(!existing){
        rungs[ri].slots[si] = resolved.elem;
      } else if(existing.branches){
        existing.branches.push(resolved.elem);
      } else {
        rungs[ri].slots[si] = { branches:[existing, resolved.elem] };
      }
    }
    PLC.Sound.drop();
    render();
    onChange();
  }

  /* ---------- نمایش وضعیت انرژی (بعد از اسکن PLC) ---------- */
  function applyEnergized(rungStates){
    rungStates.forEach((state, ri)=>{
      const railL = canvasEl.querySelector(`[data-rail="l-${ri}"]`);
      const railR = canvasEl.querySelector(`[data-rail="r-${ri}"]`);
      const wire = canvasEl.querySelector(`[data-wire="${ri}"]`);
      if(railL) railL.classList.toggle('energized', true); // ریل چپ همیشه زنده است
      if(railR) railR.classList.toggle('energized', state.wireEnergized);
      if(wire) wire.classList.toggle('energized', state.wireEnergized);

      rungs[ri].slots.forEach((slot, si)=>{
        const slotEl = canvasEl.querySelector(`[data-rung="${ri}"][data-slot="${si}"]`);
        if(slotEl){ slotEl.classList.toggle('energized', !!state.slotEnergized[si]); }
      });
      const coilZone = canvasEl.querySelector(`[data-rung="${ri}"][data-zone="coil"]`);
      if(coilZone){ coilZone.classList.toggle('energized', state.coilEnergized); }
    });
  }

  function clearEnergized(){
    canvasEl.querySelectorAll('.energized').forEach(el=> el.classList.remove('energized'));
  }

  return { build, reset, getRungs, loadRungs, applyEnergized, clearEnergized, elemSvg };
})();
