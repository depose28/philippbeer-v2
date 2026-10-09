// Exercise the real component's simulation and lifecycle with a deterministic clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/lake-ripple.js'), 'utf8');
function setup({auto=false, width=600, reduced=false, storageBlocked=false, brokenCanvas=false, random}={}) {
  let clock=0, id=0, Lake;
  const raf=new Map(), timers=new Map(), observers=[];
  class Element extends EventTarget {
    constructor() { super(); this.attrs=new Map(); this.style={display:""}; this.children=[]; this.classList={add(){}}; this.isConnected=true; }
    setAttribute(k,v) { this.attrs.set(k,v); }
    getAttribute(k) { return this.attrs.get(k) ?? null; }
    removeAttribute(k) { this.attrs.delete(k); }
    toggleAttribute(k,v) { v ? this.attrs.set(k,'') : this.attrs.delete(k); }
    append(...items) { this.children.push(...items); }
    after() {} remove() {} hasPointerCapture() { return false; } releasePointerCapture() {} setPointerCapture() {}
    getBoundingClientRect() { return {left:0,top:0,width,height:width/2}; }
    getContext() {
      if (brokenCanvas) return null;
      return {drawImage(){},getImageData:(_,__,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:60})};
    }
  }
  const doc=new Element(), win=new Element(), motion=new Element();
  motion.matches=reduced; doc.hidden=false; win.devicePixelRatio=1;
  doc.createElement=()=>{ const e=new Element(); e.clientWidth=width; return e; };
  const math=Object.create(Math); if(random)math.random=random;
  const ctx={Math:math,HTMLElement:Element,AbortController,performance:{now:()=>clock},document:doc,window:win,
    matchMedia:q=>q.includes('reduced') ? motion : {matches:true},
    localStorage:{getItem(){if(storageBlocked)throw Error('blocked');},setItem(){if(storageBlocked)throw Error('blocked');}},
    requestAnimationFrame:fn=>{raf.set(++id,fn);return id;},cancelAnimationFrame:i=>raf.delete(i),
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:clock+ms});return id;},clearTimeout:i=>timers.delete(i),
    ResizeObserver:class{constructor(fn){this.kind='resize';this.fn=fn;observers.push(this);}observe(){}disconnect(){}},
    IntersectionObserver:class{constructor(fn){this.kind='intersection';this.fn=fn;observers.push(this);}observe(){}disconnect(){}},
    customElements:{get(){},define(_,value){Lake=value;}}
  };
  vm.runInNewContext(source,ctx);
  const lake=new Lake(), img=new Element(), hint=new Element(), toggle=new Element();
  if (!auto) lake.setAttribute('auto', 'false');
  Object.assign(img,{complete:true,naturalWidth:720,naturalHeight:360,src:'lake.webp',currentSrc:'lake.webp',alt:'Lake and computer'});
  lake.querySelector=s=>s==='img'?img:s==='.lake-ambient-toggle'?toggle:hint;
  // Browser QA covers pixels. Keep the actual layout grid, input, frame, and timing logic here.
  lake.buildGlass=()=>{}; lake.render=()=>{};
  lake.connectedCallback();
  const tick=(seconds)=>{ const end=clock+seconds*1000; while(clock<end){clock=Math.min(end,clock+1000/60);for(const [i,t]of [...timers])if(t.at<=clock){timers.delete(i);t.fn();} const batch=[...raf];raf.clear();for(const [,fn]of batch)fn(clock);} };
  const event=(target,type,fields={})=>{const e=new Event(type);Object.assign(e,fields);target.dispatchEvent(e);};
  return {lake,img,hint,toggle,raf,timers,motion,doc,win,observers,tick,event};
}
{
  const t=setup({auto:true,random:()=>.5}), l=t.lake;
  t.tick(5);
  const point={isPrimary:true,button:0,pointerId:1,clientX:210,clientY:177};
  t.event(l.cv,'pointerdown',point);
  assert(l.nextAuto-l.now()>=8 && l.nextAuto-l.now()<=11,'press defers ambient ripples');
  assert.equal(l.startupLeft,0,'manual input ends the startup sequence');
  t.event(l.cv,'pointerup',point);
  assert(l.nextAuto-l.now()>=8 && l.nextAuto-l.now()<=11,'completed interaction also defers ambient ripples');
  t.tick(1);assert.equal(l.parts.length,0);assert(l.energy>0);
  const energy=l.energy;t.event(t.toggle,'click');
  assert.equal(l.energy,energy,'pausing automatic motion preserves the manual ripple');
  t.tick(7);assert.equal(l.energy,0);assert.equal(t.raf.size,0);assert.equal(t.timers.size,0);
}
{
  const t=setup({auto:true,random:()=>.5}), io=t.observers.find(o=>o.kind==='intersection');
  io.fn([{isIntersecting:false}]);t.tick(20);
  assert.equal(t.lake.startupLeft,4,'offscreen time does not consume startup ripples');
  io.fn([{isIntersecting:true}]);t.tick(3);assert.equal(t.lake.startupLeft,3);
  io.fn([{isIntersecting:false}]);t.tick(20);
  io.fn([{isIntersecting:true}]);t.tick(3);assert.equal(t.lake.startupLeft,2,'returning resumes remaining ripples without replaying the whole sequence');
  t.event(t.toggle,'click');assert.equal(t.lake.startupLeft,0,'pausing dismisses the remaining startup sequence');
}
{
  let value=0;const t=setup({auto:true,random:()=>value});
  Object.assign(t.lake,{lastAutoX:.3,nextAuto:0});
  t.tick(.1);
  assert.equal(t.lake.startupLeft,4,'rejected shoreline positions do not consume a startup ripple');
  assert.equal(t.lake.energy,0);assert.equal(t.lake.lastAutoX,.3);
  value=.5;t.tick(3);
  assert.equal(t.lake.startupLeft,3,'a later safe position resumes the startup sequence');
}
for(const width of [272,342,600]) {
  const t=setup({width,storageBlocked:true});
  t.lake.seen(); t.lake.splashBig(width*.35,width/2*.59);
  t.tick(1); assert(t.lake.energy>.006,'drop remains visible initially');
  t.tick(7); assert.equal(t.lake.energy,0,'drop settles within eight seconds');
  assert.equal(t.raf.size,0,'no animation frames after settling');
  assert.equal(t.timers.size,0,'auto=false leaves no ambient timer');
}
{
  const t=setup({auto:true,random:()=>.5});
  const drops=[];const drop=t.lake.drop.bind(t.lake);
  t.lake.drop=(x,y,amp,rad)=>{drops.push({x,y,amp,rad,at:t.lake.now()});drop(x,y,amp,rad);};
  t.tick(1);assert.equal(drops.length,0);assert.equal(t.raf.size,0,'sleeps between ambient ripples');
  t.tick(1.5);assert.equal(drops.length,1,'first small ripple arrives after a quiet delay');
  assert(drops[0].amp>.1 && drops[0].amp<.85,'ambient ripple is clearer than hover but softer than a click');assert(t.lake.safeWater(drops[0].x,drops[0].y));
  assert.equal(t.lake.queue.length,0,'automatic ripples never throw stones');
  assert.equal(t.lake.parts.length,0,'automatic ripples never spray');
  t.tick(13.5);assert.equal(drops.length,4,'four surface ripples introduce the lake');
  assert.equal(t.lake.startupLeft,0);assert.equal(t.lake.energy,0);assert.equal(t.raf.size,0);
  for(let i=1;i<4;i++) {
    assert(drops[i].at-drops[i-1].at>=2.5 && drops[i].at-drops[i-1].at<=4.1,'startup spacing remains gentle');
    assert(Math.abs(drops[i].x-drops[i-1].x)>=t.lake.W*.13,'successive fish surface in different parts of the lake');
  }
  t.tick(7.5);assert.equal(drops.length,5,'startup settles into the slower ambient rhythm');
  assert(drops[4].at-drops[3].at>=8);
  t.event(t.toggle,'click');t.tick(4);
  assert(t.lake.ambientPaused);assert.equal(t.lake.energy,0);assert.equal(t.timers.size,0);
  t.tick(30);assert.equal(drops.length,5,'pause stops automatic motion');
  t.event(t.toggle,'click');t.tick(4);assert.equal(drops.length,6,'resume restarts after a delay');
  t.doc.hidden=true;t.event(t.doc,'visibilitychange');assert.equal(t.timers.size,0);assert.equal(t.raf.size,0);
  t.tick(30);assert.equal(drops.length,6);
  t.doc.hidden=false;t.event(t.doc,'visibilitychange');t.tick(1);assert.equal(drops.length,6,'returning does not trigger overdue ripples');
  t.observers.find(o=>o.kind==='intersection').fn([{isIntersecting:false}]);assert.equal(t.timers.size,0);
  t.tick(30);assert.equal(drops.length,6);
  t.observers.find(o=>o.kind==='intersection').fn([{isIntersecting:true}]);t.tick(1);assert.equal(drops.length,6);
  t.motion.matches=true;t.event(t.motion,'change');t.tick(.1);
  assert(t.toggle.hidden);assert.equal(t.timers.size,0);assert.equal(t.raf.size,0);
}
for(const width of [272,342,600]) {
  let seed=17;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const t=setup({width,random});let drops=0,lastX;
  t.lake.drop=(x,y,amp)=>{assert(t.lake.safeWater(x,y));assert(amp>.1 && amp<.85);if(lastX!==undefined)assert(Math.abs(x-lastX)>=width*.13);lastX=x;drops++;};
  for(let i=0;i<200;i++)t.lake.surfaceRipple();
  assert.equal(drops,200,'ambient origins stay within the inset water at every width');
  for(let y=0;y<t.lake.BH;y++)for(let x=0;x<t.lake.Wd;x++) {
    if(!t.lake.inW((x+.5)/t.lake.dpr,(t.lake.y0+y+.5)/t.lake.dpr))assert.equal(t.lake.shore[y*t.lake.Wd+x],0,'land pixels never receive ripple distortion');
  }
}
{
  const t=setup(); const l=t.lake; l.seen(); l.throwStone(90,177,.97,-.24,1);
  assert(l.queue.length>1,'flick schedules multiple impacts');
  t.tick(9); assert.equal(l.queue.length,0); assert.equal(t.raf.size,0);
  l.setAttribute('screen','iridescent'); l.flicker(); assert.equal(l.flickFor,.95);
  t.tick(1.1); assert.equal(t.raf.size,0,'screen glow sleeps after finishing');
  t.event(l.controls.children[0],'click'); assert(l.energy>0,'keyboard button triggers a drop');
  t.lake.hover=true; t.doc.hidden=true; t.event(t.doc,'visibilitychange'); assert.equal(t.raf.size,0); assert.equal(t.lake.hover,false,'tab switch clears stale hover');
  t.doc.hidden=false; t.event(t.doc,'visibilitychange'); assert(t.raf.size>0);
  t.observers.find(o=>o.kind==='intersection').fn([{isIntersecting:false}]); assert.equal(t.raf.size,0,'offscreen pauses');
}
{
  const t=setup(); let layouts=0; const original=t.lake.layout.bind(t.lake);t.lake.layout=()=>{layouts++; original();};
  for(let i=0;i<10;i++) {t.event(t.win,'resize');t.observers.find(o=>o.kind==='resize').fn();}
  t.tick(.08); assert.equal(layouts,0);
  t.tick(.04); assert.equal(layouts,1,'window and element resize share one debounce');
  t.lake.disconnectedCallback(); assert.equal(t.raf.size,0); assert.equal(t.timers.size,0);
}
{
  const t=setup(); t.lake.seen();t.lake.splashBig(210,177);t.lake.flicker();
  t.motion.matches=true; t.event(t.motion,'change');t.tick(.1);
  assert.equal(t.lake.energy,0);assert.equal(t.lake.flickAt,undefined);assert.equal(t.raf.size,0);
  t.event(t.lake.cv,'pointerdown',{isPrimary:true,button:0,pointerId:1,clientX:210,clientY:177});
  assert.equal(t.lake.down,null,'reduced motion ignores animated interactions');
  assert(t.lake.attrs.has('data-reduced'));
}
{
  const t=setup({random:()=>0});
  Object.assign(t.lake,{hover:true,mx:210,my:177});t.lake.wake();t.tick(.2);
  assert(t.lake.energy>0,'hover drizzle makes gentle drops');
  assert.equal(t.lake.nextAuto,Infinity,'auto=false remains respected while hovering');
  t.lake.hover=false;t.tick(8);assert.equal(t.raf.size,0,'leaving the lake lets drizzle settle');
}
{
  const t=setup(), cv=t.lake.cv;
  const point={isPrimary:true,button:0,pointerId:1,clientX:210,clientY:177};
  t.event(cv,'pointerdown',point);t.event(cv,'pointerup',point);
  assert(t.lake.energy>0,'pointer tap creates a drop');
  t.lake.settle();t.lake.parts.length=0;
  t.event(cv,'pointerdown',{...point,clientX:80});
  t.event(cv,'pointerup',{...point,clientX:140,clientY:170});
  assert(t.lake.queue.length>1,'pointer flick schedules skips');
  t.event(cv,'pointerdown',point);t.event(cv,'pointercancel',{pointerId:1});
  assert.equal(t.lake.down,null,'native touch scrolling cancels the gesture');
  t.img.currentSrc='lake-1440.webp';t.event(t.img,'load');
  assert.equal(t.lake.source,'lake-1440.webp','responsive source change rebuilds pixels');
}
{
  const t=setup({width:0});
  assert.equal(t.img.style.display,'','zero-width initialization retains the image');
  assert(!t.lake.attrs.has('data-ready'));
  t.lake.cv.clientWidth=600;t.observers.find(o=>o.kind==='resize').fn();t.tick(.2);
  assert(t.lake.attrs.has('data-ready'),'component reveals only after successful layout');
  assert.equal(t.img.style.display,'none');
}
{
  const t=setup();t.lake.dpr=2;t.lake.ema=30;t.lake.seen();t.lake.splashBig(210,177);
  t.tick(.1);assert.equal(t.lake.q,undefined,'slow rendering does not erase a live ripple');
  assert(t.lake.lowerQuality);t.tick(8);assert.equal(t.lake.q,1,'quality adjusts after settling');
  assert.equal(t.raf.size,0);
}
{
  const t=setup({auto:true,reduced:true});t.tick(20);assert.equal(t.raf.size,0);assert.equal(t.lake.energy,0);
}
{
  const t=setup({brokenCanvas:true});assert.equal(t.img.style.display,'');assert(!t.lake.attrs.has('data-ready'));
}
console.log('Lake checks passed: settling, gentle ambient ripples, shoreline bounds, pause/resume, flick, screen timing, keyboard controls, visibility, resize, hover drizzle, reduced motion, and fallback.');
