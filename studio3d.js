/* Pendulums 3D Studio. This is a renderer and art recorder, NOT a dynamics solver.
 * All lines use sampled XYZ from the existing constrained spherical-pendulum engine.
 * Coordinate convention from physics.js: z is positive downward, pivot at (0,0,0).
 */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const canvas = $('#space3d');
  if (!canvas || !window.Pendulums) return;
  const ctx = canvas.getContext('2d');
  const MAX_LAYERS = 8, MAX_POINTS = 800;
  const studio = {
    yaw: -.55, pitch: .67, zoom: 1, panX: 0, panY: 0, center: [0,0,3.5],
    layers: [], keep: true, showStrings: true, showBox: true, palette: 'original',
    overlayColors: {}, frame: null, lastFetch: -Infinity, redraw: true,
    pointers: new Map(), gesture: null, mode: 'orbit', size: [0,0], dpr: 1, soloRecipes: {}
  };
  const themes = {
    original: null,
    neon: ['#ff64b1','#7ae7ff','#e5fb82','#f4a9ff','#90ffcb','#ffc46d'],
    ocean: ['#6ccbea','#30a8d3','#72ebdb','#b0bcff','#84d9a8','#b0e3fd'],
    warm: ['#ff9373','#ffca78','#e77f97','#f8ed8b','#cf91c0','#f2b3a3'],
    pastel: ['#b8d0ff','#eebceb','#bde6c1','#ffe3a9','#ffc7c1','#c9c1ff']
  };
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const hex = str => typeof str === 'string' && /^#[0-9a-fA-F]{6}$/.test(str);
  const color = (track,i) => studio.overlayColors[i] || track.color;
  function notice(message) { $('#studioNotice').textContent = message; }
  function getFrame(force=false) {
    const stamp = performance.now();
    if (!force && stamp-studio.lastFetch<85 && studio.frame) return studio.frame;
    const api = window.Pendulums;
    if (typeof api.getVisualFrame==='function') studio.frame=api.getVisualFrame(1250);
    else { // Compatibility fallback for older downloaded versions.
      const snapshot=api.getSnapshot();
      studio.frame={time:snapshot.elapsed,preset:snapshot.preset,releaseHeading:snapshot.releaseHeading||0,
        tracks:snapshot.tracks.map((t,id)=>{
          const stride=Math.max(1,Math.ceil(t.samples.length/1250));
          const samples=t.samples.filter((_,j)=>j%stride===0).map(s=>[s[1],s[2],s[3]]);
          const last=t.samples.at(-1);if(last && t.samples.length>1) samples.push([last[1],last[2],last[3]]);
          return {id,color:t.config.color,visible:t.visible,xyz:t.current.r.slice(),samples,length:t.config.length};
        })};
    }
    studio.lastFetch=stamp;
    return studio.frame;
  }
  function project(x,y,z) {
    const dx=x-studio.center[0],dy=y-studio.center[1],dz=z-studio.center[2];
    const a=Math.cos(studio.yaw)*dx-Math.sin(studio.yaw)*dy;
    const b=Math.sin(studio.yaw)*dx+Math.cos(studio.yaw)*dy;
    const scale=Math.min(...studio.size)/21*studio.zoom;
    return [studio.size[0]/2+studio.panX+a*scale,
      studio.size[1]/2+studio.panY+(b*Math.sin(studio.pitch)+dz*Math.cos(studio.pitch))*scale,
      b*Math.cos(studio.pitch)-dz*Math.sin(studio.pitch)];
  }
  function segment(a,b,stroke,width=1,dash=[]) {
    const p=project(...a),q=project(...b);
    ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);
    ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.setLineDash([]);
  }
  function label(p,txt,paint) {
    const [x,y]=project(...p);ctx.fillStyle=paint;ctx.font='600 11px ui-monospace,monospace';ctx.fillText(txt,x+6,y-5);
  }
  function drawBox() {
    if (!studio.showBox) return;
    const n=8,z=8;
    for (let a=-n;a<=n;a+=2) {
      segment([a,-n,z],[a,n,z],'#42605655',.75);
      segment([-n,a,z],[n,a,z],'#42605655',.75);
    }
    const pts=[[-n,-n,0],[n,-n,0],[n,n,0],[-n,n,0]];
    for(let j=0;j<4;j++) {
      segment(pts[j],pts[(j+1)%4],'#7394828c',1);
      segment([pts[j][0],pts[j][1],z],[pts[(j+1)%4][0],pts[(j+1)%4][1],z],'#7394828c',1);
      segment(pts[j],[pts[j][0],pts[j][1],z],'#73948270',.8,[3,5]);
    }
    segment([0,0,0],[9,0,0],'#ff9b83',2.2);label([9,0,0],'X','#ffb39e');
    segment([0,0,0],[0,9,0],'#9be9c5',2.2);label([0,9,0],'Y','#9be9c5');
    segment([0,0,0],[0,0,9],'#9ccaff',2.2);label([0,0,9],'Z ↓','#c2d9fa');
    const [px,py]=project(0,0,0);
    ctx.fillStyle='#e6e1bf';ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
  }
  function trace(samples,paint,opacity,width) {
    if(!samples||samples.length<2)return;
    ctx.beginPath();let begun=false;
    const stride=Math.max(1,Math.ceil(samples.length/1400));
    for(let i=0;i<samples.length;i+=stride){
      const s=samples[i];if(!s||!s.slice(0,3).every(Number.isFinite))continue;
      const p=project(s[0],s[1],s[2]);if(!begun){ctx.moveTo(p[0],p[1]);begun=true;}else ctx.lineTo(p[0],p[1]);
    }
    const last=samples.at(-1);if(last){const p=project(...last.slice(0,3));ctx.lineTo(p[0],p[1]);}
    ctx.strokeStyle=paint;ctx.globalAlpha=opacity;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();ctx.globalAlpha=1;
  }
  function resize(){
    const r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(studio.size[0]===w && studio.size[1]===h && studio.dpr===dpr)return;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);studio.dpr=dpr;studio.size=[w,h];studio.redraw=true;
  }
  function draw(){
    resize();const [w,h]=studio.size;ctx.clearRect(0,0,w,h);
    const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#0e1b23');grad.addColorStop(1,'#101b16');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    drawBox();
    for(const layer of studio.layers){if(!layer.visible)continue;
      for(const t of layer.tracks)if(t.visible) trace(t.samples,t.color,.46,1.25);
    }
    const frame=getFrame();
    if(frame && $('#studioTrails').checked){
      frame.tracks.forEach((t,i)=>{if(t.visible)trace(t.samples,color(t,i),.88,1.55);});
    }
    if(frame){
      const nodes=frame.tracks.filter(t=>t.visible).map(t=>({track:t,p:project(...t.xyz)})).sort((a,b)=>a.p[2]-b.p[2]);
      for(const {track:t,p} of nodes){
        if(studio.showStrings) segment([0,0,0],t.xyz,'#b1c4b175',.95);
        const paint=color(t,t.id); ctx.fillStyle=paint;ctx.shadowColor=paint;ctx.shadowBlur=7;
        ctx.beginPath();ctx.arc(p[0],p[1],t.id===Number($('#studioPath').value)?5.7:3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      }
    }
    $('#studioCamera').textContent=`${Math.round(studio.yaw*180/Math.PI)}° yaw · ${Math.round(studio.pitch*180/Math.PI)}° tilt · ${studio.zoom.toFixed(2)}×`;
    $('#studioLayers').textContent=`${studio.layers.length} / ${MAX_LAYERS} stored layers`;
    studio.redraw=false;
  }
  let lastDraw=0;
  function loop(t){
    if(t-lastDraw>=40){lastDraw=t;draw();}requestAnimationFrame(loop);
  }
  function setCamera(kind){
    if(kind==='top'){studio.yaw=0;studio.pitch=Math.PI/2;}
    else if(kind==='side'){studio.yaw=0;studio.pitch=0;}
    else if(kind==='under'){studio.yaw=0;studio.pitch=-Math.PI/2;}
    else {studio.yaw=-.55;studio.pitch=.67;}
    studio.panX=studio.panY=0;studio.zoom=1;studio.center=[0,0,3.5];studio.redraw=true;
  }
  function pan(dx,dy){studio.panX+=dx;studio.panY+=dy;studio.redraw=true;}
  function zoom(factor){studio.zoom=clamp(studio.zoom*factor,.38,7);studio.redraw=true;}
  function orbit(dx,dy){studio.yaw+=dx*.008;studio.pitch=clamp(studio.pitch+dy*.007,-Math.PI/2,Math.PI/2);studio.redraw=true;}
  function midpoint(arr){return [(arr[0].x+arr[1].x)/2,(arr[0].y+arr[1].y)/2];}
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
    e.preventDefault();canvas.setPointerCapture(e.pointerId);
    studio.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});studio.gesture=null;
  });
  canvas.addEventListener('pointermove',e=>{
    if(!studio.pointers.has(e.pointerId))return;
    e.preventDefault();const prev=studio.pointers.get(e.pointerId),dx=e.clientX-prev.x,dy=e.clientY-prev.y;
    if(studio.pointers.size===1){if(studio.mode==='pan'||e.shiftKey||e.buttons===2)pan(dx,dy);else orbit(dx,dy);}
    studio.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(studio.pointers.size===2){
      const pp=[...studio.pointers.values()],m=midpoint(pp),dist=Math.hypot(pp[0].x-pp[1].x,pp[0].y-pp[1].y);
      if(studio.gesture){pan(m[0]-studio.gesture.m[0],m[1]-studio.gesture.m[1]);if(studio.gesture.d>3)zoom(dist/studio.gesture.d);}
      studio.gesture={m,d:dist};
    }
  });
  const end=e=>{studio.pointers.delete(e.pointerId);studio.gesture=null;};
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001));},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  function snapshotLayer(){
    const s=window.Pendulums.getSnapshot();
    const tracks=s.tracks.map((t,i)=>{
      const stride=Math.max(1,Math.ceil(t.samples.length/MAX_POINTS));
      const samples=t.samples.filter((_,j)=>j%stride===0).map(row=>row.slice(1,4));
      const last=t.samples.at(-1);if(last && t.samples.length>1)samples.push(last.slice(1,4));
      return {id:i,color:studio.overlayColors[i]||t.config.color,visible:t.visible,samples};
    });
    if(!tracks.some(t=>t.samples.length>1))return false;
    studio.layers.push({id:Date.now()+'-'+Math.random().toString(36).slice(2,8),label:`${s.preset} · ${s.elapsed.toFixed(1)}s`,visible:true,tracks});
    if(studio.layers.length>MAX_LAYERS)studio.layers.shift();renderLayerList();return true;
  }
  // Freeze only the selected bob's measured XYZ trajectory. No interpolation
  // or decorative curves. Other bobs keep their unbroken live recordings.
  function snapshotSoloLayer(id){
    const state=window.Pendulums.getSnapshot();
    const record=state.tracks[id];
    if(!record||record.samples.length<2)return false;
    const stride=Math.max(1,Math.ceil(record.samples.length/MAX_POINTS));
    const samples=record.samples.filter((_,j)=>j%stride===0).map(row=>row.slice(1,4));
    const last=record.samples.at(-1);
    if(last && (record.samples.length-1)%stride!==0)samples.push(last.slice(1,4));
    studio.layers.push({id:'solo-'+Date.now()+'-'+id,
      label:`Bob ${id+1} · ${studio.soloRecipes[id]||'custom'} · ${state.elapsed.toFixed(1)}s`,
      visible:true,tracks:[{id,color:studio.overlayColors[id]||record.config.color,visible:record.visible,samples}]});
    if(studio.layers.length>MAX_LAYERS)studio.layers.shift();
    renderLayerList();return true;
  }
  const soloFields={length:'#soloLength',mass:'#soloMass',theta:'#soloTheta',
    phi:'#soloHeading',spin:'#soloSpin',push:'#soloPush'};
  function soloSelected(){return Number($('#studioPath').value)||0;}
  const tidySolo=(n,places=4)=>String(Number(Number(n).toFixed(places)));
  function fillSoloFromState(){
    const id=soloSelected(),s=window.Pendulums.getSnapshot(),bob=s.tracks[id];
    if(!bob)return;
    const cfg=bob.config;
    for(const [name,selector] of Object.entries(soloFields))
      $(selector).value=tidySolo(cfg[name]);
    // Legacy presets contain fractional headings (e.g. 96.015528...).
    // Release-wheel editing uses one-degree steps. Normalize the DISPLAY,
    // not the simulated state, until Apply is intentionally pressed.
    $('#soloHeading').value=String(Math.round(((cfg.phi%360)+360)%360)%360);
    const recipe=cfg.individualOverride?(cfg.soloRecipe||'custom'):'custom';
    $('#soloPreset').value=[...$('#soloPreset').options].some(o=>o.value===recipe)?recipe:'custom';
    $('#studioCustom').value=studio.overlayColors[id]||cfg.color;
    $('#soloDamping').value=tidySolo(cfg.damping ?? s.settings.damping,5);
    $('#soloPreview').textContent=cfg.individualOverride
      ? `Bob ${id+1}: individual ${recipe} override ACTIVE. Length ${tidySolo(cfg.length)} m; heading ${tidySolo(cfg.phi)}°. Ensemble Apply will keep this bob's setup.`
      : `Bob ${id+1}: following ensemble ${s.preset}. Heading ${tidySolo(cfg.phi)}°; edit and Apply to give this bob priority.`;
    renderSoloAssignments();
  }
  function renderSoloAssignments(){
    const snapshot=window.Pendulums.getSnapshot();
    const items=snapshot.tracks
      .map((track,id)=>({id,config:track.config}))
      .filter(entry=>entry.config.individualOverride);
    studio.soloRecipes=Object.fromEntries(items.map(({id,config})=>
      [id,config.soloRecipe||'custom']));
    $('#soloAssignments').textContent=items.length?
      'Individual overrides ('+items.length+'/'+snapshot.tracks.length+'): '+
        items.map(({id,config})=>`#${id+1} ${config.soloRecipe||'custom'}`).join(' / '):
      'All bobs currently follow the ensemble preset. Apply a solo setup to override one.';
  }
  function chooseSoloPreset(){
    const name=$('#soloPreset').value,id=soloSelected();
    if(name==='custom')return;
    try{
      const state=window.Pendulums.getSnapshot();
      const cfg=window.PendulumPhysics.preset(state.tracks.length,name,state.settings.gravity,Number($('#soloHeading').value))[id];
      if(!cfg)throw Error('No configuration for the selected pendulum.');
      for(const name of ['theta','spin','push'])$(soloFields[name]).value=cfg[name];
      // A new physical recipe sets initial length too; mass and color stay yours.
      $('#soloLength').value=cfg.length;
      if(name==='spiral' && Number($('#soloDamping').value)===0)$('#soloDamping').value='0.055';
      $('#soloPreview').textContent=`Bob ${id+1}: ${name} initial conditions. Edit any value; Apply resets only this bob. Spiral contraction requires damping above zero.`;
    }catch(error){notice('Could not prepare individual preset: '+error.message);}
  }
  function applySolo(){
    const id=soloSelected(),state=window.Pendulums.getSnapshot();
    if(!state.tracks[id])return notice('Select an active pendulum first.');
    const old=state.tracks[id].config,config={id,color:$('#studioCustom').value};
    for(const [name,selector] of Object.entries(soloFields)){
      const field=$(selector);
      if(field.value.trim()==='')return notice(`Enter a ${name} value before applying.`);
      config[name]=Number(field.value);
      if(!Number.isFinite(config[name]))return notice(`Invalid ${name} value.`);
    }
    if(!Number.isInteger(config.phi)||config.phi<0||config.phi>359)return notice('Release heading must be an integer from 0 to 359 degrees.');
    if(!hex(config.color))return notice('Choose a valid trail color.');
    if($('#soloDamping').value.trim()==='')return notice('Enter the individual damping rate.');
    config.damping=Number($('#soloDamping').value);
    if(!Number.isFinite(config.damping)||config.damping<0||config.damping>.5)return notice('Individual damping must be between 0 and 0.5 s^-1.');
    try{window.PendulumPhysics.makePendulum(config);}catch(error){return notice('Bob not changed: '+error.message);}
    // Archive only after successful validation, before the original handler
    // restarts the selected bob. Other positions, velocities and tracks stay as is.
    if($('#soloPreserve').checked)snapshotSoloLayer(id);
    $('#focus').value=String(id);
    $('#focus').dispatchEvent(new Event('change',{bubbles:true}));
    for(const [name,selector] of Object.entries(soloFields)){
      const key=name.charAt(0).toUpperCase()+name.slice(1);
      $('#edit'+key).value=$(selector).value;
    }
    $('#editColor').value=config.color;
    // The primary calculator inspector still owns the physically constrained reset.
    // Its handler preserves existing per-bob drag; apply the newly validated
    // damping value through the API after it resets only the chosen bob.
    $('#updateOne').click();
    window.Pendulums.setIndividualDamping(id,config.damping);
    const recipe=$('#soloPreset').value;
    window.Pendulums.setIndividualRecipe(id,recipe);
    studio.overlayColors[id]=config.color;
    studio.lastFetch=-Infinity;
    renderSoloAssignments();updatePaths();fillSoloFromState();
    notice(`Bob ${id+1} has a persistent ${recipe} override. Ensemble Apply will keep its physics settings, and the other bobs continue undisturbed.`);
  }
  function renderLayerList(){
    const slot=$('#artLayers');slot.replaceChildren();
    for(const layer of [...studio.layers].reverse()){
      const row=document.createElement('div');row.className='artLayerRow';
      const check=document.createElement('input');check.type='checkbox';check.checked=layer.visible;
      check.setAttribute('aria-label','Show '+layer.label);check.addEventListener('change',()=>{layer.visible=check.checked;});
      const name=document.createElement('span');name.textContent=layer.label;
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove this layer';
      remove.addEventListener('click',()=>{studio.layers=studio.layers.filter(l=>l!==layer);renderLayerList();});
      row.append(check,name,remove);slot.append(row);
    }
    $('#studioLayers').textContent=`${studio.layers.length} / ${MAX_LAYERS} stored layers`;
  }
  // Capture BEFORE the older app's Apply, Reset or Clear Sand handler drops samples.
  const archiveBefore=()=>{if(studio.keep){snapshotLayer();studio.lastFetch=-Infinity;}};
  const archiveEnsemble=()=>{
    const heading=Number($('#releaseExact').value),count=Number($('#count').value);
    if(!Number.isInteger(heading)||heading<0||heading>359||
       !Number.isInteger(count)||count<1||count>30)return;
    archiveBefore();
    // Rebuilding ensemble bobs now PRESERVES individually overridden configs.
    // Refresh the visual layers and override labels without clearing metadata.
    setTimeout(()=>{
      studio.lastFetch=-Infinity;updatePaths();renderSoloAssignments();
      if(studio.palette!=='original' && typeof window.Pendulums.setTrailColors==='function'){
        const cols=getFrame(true).tracks.map((t,i)=>studio.overlayColors[i]||t.color);
        window.Pendulums.setTrailColors(cols);
      }
      fillSoloFromState();
    },0);
  };
  for(const id of ['apply','applyTop'])
    $('#'+id).addEventListener('click',archiveEnsemble,{capture:true});
  for(const id of ['reset','clear'])$('#'+id).addEventListener('click',archiveBefore,{capture:true});
  function setPalette(name){
    studio.palette=name;studio.overlayColors={};
    const frame=getFrame(true),cols=frame.tracks.map((t,i)=>themes[name] ? themes[name][i%themes[name].length] : t.color);
    cols.forEach((c,i)=>studio.overlayColors[i]=c);
    if(typeof window.Pendulums.setTrailColors==='function')window.Pendulums.setTrailColors(cols);
    $('#studioCustom').value=cols[Number($('#studioPath').value)||0]||'#9fe8ba';
    notice('Palette applied to trail colors only. The pendulum physics is unchanged.');
  }
  function updatePaths(){
    const frame=getFrame(true),sel=$('#studioPath'),before=Number(sel.value)||0;
    sel.replaceChildren(...frame.tracks.map((t,i)=>{
      const o=document.createElement('option');o.value=String(i);o.textContent=`Pendulum ${i+1}`;return o;
    }));sel.value=String(Math.min(before,frame.tracks.length-1));
    $('#studioCustom').value=color(frame.tracks[Number(sel.value)],Number(sel.value));
    fillSoloFromState();
  }
  $('#studioTop').addEventListener('click',()=>setCamera('top'));
  $('#studioIso').addEventListener('click',()=>setCamera('iso'));
  $('#studioSide').addEventListener('click',()=>setCamera('side'));
  $('#studioUnder').addEventListener('click',()=>setCamera('under'));
  $('#studioZoomIn').addEventListener('click',()=>zoom(1.23));
  $('#studioZoomOut').addEventListener('click',()=>zoom(1/1.23));
  $('#studioPan').addEventListener('click',()=>{studio.mode=studio.mode==='orbit'?'pan':'orbit';$('#studioPan').textContent=studio.mode==='pan'?'Pan mode ✓':'Pan mode';});
  for(const [id,dx,dy] of [['studioLeft',-36,0],['studioRight',36,0],['studioUp',0,-36],['studioDown',0,36]])
    $('#'+id).addEventListener('click',()=>pan(dx,dy));
  $('#studioKeep').addEventListener('change',e=>{studio.keep=e.target.checked;});
  $('#studioStrings').addEventListener('change',e=>{studio.showStrings=e.target.checked;});
  $('#studioBox').addEventListener('change',e=>{studio.showBox=e.target.checked;});
  $('#studioFreeze').addEventListener('click',()=>{notice(snapshotLayer()?'Current physical trails saved as an art layer.':'Let the pendulums draw a little longer first.');});
  $('#studioClearArt').addEventListener('click',()=>{studio.layers=[];renderLayerList();notice('Saved artwork layers cleared. Current live physics remains untouched.');});
  $('#studioPalette').addEventListener('change',e=>setPalette(e.target.value));
  $('#studioPath').addEventListener('change',()=>{
    const i=Number($('#studioPath').value),f=getFrame();$('#studioCustom').value=color(f.tracks[i],i);
    $('#focus').value=String(i);$('#focus').dispatchEvent(new Event('change',{bubbles:true}));
    fillSoloFromState();
  });
  $('#focus').addEventListener('change',()=>{const id=Number($('#focus').value);if(String(id)!==$('#studioPath').value){$('#studioPath').value=String(id);fillSoloFromState();}});
  $('#soloPreset').addEventListener('change',chooseSoloPreset);
  // Editing an individual numeric control after choosing a recipe creates a
  // genuinely custom release, rather than leaving a misleading preset label.
  for(const selector of Object.values(soloFields).concat('#soloDamping')){
    $(selector).addEventListener('input',()=>{
      $('#soloPreset').value='custom';
    });
  }
  $('#soloResetOverride').addEventListener('click',()=>{
    const id=soloSelected();
    try{
      if($('#soloPreserve').checked &&
        window.Pendulums.getSnapshot().tracks[id]?.config.individualOverride)
        snapshotSoloLayer(id);
      const result=window.Pendulums.clearIndividualOverride(id);
      studio.lastFetch=-Infinity;updatePaths();fillSoloFromState();
      notice(result.cleared
        ? `Bob ${id+1} now follows the ensemble ${window.Pendulums.status.preset}; all other paths are unchanged.`
        : `Bob ${id+1} is already following the ensemble.`);
    }catch(error){notice(error.message);}
  });
  const nextSolo=()=>{const list=$('#studioPath');list.selectedIndex=(list.selectedIndex+1)%list.options.length;list.dispatchEvent(new Event('change',{bubbles:true}));};
  $('#soloApply').addEventListener('click',applySolo);
  $('#soloApplyTop').addEventListener('click',applySolo);
  $('#soloNext').addEventListener('click',nextSolo);
  $('#soloNextTop').addEventListener('click',nextSolo);
  $('#studioCustom').addEventListener('change',e=>{
    if(!hex(e.target.value))return;
    const i=Number($('#studioPath').value),f=getFrame();studio.overlayColors[i]=e.target.value;
    studio.palette='custom';$('#studioPalette').value='custom';
    const cols=f.tracks.map((t,j)=>color(t,j));
    if(typeof window.Pendulums.setTrailColors==='function')window.Pendulums.setTrailColors(cols);
    $('#editColor').value=e.target.value;
    notice(`Color updated for pendulum ${i+1}, without resetting its motion.`);
  });
  function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  $('#studioPNG').addEventListener('click',()=>canvas.toBlob(blob=>{if(blob)download('pendulums-3d-art.png',blob);},'image/png'));
  $('#studioSaveArt').addEventListener('click',()=>{
    const payload={format:'pendulums-art-studio',version:1,created:new Date().toISOString(),
      camera:{yaw:studio.yaw,pitch:studio.pitch,zoom:studio.zoom,panX:studio.panX,panY:studio.panY,center:studio.center},
      layers:studio.layers,overlayColors:studio.overlayColors};
    download('pendulums-layered-art.json',new Blob([JSON.stringify(payload)],{type:'application/json'}));
  });
  $('#studioImportArt').addEventListener('change',async e=>{
    try{
      const file=e.target.files?.[0];if(!file)return;
      if(file.size>25_000_000)throw Error('Artwork JSON is too large (25 MB maximum).');
      const j=JSON.parse(await file.text());
      if(j.format!=='pendulums-art-studio'||j.version!==1||!Array.isArray(j.layers)||j.layers.length>MAX_LAYERS)throw Error('Not a compatible layered art file.');
      for(const l of j.layers){
        if(!l||typeof l.label!=='string'||l.label.length>130||typeof l.visible!=='boolean'||!Array.isArray(l.tracks)||l.tracks.length>30)throw Error('Invalid art layer.');
        for(const t of l.tracks){if(!t||!hex(t.color)||typeof t.visible!=='boolean'||!Array.isArray(t.samples)||t.samples.length>MAX_POINTS+1||t.samples.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>100)))throw Error('Invalid recorded path.');}
      }
      studio.layers=j.layers;renderLayerList();notice('Saved XYZ artwork layers restored, physics is unchanged.');
    }catch(error){notice('Art import not applied: '+error.message);}finally{e.target.value='';}
  });
  // Delay until older app finishes initial setup before querying its state.
  const api=Object.freeze({
    get state(){return {yaw:studio.yaw,pitch:studio.pitch,zoom:studio.zoom,mode:studio.mode,layerCount:studio.layers.length};},
    getArtwork(){return JSON.parse(JSON.stringify(studio.layers));},
    saveLayer:snapshotLayer,clearArtwork(){studio.layers=[];renderLayerList();},
    setView:setCamera,orbit,pan,zoom,projectPoint:(x,y,z)=>project(x,y,z),
    setPalette, getRecordedFrame:()=>getFrame(true),
    getSoloRecipes:()=>({...studio.soloRecipes}),
    applySolo, snapshotSoloLayer
  });
  window.PendulumsStudio=api;
  $('#studioPalette').insertAdjacentHTML('beforeend','<option value="custom">Custom colors</option>');
  updatePaths();setPalette('original');
  window.addEventListener('resize',()=>{studio.redraw=true;});
  requestAnimationFrame(loop);
})();
