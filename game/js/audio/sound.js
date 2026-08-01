/* ==========================================================================
   جلوه‌های صوتی بازی — با Web Audio API ساخته می‌شوند (بدون فایل صوتی خارجی)
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.Sound = (function(){
  const STORAGE_KEY = 'plc_trainer_sound_v1';
  let ctx = null;
  let enabled = true;

  try{
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved !== null) enabled = saved === '1';
  }catch(e){}

  function ensureCtx(){
    if(ctx) return ctx;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }catch(e){ ctx = null; }
    return ctx;
  }

  // در بعضی مرورگرها AudioContext تا اولین تعامل کاربر «معلق» می‌ماند
  function resumeIfNeeded(){
    const c = ensureCtx();
    if(c && c.state === 'suspended'){ c.resume().catch(()=>{}); }
    return c;
  }

  function tone(freq, duration, type, vol, delay){
    if(!enabled) return;
    const c = resumeIfNeeded();
    if(!c) return;
    type = type || 'sine';
    vol = vol == null ? 0.15 : vol;
    delay = delay || 0;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  function click(){ tone(520, 0.05, 'square', 0.10); }
  function drop(){ tone(760, 0.05, 'triangle', 0.12); }
  function energizeOn(){ tone(680, 0.09, 'sine', 0.13); }
  function energizeOff(){ tone(300, 0.09, 'sine', 0.09); }
  function success(){
    tone(523.25, 0.13, 'sine', 0.16, 0);
    tone(659.25, 0.13, 'sine', 0.16, 0.09);
    tone(783.99, 0.20, 'sine', 0.18, 0.18);
  }
  function error(){ tone(180, 0.22, 'sawtooth', 0.13); }
  function stageComplete(){
    [523.25, 659.25, 783.99, 1046.50].forEach((f,i)=> tone(f, 0.17, 'sine', 0.18, i*0.11));
  }

  function setEnabled(v){
    enabled = !!v;
    try{ localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); }catch(e){}
  }
  function isEnabled(){ return enabled; }

  return { click, drop, energizeOn, energizeOff, success, error, stageComplete, setEnabled, isEnabled, resumeIfNeeded };
})();
