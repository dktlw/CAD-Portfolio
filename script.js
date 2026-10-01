'use strict';
(() => {
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 const desktop = matchMedia('(min-width:901px) and (pointer:fine)');
 const videos = [...document.querySelectorAll('video')];
 const visibleVideos = new Set();
 function play(v) {
  if (document.hidden || reduced.matches || !visibleVideos.has(v)) return;
  if (!v.getAttribute('src')) { v.src=v.dataset.src; v.load(); }
  v.muted=true; v.play()?.catch(()=>{});
 }
 const videoObserver = new IntersectionObserver(entries=>entries.forEach(({target:v,isIntersecting})=>{
  if(isIntersecting){visibleVideos.add(v);play(v);}else{visibleVideos.delete(v);v.pause();}
 }),{rootMargin:'120px'});
 videos.forEach(v=>videoObserver.observe(v));
 document.addEventListener('visibilitychange',()=>videos.forEach(v=>document.hidden?v.pause():play(v)));
 reduced.addEventListener('change',()=>videos.forEach(v=>reduced.matches?v.pause():play(v)));
 const revealObserver=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
  if(isIntersecting){target.classList.remove('waiting');target.classList.add('visible');}else if(!reduced.matches){target.classList.remove('visible');target.classList.add('waiting');}
 }),{threshold:0.16,rootMargin:'0px'});
 document.querySelectorAll('.reveal').forEach(s=>{if(s.getBoundingClientRect().top>innerHeight&&!reduced.matches)s.classList.add('waiting');revealObserver.observe(s);});
 // Native-height expansion preserves reading order and pushes the media down.
 document.querySelectorAll('.expandable').forEach(box=>{
  const p=box.querySelector('p'),button=box.querySelector('button');
  let expanded=false;
  const update=()=>{
   const mobile=matchMedia('(max-width:900px), (pointer:coarse) and (max-width:1100px)').matches;
   box.classList.toggle('is-collapsed',(mobile||box.id==='intro-description')&&!expanded);
   button.hidden=(!mobile&&box.id!=='intro-description') || (!expanded && p.scrollHeight<=p.clientHeight+2);
  };
  button.addEventListener('click',()=>{expanded=!expanded;button.textContent=expanded?'Show less':'Show more';button.setAttribute('aria-expanded',String(expanded));update();});
  new ResizeObserver(update).observe(p);document.fonts.ready.then(update);update();
 });
 // One desktop wheel gesture advances one panel; Ctrl+wheel remains browser zoom.
 let lastWheel=0,gestureUsed=false,scrolling=false,timer;
 const panels=[...document.querySelectorAll('.panel')];
 function nextPanel(direction){
  const aim=innerHeight/2;
  let index=panels.reduce((best,p,i)=>Math.abs(p.getBoundingClientRect().top+p.getBoundingClientRect().height/2-aim)<Math.abs(panels[best].getBoundingClientRect().top+panels[best].getBoundingClientRect().height/2-aim)?i:best,0);
  index=Math.max(0,Math.min(panels.length-1,index+direction));
  const top=scrollY+panels[index].closest('.screen').getBoundingClientRect().top;
  scrolling=true;window.scrollTo({top:Math.max(0,top),behavior:reduced.matches?'instant':'smooth'});
  clearTimeout(timer);timer=setTimeout(()=>{scrolling=false;},1000);
 }
 window.addEventListener('wheel',event=>{
  if(!desktop.matches||event.ctrlKey||event.metaKey||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
  event.preventDefault();
  const now=performance.now();if(now-lastWheel>220&&!scrolling)gestureUsed=false;lastWheel=now;
  if(gestureUsed||scrolling)return;gestureUsed=true;nextPanel(Math.sign(event.deltaY));
 },{passive:false});
 window.addEventListener('scrollend',()=>{scrolling=false;});
 // Caption text is kept in a small, editable file; no guessed annotations.
 document.querySelectorAll('.gallery-card').forEach(card=>{
  const caption=window.PORTFOLIO_CAPTIONS?.[card.dataset.project];if(caption)card.querySelector('.caption').textContent=caption;
 });
 const galleries=[];
 document.querySelectorAll('.marquee').forEach(gallery=>{
  const track=gallery.querySelector('.marquee-track'),group=track.firstElementChild;
  const clone=group.cloneNode(true);clone.setAttribute('aria-hidden','true');clone.querySelectorAll('[tabindex]').forEach(n=>n.removeAttribute('tabindex'));track.append(clone);
  const state={gallery,track,group,x:0,width:0,visible:false,ready:false,hover:false,held:false,paused:false,direction:0,focus:false};galleries.push(state);
  gallery.querySelectorAll('.gallery-card').forEach(card=>{
   card.addEventListener('pointerenter',event=>{if(event.pointerType!=='mouse')return;gallery.querySelectorAll('.gallery-card').forEach(c=>c.classList.toggle('expanded',c.dataset.project===card.dataset.project));});
   card.addEventListener('pointerleave',event=>{if(event.pointerType!=='mouse')return;gallery.querySelectorAll('.expanded').forEach(c=>c.classList.remove('expanded'));});
  });
  const resize=()=>{state.width=group.getBoundingClientRect().width;};new ResizeObserver(resize).observe(group);resize();
  new IntersectionObserver(entries=>entries.forEach(({isIntersecting})=>{
   state.visible=isIntersecting;
   if(isIntersecting&&!gallery.dataset.prepared){gallery.dataset.prepared='true';const imgs=[...gallery.querySelectorAll('img')];imgs.forEach(i=>i.loading='eager');Promise.all(imgs.map(i=>i.decode().catch(()=>{}))).then(()=>{state.ready=true;});}
  }),{rootMargin:'100px'}).observe(gallery);
  gallery.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')state.hover=true;});
  gallery.addEventListener('pointermove',e=>{
   if(e.pointerType==='mouse'){state.hover=true;state.direction=e.clientX<innerWidth*.2?-1:e.clientX>innerWidth*.8?1:0;gallery.dataset.direction=state.direction<0?'left':state.direction>0?'right':'';}
   else if(state.held){state.x=state.startOffset+state.startX-e.clientX;}
  });
  gallery.addEventListener('pointerleave',()=>{state.hover=false;state.direction=0;gallery.dataset.direction='';});
  gallery.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse')return;
   state.held=true;state.startX=e.clientX;state.startOffset=state.x;gallery.classList.add('is-held');gallery.setPointerCapture(e.pointerId);
  });
  const release=()=>{state.held=false;state.hover=false;state.direction=0;gallery.classList.remove('is-held');};
  gallery.addEventListener('pointerup',release);gallery.addEventListener('pointercancel',release);gallery.addEventListener('lostpointercapture',release);
  gallery.addEventListener('focusin',e=>{state.focus=e.target.matches(':focus-visible');});gallery.addEventListener('focusout',()=>state.focus=false);
  gallery.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();state.x+=(e.key==='ArrowRight'?1:-1)*250;}});
  gallery.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){e.preventDefault();state.x+=e.deltaX;}},{passive:false});

 });
 let last=performance.now();
 function frame(now){
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(!document.hidden)galleries.forEach(s=>{
   if(!s.visible||!s.ready||!s.width)return;
   let speed=0;
   if(!s.held&&!s.paused&&!s.focus){if(s.direction)speed=s.direction*145;else if(!s.hover&&!reduced.matches)speed=s.gallery.closest('section').getAttribute('aria-labelledby')==='other-title'?-18:18;}
   s.x=((s.x+dt*speed)%s.width+s.width)%s.width;
   const transform=`translate3d(${-s.x}px,0,0)`; if(transform!==s.lastTransform){s.track.style.transform=transform;s.lastTransform=transform;}
  });requestAnimationFrame(frame);
 }requestAnimationFrame(frame);
})();

// Discourage casual media saving without interfering with text or navigation.
(() => {
 const isMedia = target => target instanceof Element && !!target.closest('img, video');
 ['contextmenu', 'dragstart'].forEach(type => document.addEventListener(type, event => {
  if (isMedia(event.target)) event.preventDefault();
 }));
 document.addEventListener('copy', event => {
  const selection = window.getSelection();
  if (isMedia(event.target) && (!selection || selection.isCollapsed)) event.preventDefault();
 });
})();
