/* ==========================================================================
   موتور اسکن PLC: هر بار «اجرا» فراخوانی می‌شود و رانگ‌ها را از چپ به راست
   ارزیابی می‌کند (سری = AND) و کویل خروجی را تعیین می‌کند.
   نتیجه شامل وضعیت انرژی‌دار بودن هر اسلات هم هست تا UI بتواند رنگ کند.
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.Engine = (function(){

  // حالت داخلی تایمرها و کانترها بین اسکن‌ها حفظ می‌شود (بر خلاف کنتاکت/کویل که بدون حافظه‌اند)
  let timers = {};    // { T0: { acc, dn, wasOn, running, prevFlow } }
  let counters = {};  // { C0: { count, dn, prevFlow } }

  function resetTimers(){ timers = {}; counters = {}; }

  // io: { X0:false, Y0:false, ... }
  function evalSingle(entry, io){
    const raw = !!io[entry.addr];
    return entry.type === 'contact_nc' ? !raw : raw;
  }

  function evalContact(slot, io){
    if(!slot) return null;
    if(slot.branches){
      return slot.branches.some(b => evalSingle(b, io));
    }
    return evalSingle(slot, io);
  }

  function runTimerTon(addr, preset, flow, dt){
    const st = timers[addr] || (timers[addr] = { acc:0, dn:false });
    if(flow){ st.acc = Math.min(preset, st.acc + dt); }
    else { st.acc = 0; }
    st.dn = st.acc >= preset;
    return st.dn;
  }

  function runTimerTof(addr, preset, flow, dt){
    const st = timers[addr] || (timers[addr] = { acc:0, dn:false, wasOn:false });
    if(flow){ st.acc = 0; st.dn = true; st.wasOn = true; }
    else if(st.wasOn){
      st.acc = Math.min(preset, st.acc + dt);
      st.dn = st.acc < preset;
      if(!st.dn){ st.wasOn = false; }
    } else {
      st.dn = false;
    }
    return st.dn;
  }

  function runTimerTp(addr, preset, flow, dt){
    const st = timers[addr] || (timers[addr] = { acc:0, dn:false, running:false, prevFlow:false });
    const risingEdge = flow && !st.prevFlow;
    if(risingEdge && !st.running){ st.running = true; st.acc = 0; }
    if(st.running){
      st.acc += dt;
      if(st.acc >= preset){ st.running = false; st.acc = preset; }
    }
    st.dn = st.running;
    st.prevFlow = flow;
    return st.dn;
  }

  function runCounter(kind, addr, preset, ctrlActive, flow){
    const isUp = kind === 'counter_ctu';
    const st = counters[addr] || (counters[addr] = { count: isUp ? 0 : preset, dn:false, prevFlow:false });
    if(ctrlActive){
      st.count = isUp ? 0 : preset;
    } else if(flow && !st.prevFlow){
      st.count = isUp ? Math.min(preset, st.count+1) : Math.max(0, st.count-1);
    }
    st.prevFlow = flow;
    st.dn = isUp ? st.count >= preset : st.count <= 0;
    st.lastCount = st.count;
    return st;
  }

  // کانتر دوطرفه (Up/Down): برخلاف CTU/CTD معمولی، به «جریان رانگ» وابسته نیست؛
  // مستقیماً دو آدرس مجزا (ورود/خروج) را می‌خواند — چون این دو رویداد از دو
  // منبع متفاوت (دو سنسور) می‌آیند و نمی‌توان آن‌ها را در یک زنجیرهٔ سری گنجاند.
  function runCounterUpDown(addr, preset, upAddr, downAddr, resetAddr, newIo){
    const st = counters[addr] || (counters[addr] = { count:0, dn:false, prevUp:false, prevDown:false });
    const upNow = !!newIo[upAddr];
    const downNow = !!newIo[downAddr];
    const resetActive = resetAddr ? !!newIo[resetAddr] : false;
    if(resetActive){
      st.count = 0;
    } else {
      if(upNow && !st.prevUp){ st.count = Math.min(preset, st.count+1); }
      if(downNow && !st.prevDown){ st.count = Math.max(0, st.count-1); }
    }
    st.prevUp = upNow;
    st.prevDown = downNow;
    st.dn = st.count >= preset;
    return st;
  }

  /**
   * rungs: آرایه‌ای از { slots:[...], coil }
   * انواع coil: {addr} ساده | {kind:'timer_ton'|'timer_tof'|'timer_tp', addr, preset}
   *             | {kind:'counter_ctu', addr, preset, resetAddr} | {kind:'counter_ctd', addr, preset, setAddr}
   * io: آبجکت وضعیت فعلی ورودی/خروجی
   * dt: میلی‌ثانیه سپری‌شده از اسکن قبلی (برای تایمرها لازم است)
   * خروجی: { io: نسخه به‌روزشده, rungStates: [{slotEnergized:[bool], wireEnergized, coilEnergized}] }
   *
   * نکته: رانگ‌ها به ترتیب از بالا به پایین پردازش می‌شوند و نتیجه هر رانگ
   * بلافاصله در newIo قرار می‌گیرد، تا رانگ‌های بعدی در همان اسکن مقدار
   * به‌روز را ببینند — دقیقاً مثل اجرای واقعی PLC.
   */
  function scan(rungs, io, dt){
    dt = dt || 0;
    const newIo = Object.assign({}, io);
    const rungStates = rungs.map(rung=>{
      let flow = true;
      const slotEnergized = [];
      rung.slots.forEach(slot=>{
        const v = evalContact(slot, newIo);
        if(v === null){ slotEnergized.push(false); return; }
        flow = flow && v;
        slotEnergized.push(flow);
      });

      let coilEnergized = false;
      const coil = rung.coil;
      const kind = coil ? (coil.kind || 'coil') : null;

      if(kind === 'coil'){
        coilEnergized = flow;
        newIo[coil.addr] = coilEnergized;
      } else if(kind === 'timer_ton'){
        coilEnergized = runTimerTon(coil.addr, coil.preset || 1000, flow, dt);
        newIo[coil.addr] = coilEnergized;
      } else if(kind === 'timer_tof'){
        coilEnergized = runTimerTof(coil.addr, coil.preset || 1000, flow, dt);
        newIo[coil.addr] = coilEnergized;
      } else if(kind === 'timer_tp'){
        coilEnergized = runTimerTp(coil.addr, coil.preset || 1000, flow, dt);
        newIo[coil.addr] = coilEnergized;
      } else if(kind === 'counter_ctu' || kind === 'counter_ctd'){
        const ctrlAddr = kind === 'counter_ctu' ? coil.resetAddr : coil.setAddr;
        const ctrlActive = ctrlAddr ? !!newIo[ctrlAddr] : false;
        const st = runCounter(kind, coil.addr, coil.preset || 5, ctrlActive, flow);
        coilEnergized = st.dn;
        newIo[coil.addr] = st.dn;
        newIo[coil.addr + '_CV'] = st.count;
      } else if(kind === 'counter_ctud'){
        const st = runCounterUpDown(coil.addr, coil.preset || 5, coil.upAddr, coil.downAddr, coil.resetAddr, newIo);
        coilEnergized = st.dn;
        newIo[coil.addr] = st.dn;
        newIo[coil.addr + '_CV'] = st.count;
      }

      return { slotEnergized, wireEnergized: flow, coilEnergized };
    });
    return { io:newIo, rungStates };
  }

  return { scan, resetTimers };
})();
