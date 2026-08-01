/* ==========================================================================
   نوار بازخورد پایین صفحه: به‌جای «درست/غلط» ساده، دلیل و راهنمایی می‌دهد
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.Feedback = (function(){
  const bar = document.getElementById('feedback-bar');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  const closeBtn = document.getElementById('feedback-close');
  let hideTimer = null;

  function show(message, kind){
    // kind: 'ok' | 'err' | 'info'
    bar.classList.remove('ok','err');
    if(kind === 'ok'){ bar.classList.add('ok'); icon.textContent='✅'; }
    else if(kind === 'err'){ bar.classList.add('err'); icon.textContent='⚠️'; }
    else { icon.textContent='💡'; }
    text.textContent = message;
    bar.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 9000);
  }

  function hide(){ bar.classList.remove('show'); }

  closeBtn.addEventListener('click', hide);

  return { show, hide };
})();
