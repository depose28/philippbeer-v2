// Exercise the real component's simulation and lifecycle with a deterministic clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../../assets/lake-ripple.js'), 'utf8');
function setup({width=600, reduced=false, storageBlocked=false, brokenCanvas=false, random}={}) {
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
    ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}},
    IntersectionObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}},
    customElements:{get(){},define(_,value){Lake=value;}}
  };
  vm.runInNewContext(source,ctx);
  const lake=new Lake(), img=new Element(), hint=new Element();
  Object.assign(img,{complete:true,naturalWidth:720,naturalHeight:360,src:'lake.webp',currentSrc:'lake.webp',alt:'Lake and computer'});
  lake.querySelector=s=>s==='img'?img:hint;
  // Browser QA covers pixels. Keep the actual layout grid, input, frame, and timing logic here.
  lake.buildGlass=()=>{}; lake.render=()=>{};
  lake.connectedCallback();
  const tick=(seconds)=>{ const end=clock+seconds*1000; while(clock<end){clock=Math.min(end,clock+1000/60);for(const [i,t]of [...timers])if(t.at<=clock){timers.delete(i);t.fn();} const batch=[...raf];raf.clear();for(const [,fn]of batch)fn(clock);} };
  const event=(target,type,fields={})=>{const e=new Event(type);Object.assign(e,fields);target.dispatchEvent(e);};
  return {lake,img,hint,raf,timers,motion,doc,win,observers,tick,event};
}
for(const width of [272,342,600]) {
  const t=setup({width,storageBlocked:true});
  t.lake.seen(); t.lake.splashBig(width*.35,width/2*.59);
  t.tick(1); assert(t.lake.energy>.006,'drop remains visible initially');
  t.tick(7); assert.equal(t.lake.energy,0,'drop settles within eight seconds');
  assert.equal(t.raf.size,0,'no animation frames after settling');
  assert.equal(t.timers.size,0,'user input cancels the automatic invitation');
}
{
  const t=setup(); t.tick(11); assert.equal(t.lake.energy,0); assert.equal(t.raf.size,0);
  t.tick(1.3); assert(t.lake.energy>0,'invitation starts after twelve seconds');
  t.tick(4.5); assert.equal(t.lake.energy,0); assert.equal(t.raf.size,0);
  t.tick(20); assert.equal(t.lake.energy,0,'invitation does not repeat');
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
  t.observers[1].fn([{isIntersecting:false}]); assert.equal(t.raf.size,0,'offscreen pauses');
}
{
  const t=setup(); let layouts=0; const original=t.lake.layout.bind(t.lake);t.lake.layout=()=>{layouts++; original();};
  for(let i=0;i<10;i++) {t.event(t.win,'resize');t.observers[0].fn();}
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
  assert.equal(t.lake.nextAuto,Infinity,'hover interaction cancels the invitation');
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
  t.lake.cv.clientWidth=600;t.observers[0].fn();t.tick(.2);
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
  const t=setup({reduced:true});t.tick(20);assert.equal(t.raf.size,0);assert.equal(t.lake.energy,0);
}
{
  const t=setup({brokenCanvas:true});assert.equal(t.img.style.display,'');assert(!t.lake.attrs.has('data-ready'));
}
console.log('Lake checks passed: settling, one invitation, flick, screen timing, keyboard controls, visibility, resize, hover drizzle, reduced motion, and fallback.');
