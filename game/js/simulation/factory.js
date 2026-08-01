/* ==========================================================================
   شبیه‌سازی زنده کارخانه (پنل سمت راست): نمایش گرافیکی خروجی‌ها و امکان
   فشردن دکمه‌های ورودی توسط کاربر برای تست برنامه لدر

   نکتهٔ مهم فنی: DOM این پنل فقط یک‌بار (در init) ساخته می‌شود و در هر
   تغییر IO فقط کلاس‌ها/متن‌ها به‌روزرسانی می‌شوند (نه بازسازی کامل)؛
   در غیر این صورت انیمیشن‌های CSS (چرخش، حرکت نوار نقاله) هر ۱۳۰
   میلی‌ثانیه از نو شروع می‌شدند و هرگز کامل نمی‌شدند.
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.Factory = (function(){
  const stageEl = document.getElementById('factory-stage');
  const monitorEl = document.getElementById('io-monitor');

  let io = {};
  let onIoChange = function(){};
  let currentLesson = null;

  // مراجع DOM که فقط یک‌بار ساخته و بین به‌روزرسانی‌ها حفظ می‌شوند
  let outputEls = {};   // addr -> { root, visual }
  let buttonEls = {};   // addr -> element

  function gearSvg(){
    // یک چرخ‌دندهٔ ساده و تمیز به‌جای ایموجی؛ رنگ آن از currentColor گرفته می‌شود
    const teeth = Array.from({length:8}).map((_,i)=>
      `<rect x="45" y="2" width="10" height="18" rx="2" fill="currentColor" transform="rotate(${i*45} 50 50)"/>`
    ).join('');
    return `
      <svg viewBox="0 0 100 100" class="gear-svg">
        <g class="gear-rotor">
          ${teeth}
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="11"/>
          <circle cx="50" cy="50" r="13" fill="var(--bg-2)" stroke="currentColor" stroke-width="4"/>
        </g>
      </svg>`;
  }

  function lampSvg(){
    // یک چراغ سیگنال (Pilot Lamp) صنعتی واقعی به‌جای ایموجی؛ حلقهٔ فلزی + لنز که روشن می‌شود
    return `
      <svg viewBox="0 0 100 100" class="lamp-svg">
        <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="9"/>
        <circle cx="50" cy="50" r="26" class="lamp-lens" fill="currentColor"/>
        <circle cx="38" cy="38" r="8" fill="#fff" opacity=".28"/>
      </svg>`;
  }

  function valveSvg(){
    // نماد استاندارد شیر برقی (شبیه دیاگرام‌های P&ID صنعتی) به‌جای ایموجی
    return `
      <svg viewBox="0 0 100 70" class="valve-svg">
        <line x1="50" y1="0" x2="50" y2="18" stroke="currentColor" stroke-width="7"/>
        <rect x="28" y="0" width="44" height="10" rx="3" fill="currentColor"/>
        <path d="M15 22 L50 40 L15 58 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
        <path d="M85 22 L50 40 L85 58 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
      </svg>`;
  }

  function cylinderSvg(){
    // نماد جک پنوماتیک: بدنه ثابت + میله‌ای که با فرمان بیرون می‌آید
    return `
      <svg viewBox="0 0 120 50" class="cyl-svg">
        <rect x="8" y="12" width="52" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="7"/>
        <line class="cyl-rod" x1="60" y1="25" x2="86" y2="25" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
        <rect class="cyl-rod" x="82" y="10" width="10" height="30" rx="2" fill="currentColor"/>
      </svg>`;
  }

  function boxDivs(count){
    let out = '';
    for(let i=0;i<count;i++){ out += '<div class="fx-box"></div>'; }
    return out;
  }

  function init(lesson, ioChangeCb){
    currentLesson = lesson;
    onIoChange = ioChangeCb || function(){};
    io = {};
    lesson.io.inputs.forEach(i=> io[i.addr]=false);
    lesson.io.outputs.forEach(o=> io[o.addr]=false);
    outputEls = {};
    buttonEls = {};
    buildDom();
    update();
    renderMonitor();
  }

  function setIo(newIo){
    io = newIo;
    update();
    renderMonitor();
  }

  function getIo(){ return io; }

  /* ---------------- ساخت یک‌بارهٔ ساختار DOM ---------------- */
  function buildDom(){
    stageEl.innerHTML = '';
    if(!currentLesson) return;
    // فقط درسی که صراحتاً این پرچم را دارد (خط تولید کامل) از چیدمان
    // جایگزین «پشت‌سرهم» استفاده می‌کند؛ بقیهٔ درس‌ها (حتی آن‌هایی که ۳
    // خروجی دارند، مثل چراغ راهنمایی) همان چیدمان همیشگی و وسط‌چین را
    // دارند تا چیزی برایشان تغییر نکند.
    stageEl.classList.toggle('stacked', !!currentLesson.stackedLayout);

    const outRow = document.createElement('div');
    outRow.className = 'fx-out-row' + (currentLesson.trafficLightLayout ? ' vertical' : '');
    currentLesson.io.outputs.forEach(out=>{
      const wrap = document.createElement('div');
      if(out.equip === 'motor'){
        wrap.className = 'fx-motor';
        wrap.innerHTML = `${gearSvg()}<div class="fx-lamp-label">${out.label} (${out.addr})</div>`;
        outputEls[out.addr] = { root: wrap, visual: wrap.querySelector('.gear-svg') };
      } else if(out.equip === 'solenoid_valve'){
        wrap.className = 'fx-valve';
        wrap.innerHTML = `${valveSvg()}<div class="fx-valve-drip"><div class="drip"></div><div class="drip" style="animation-delay:.35s"></div></div><div class="fx-lamp-label">${out.label} (${out.addr})</div>`;
        outputEls[out.addr] = { root: wrap, visual: wrap.querySelector('.valve-svg'), drip: wrap.querySelector('.fx-valve-drip') };
      } else if(out.equip === 'cylinder'){
        wrap.className = 'fx-cylinder';
        wrap.innerHTML = `${cylinderSvg()}<div class="fx-lamp-label">${out.label} (${out.addr})</div>`;
        outputEls[out.addr] = { root: wrap, visual: wrap.querySelector('.cyl-svg') };
      } else {
        wrap.className = 'fx-lamp fx-lamp-inline';
        wrap.innerHTML = `${lampSvg()}<div class="fx-lamp-label">${out.label} (${out.addr})</div>`;
        outputEls[out.addr] = { root: wrap, visual: wrap.querySelector('.lamp-svg') };
      }
      outRow.appendChild(wrap);
    });
    stageEl.appendChild(outRow);

    // نوار نقالهٔ تزئینی (اختیاری)
    if(currentLesson.conveyorMotorAddr){
      const belt = document.createElement('div');
      belt.className = 'fx-belt';
      belt.innerHTML = `<div class="fx-belt-track">${boxDivs(10)}</div>`;
      stageEl.appendChild(belt);
      outputEls['__belt__'] = { root: belt, visual: belt.querySelector('.fx-belt-track'), addr: currentLesson.conveyorMotorAddr };
    }

    // ورودی‌ها (دکمه‌ها) — در یک ردیف قابل شکستن، تا هرگز از قاب بیرون نزنند
    const row = document.createElement('div');
    row.className = 'fx-btn-row';
    const clsMap = { start_button:'start', stop_button:'stop', sensor:'sensor', reset_button:'reset', limit_switch:'limit' };
    const pressableInputs = currentLesson.io.inputs.filter(inp=> clsMap[inp.equip]);
    row.classList.toggle('fx-btn-row-compact', pressableInputs.length > 3);

    pressableInputs.forEach(inp=>{
      const btn = document.createElement('div');
      btn.className = `fx-btn ${clsMap[inp.equip]}`;
      btn.textContent = inp.addr;
      btn.title = inp.label;

      const press = ()=>{ io[inp.addr]=true; PLC.Sound.click(); update(); onIoChange(io); renderMonitor(); };
      const release = ()=>{ io[inp.addr]=false; update(); onIoChange(io); renderMonitor(); };

      btn.addEventListener('mousedown', press);
      btn.addEventListener('touchstart', (e)=>{e.preventDefault();press();});
      ['mouseup','mouseleave'].forEach(ev=>btn.addEventListener(ev, release));
      btn.addEventListener('touchend', release);

      buttonEls[inp.addr] = btn;
      row.appendChild(btn);
    });
    stageEl.appendChild(row);

    const hint = document.createElement('div');
    hint.className = 'fx-hint';
    hint.textContent = 'دکمه را نگه‌دار تا فعال بماند، مثل دکمه واقعی صنعتی';
    stageEl.appendChild(hint);
  }

  /* ---------------- به‌روزرسانی سبک (بدون بازسازی DOM) ---------------- */
  function update(){
    if(!currentLesson) return;

    currentLesson.io.outputs.forEach(out=>{
      const ref = outputEls[out.addr];
      if(!ref) return;
      const on = !!io[out.addr];
      ref.visual.classList.toggle('on', on);
      if(ref.drip){ ref.drip.classList.toggle('on', on); }
    });

    if(outputEls['__belt__']){
      const belt = outputEls['__belt__'];
      belt.visual.classList.toggle('moving', !!io[belt.addr]);
    }

    Object.keys(buttonEls).forEach(addr=>{
      buttonEls[addr].classList.toggle('pressed', !!io[addr]);
    });
  }

  function renderMonitor(){
    monitorEl.innerHTML = '';
    if(!currentLesson) return;
    const all = [...currentLesson.io.inputs, ...currentLesson.io.outputs, ...(currentLesson.internal||[])];
    all.forEach(sig=>{
      const chip = document.createElement('div');
      chip.className = 'io-chip' + (io[sig.addr] ? ' on' : '');
      chip.textContent = `${sig.addr}: ${io[sig.addr] ? '1':'0'}`;
      monitorEl.appendChild(chip);
      const cvKey = sig.addr + '_CV';
      if(io[cvKey] !== undefined){
        const cvChip = document.createElement('div');
        cvChip.className = 'io-chip';
        cvChip.textContent = `${sig.addr}_CV: ${io[cvKey]}`;
        monitorEl.appendChild(cvChip);
      }
    });
  }

  return { init, setIo, getIo };
})();
