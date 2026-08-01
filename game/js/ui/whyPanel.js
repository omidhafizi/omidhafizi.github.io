/* ==========================================================================
   مودال «چرا؟»: نمایش توضیح عملکرد، کاربرد صنعتی، مثال و نکته هر قطعه
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.WhyPanel = (function(){
  const overlay = document.getElementById('why-overlay');
  const closeBtn = document.getElementById('why-close');

  function open(key){
    const info = PLC.INFO[key];
    if(!info) return;
    document.getElementById('why-icon').textContent = info.icon;
    document.getElementById('why-title').textContent = info.title;
    document.getElementById('why-func').textContent = info.func;
    document.getElementById('why-use').textContent = info.use;
    document.getElementById('why-example').textContent = info.example;
    document.getElementById('why-tip').textContent = info.tip;
    overlay.classList.add('show');
  }

  function close(){ overlay.classList.remove('show'); }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if(e.target === overlay) close(); });

  return { open, close };
})();
