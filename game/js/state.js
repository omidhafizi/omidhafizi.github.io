/* ==========================================================================
   مدیریت وضعیت کلی برنامه: پیشرفت کاربر، درس جاری، مرحله جاری
   ========================================================================== */
window.PLC = window.PLC || {};

PLC.State = (function(){
  const STORAGE_KEY = 'plc_trainer_progress_v1';

  let data = {
    completed: {},      // { l1: true, ... }
    currentLessonId: null,
    currentStepIndex: 0, // 0 concept,1 demo,2 practice,3 success
  };

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){ data = Object.assign(data, JSON.parse(raw)); }
    }catch(e){ /* اگر ذخیره‌سازی در دسترس نبود، بی‌صدا ادامه بده */ }
  }

  function save(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){}
  }

  function isUnlocked(lesson, index){
    if(lesson.unlocked) return true;
    if(index === 0) return true;
    const prev = PLC.LESSONS[index-1];
    return !!data.completed[prev.id];
  }

  function isCompleted(id){ return !!data.completed[id]; }

  function markCompleted(id){
    data.completed[id] = true;
    save();
  }

  function setCurrentLesson(id){
    data.currentLessonId = id;
    data.currentStepIndex = 0;
    save();
  }

  function setStepIndex(i){
    data.currentStepIndex = i;
    save();
  }

  function getStepIndex(){ return data.currentStepIndex; }
  function getCurrentLessonId(){ return data.currentLessonId; }

  load();

  return { isUnlocked, isCompleted, markCompleted, setCurrentLesson, setStepIndex, getStepIndex, getCurrentLessonId };
})();
