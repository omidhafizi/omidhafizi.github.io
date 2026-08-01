/* ==========================================================================
   ناوبری بین صفحات، رسم نقشه مراحل، رسم پالت تجهیزات/دستورات و پنل مربی
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.Nav = (function(){

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=> s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function renderMap(){
    const wrap = document.getElementById('map-list');
    wrap.innerHTML = '';
    let lastGroup = null;
    let groupEl = null;

    PLC.LESSONS.forEach((lsn, idx)=>{
      if(lsn.group !== lastGroup){
        lastGroup = lsn.group;
        groupEl = document.createElement('div');
        groupEl.className = 'map-group';
        const g = document.createElement('div');
        g.className = 'map-group-title';
        g.textContent = lastGroup;
        groupEl.appendChild(g);
        wrap.appendChild(groupEl);
      }
      const unlocked = PLC.State.isUnlocked(lsn, idx);
      const done = PLC.State.isCompleted(lsn.id);

      const node = document.createElement('div');
      node.className = 'map-node ' + (done?'done':(unlocked?'unlocked':'locked'));
      node.innerHTML = `
        <div class="map-node-num">${done?'✓':(idx+1)}</div>
        <div class="map-node-body">
          <div class="map-node-title">${lsn.title}</div>
          <div class="map-node-desc">${lsn.desc}</div>
        </div>
        <div class="map-node-status">${unlocked ? (done?'':'▶') : '🔒'}</div>`;
      if(unlocked && lsn.equipment){ // فقط درس‌هایی که واقعاً پیاده‌سازی شده‌اند قابل کلیک‌اند
        node.addEventListener('click', ()=> PLC.App.openLesson(lsn.id));
      } else if(unlocked){
        node.addEventListener('click', ()=>{
          PLC.Feedback.show('این مرحله به‌زودی در نسخه‌های بعدی برنامه اضافه می‌شود. فعلاً روی مراحل آماده تمرین کن!', 'info');
        });
      }
      groupEl.appendChild(node);
    });
  }

  function renderPalette(lesson){
    const equipEl = document.getElementById('equip-list');
    const instrEl = document.getElementById('instr-list');
    equipEl.innerHTML = '';
    instrEl.innerHTML = '';

    lesson.equipment.forEach(entry=>{
      const isObj = typeof entry === 'object';
      const key = isObj ? entry.key : entry;
      const eq = PLC.EQUIPMENT_CATALOG[key];
      const label = isObj && entry.label ? entry.label : eq.label;
      const item = document.createElement('div');
      item.className = 'equip-item';
      item.draggable = true;
      item.innerHTML = `<span class="equip-icon">${eq.icon}</span><span class="equip-label">${label}</span><span class="equip-why">؟</span>`;
      item.addEventListener('dragstart', (e)=>{
        const payload = {source:'equipment', key};
        if(isObj && entry.addr) payload.addr = entry.addr;
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      });
      item.querySelector('.equip-why').addEventListener('click', (e)=>{
        e.stopPropagation();
        PLC.WhyPanel.open(key);
      });
      equipEl.appendChild(item);
    });

    lesson.instructions.forEach(entry=>{
      const isObj = typeof entry === 'object';
      const key = isObj ? entry.key : entry;
      const ins = PLC.INSTRUCTION_CATALOG[key];
      const label = isObj && entry.label ? entry.label : ins.label;
      const item = document.createElement('div');
      item.className = 'equip-item';
      item.draggable = true;
      item.innerHTML = `<span class="equip-icon equip-icon-svg">${PLC.LadderEditor.elemSvg(key)}</span><span class="equip-label">${label}</span><span class="equip-why">؟</span>`;
      item.addEventListener('dragstart', (e)=>{
        const payload = {source:'instruction', key};
        if(isObj && entry.addr) payload.addr = entry.addr;
        if(isObj && entry.preset) payload.preset = entry.preset;
        if(isObj && entry.resetAddr) payload.resetAddr = entry.resetAddr;
        if(isObj && entry.setAddr) payload.setAddr = entry.setAddr;
        if(isObj && entry.upAddr) payload.upAddr = entry.upAddr;
        if(isObj && entry.downAddr) payload.downAddr = entry.downAddr;
        e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      });
      item.querySelector('.equip-why').addEventListener('click', (e)=>{
        e.stopPropagation();
        PLC.WhyPanel.open(key);
      });
      instrEl.appendChild(item);
    });
  }

  const STEP_ORDER = ['concept','demo','practice','success'];

  function renderCoach(lesson, stepKey){
    const step = lesson.coach[stepKey];
    document.getElementById('coach-tag').textContent = step.tag;
    document.getElementById('coach-body').innerHTML = step.html;
    const actions = document.getElementById('coach-actions');
    actions.innerHTML = '';
    step.actions.forEach(a=>{
      const btn = document.createElement('button');
      btn.className = 'coach-btn' + (a.action==='next' && step.actions.length>1 ? ' secondary':'');
      btn.textContent = a.label;
      btn.addEventListener('click', ()=> PLC.App.handleCoachAction(a.action));
      actions.appendChild(btn);
    });

    const idx = STEP_ORDER.indexOf(stepKey);
    const pct = Math.round(((idx+1)/STEP_ORDER.length)*100);
    document.getElementById('stage-progress-fill').style.width = pct+'%';
  }

  return { showScreen, renderMap, renderPalette, renderCoach, STEP_ORDER };
})();
