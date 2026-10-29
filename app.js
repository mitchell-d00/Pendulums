/* Pendulums — UI, trajectory recording and exports. No dependencies or network. */
(() => {
  'use strict';
  const P = window.PendulumPhysics;
  if (!P) throw new Error('physics.js must load before app.js');
  const $ = selector => document.querySelector(selector);
  const canvas = $('#sand');
  const ctx = canvas.getContext('2d');
  const energyCanvas = $('#energyChart');
  const ectx = energyCanvas.getContext('2d');
  const trackCanvas = document.createElement('canvas');
  const trackCtx = trackCanvas.getContext('2d');
  const groundCanvas = document.createElement('canvas');
  const groundCtx = groundCanvas.getContext('2d');
  const MAX_SAMPLES = 18000;
  const SPIRAL_DAMPING = 0.055;
  const SAMPLE_STEPS = 4; // 240 Hz integration -> 60 Hz trajectory recording
  const STYLE = {
    dark: { background: '#101a19', grid:'#283d36', axis:'#4c6c5b', text:'#88a699', pivot:'#d7c1a0', noise:'#d5bc91' },
    sand: { background: '#e7d8b9', grid:'#cbbb99', axis:'#baa57a', text:'#927e5d', pivot:'#846e50', noise:'#9d7f59' },
    paper: { background: '#f1eee1', grid:'#d7ddce', axis:'#aebba7', text:'#637c72', pivot:'#415d4e', noise:'#7a9e87' }
  };
  const model = {
    configs:[], pendulums:[], tracks:[], count:12, preset:'ribbons', releaseHeading:0, spiralAutoDamping:false, gravity:9.81,
    damping:0, speed:1, time:0, running:true, selected:0,
    drawTrails:true, drawBobs:true, drawLabels:false, highlight:true,
    weight:1.7, theme:'dark', zoom:1, panX:0, panY:0,
    simSteps:0, accumulator:0, lastFrame:0, width:0, height:0, dpr:1,
    groundDirty:true, tracksDirty:true, renderAccumulator:0
  };

  function notice(text) { $('#notice').textContent = text; }
  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function num(value, digits=2) { return Number.isFinite(value) ? value.toFixed(digits) : '—'; }
  function timeLabel(t) { const minutes=Math.floor(t/60), seconds=t%60; return `${pad(minutes)}:${seconds.toFixed(2).padStart(5,'0')}`; }
  function colorFrom(index) {
    const h=((index*137.507764+192)%360)/60, l=[.67,.58,.75,.63,.71][index%5], s=.89;
    const a=s*Math.min(l,1-l);
    const f=n=>{const k=(n+h*60/60)%6;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
    return '#'+[f(0),f(8),f(4)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  function validateColor(color){return /^#[0-9a-fA-F]{6}$/.test(color);}
  function initialConfig(config, i){return {...config,id:i,color:validateColor(config.color)?config.color:colorFrom(i)};}
  function newTrack(config){return {id:config.id,color:config.color,visible:true,samples:[]};}
  function takeSample(p, t) {
    const m=P.measures(p,model.gravity);
    return {t,x:p.r[0],y:p.r[1],z:p.r[2],speed:m.speed,kinetic:m.kinetic,potential:m.potential,total:m.total,angularMomentumZ:m.angularMomentumZ};
  }
  function storeSample(i){
    const trace=model.tracks[i], point=takeSample(model.pendulums[i],model.time);
    const prev=trace.samples.at(-1);
    if (prev && point.t<=prev.t) return;
    trace.samples.push(point);
    if(trace.samples.length>MAX_SAMPLES){
      // Preserve older portions of the path at lower resolution instead of
      // simply discarding the past. The raw history is intentionally bounded.
      const old=trace.samples.splice(0,Math.floor(MAX_SAMPLES/2));
      const slim=old.filter((_,j)=>j%2===0);
      trace.samples.unshift(...slim);
      model.tracksDirty=true;
    }
    if(prev && trace.visible && model.drawTrails && !model.tracksDirty) strokeSegment(trace,prev,point);
  }
  function build(configs, restored){
    model.count=configs.length;
    model.configs=configs.map(initialConfig);
    model.pendulums=model.configs.map(P.makePendulum);
    model.tracks=model.configs.map(newTrack);
    model.time=0;model.simSteps=0;model.accumulator=0;
    model.selected=clamp(model.selected,0,model.count-1);
    if(restored){
      model.time=restored.elapsed;
      model.simSteps=Math.round(model.time/P.FIXED_DT);
      model.selected=clamp(restored.selected||0,0,model.count-1);
      restored.tracks.forEach((rec,i)=>{
        const p=model.pendulums[i];
        const projected=P.projected(rec.current.r,rec.current.v,p.length);
        p.r=projected.r;p.v=projected.v;
        p.distance=rec.current.distance;p.groundDistance=rec.current.groundDistance;
        const tr=model.tracks[i];tr.visible=rec.visible;
        tr.samples=rec.samples.slice(-MAX_SAMPLES).map(s=>({...s}));
      });
    } else for(let i=0;i<model.count;i++)storeSample(i);
    model.tracksDirty=true;model.groundDirty=true;
    model.zoom=1;model.panX=0;model.panY=0;
    $('#count').value=model.count;$('#countVal').textContent=model.count;
    $('#tableCount').textContent=model.count;
    updateControls();updateFocusOptions();applyFocus();
    renderRows();renderCanvas();
  }
  function updateControls(){
    $('#gravity').value=model.gravity;$('#gravityVal').textContent=num(model.gravity)+' m/s²';
    $('#damping').value=model.damping;$('#dampingVal').textContent=num(model.damping,3)+' s⁻¹';
    $('#speed').value=model.speed;$('#speedVal').textContent=num(model.speed)+'×';
    $('#preset').value=model.preset;$('#theme').value=model.theme;
    $('#patternNote').textContent=`${model.preset.toUpperCase()} · ${model.releaseHeading}° RELEASE`;
    syncReleaseControls(model.releaseHeading); 
    $('#trailsToggle').checked=model.drawTrails;$('#bobToggle').checked=model.drawBobs;
    $('#labelToggle').checked=model.drawLabels;$('#followToggle').checked=model.highlight;
    $('#weight').value=model.weight;$('#weightVal').textContent=num(model.weight,1)+' px';
    $('#time').textContent=timeLabel(model.time);
    $('#scaleNote').textContent='LARGEST RADIUS '+num(Math.max(...model.configs.map(p=>p.length)))+' M';
    $('#activeCount').textContent=model.tracks.filter(t=>t.visible).length+' ACTIVE TRAILS';
    $('#play').setAttribute('aria-label',model.running?'Pause simulation':'Start simulation');
    $('#playGlyph').textContent=model.running?'Ⅱ':'▶';
    $('#playLabel').textContent=model.running?'Pause':'Play';
    $('#runStatus').textContent=model.running?'RUNNING':'PAUSED';
    $('#runStatus').style.color=model.running?'#a5deb4':'#d7af80';
  }
  function updateFocusOptions(){
    $('#focus').replaceChildren(...model.configs.map((c,i)=>{const el=document.createElement('option');el.value=String(i);el.textContent='Pendulum '+pad(i+1);return el;}));
    $('#focus').value=String(model.selected);
  }
  function applyFocus(){
    const config=model.configs[model.selected];
    if(!config)return;
    $('#focus').value=String(model.selected);
    $('#focusNumber').textContent=pad(model.selected+1);
    $('#updateNumber').textContent=pad(model.selected+1);
    $('#updateNumberTop').textContent=pad(model.selected+1);
    $('#focusColor').style.background=config.color;
    const map={Length:'length',Mass:'mass',Theta:'theta',Phi:'phi',Spin:'spin',Push:'push',Color:'color'};
    Object.entries(map).forEach(([key,val])=>{
      const raw=config[val];
      // Long binary-float tails from release-fan presets are not useful
      // editing values. Keep the precise simulation state until Apply.
      $('#edit'+key).value=key==='Color'?raw:key==='Phi'
        ? String(Math.round(((raw%360)+360)%360)%360)
        : String(Number(Number(raw).toFixed(5)));
    });
    updateMeasures();
  }
  function setSelected(index){model.selected=clamp(index,0,model.count-1);applyFocus();renderRows();}

  function syncReleaseControls(degrees){
    const heading=((Math.round(degrees)%360)+360)%360;
    model.releaseHeading=heading;
    $('#releaseHeading').value=String(heading);
    $('#releaseExact').value=String(heading);
    $('#releaseHeadingVal').textContent=heading+'° / 359°';
    drawReleaseWheel();
  }
  function drawReleaseWheel(){
    const dial=$('#releaseDial');if(!dial)return;
    const g=dial.getContext('2d'), w=dial.width, c=w/2, r=w*.39;
    g.clearRect(0,0,w,w);
    g.beginPath();g.arc(c,c,r,0,2*Math.PI);g.strokeStyle='#5d7a69';g.lineWidth=1.5;g.stroke();
    // All 360 available bearings are marked; major markings every 30°.
    for(let i=0;i<360;i++){
      const a=(i-90)*Math.PI/180, major=i%30===0;
      g.beginPath();g.moveTo(c+Math.cos(a)*r*(major?.82:.94),c+Math.sin(a)*r*(major?.82:.94));
      g.lineTo(c+Math.cos(a)*r,c+Math.sin(a)*r);
      g.strokeStyle=major?'#b5e7c9':'#547064';g.lineWidth=major?1.8:.6;g.stroke();
    }
    const a=(model.releaseHeading-90)*Math.PI/180;
    g.beginPath();g.moveTo(c,c);g.lineTo(c+Math.cos(a)*r*.81,c+Math.sin(a)*r*.81);
    g.strokeStyle='#b8efbe';g.lineWidth=3;g.stroke();
    g.beginPath();g.arc(c+Math.cos(a)*r*.81,c+Math.sin(a)*r*.81,5,0,2*Math.PI);
    g.fillStyle='#f3c88d';g.fill();
    g.fillStyle='#e0eedf';g.font='600 19px ui-monospace,monospace';g.textAlign='center';
    g.fillText(model.releaseHeading+'°',c,c+6);
  }
  function setReleaseFromWheel(event){
    const rect=$('#releaseDial').getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*$('#releaseDial').width-$('#releaseDial').width/2;
    const y=(event.clientY-rect.top)/rect.height*$('#releaseDial').height-$('#releaseDial').height/2;
    if(Math.hypot(x,y)<12)return;
    syncReleaseControls(Math.round((Math.atan2(y,x)*180/Math.PI+90+360)%360));
  }

  function chooseScale(){return (Math.min(model.width,model.height)*.5)/(Math.max(...model.configs.map(x=>x.length))+.36)*model.zoom;}
  function project(x,y){const scale=chooseScale();return [model.width*.5+model.panX+x*scale,model.height*.5+model.panY-y*scale];}
  function resize(){
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(w===model.width&&h===model.height&&dpr===model.dpr)return;
    model.width=w;model.height=h;model.dpr=dpr;
    for(const target of [canvas,trackCanvas,groundCanvas]){
      target.width=Math.round(w*dpr);target.height=Math.round(h*dpr);
    }
    for(const c of [ctx,trackCtx,groundCtx])c.setTransform(dpr,0,0,dpr,0,0);
    model.groundDirty=true;model.tracksDirty=true;
  }
  function background(){
    if(!model.groundDirty)return;
    const {width:w,height:h}=model,style=STYLE[model.theme];
    groundCtx.clearRect(0,0,w,h);groundCtx.fillStyle=style.background;groundCtx.fillRect(0,0,w,h);
    // Stable low-contrast surface grain: deterministic and independent of motion.
    if(model.theme==='sand'){
      groundCtx.fillStyle='#715c3420';let seed=309871;
      for(let i=0;i<Math.min(16000,Math.floor(w*h/42));i++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed/4294967296*w;
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed/4294967296*h;
        groundCtx.fillRect(x,y,.8,.8);
      }
    }
    const sc=chooseScale();const [cx,cy]=project(0,0);
    groundCtx.strokeStyle=style.grid;groundCtx.lineWidth=1;
    groundCtx.beginPath();
    // world grid at one-meter increments across visible viewport
    const xMin=Math.floor(-cx/sc)-1,xMax=Math.ceil((w-cx)/sc)+1;
    const yMin=Math.floor((cy-h)/sc)-1,yMax=Math.ceil(cy/sc)+1;
    for(let x=xMin;x<=xMax;x++){const u=cx+x*sc;if(u>=0&&u<=w){groundCtx.moveTo(u,0);groundCtx.lineTo(u,h);}}
    for(let y=yMin;y<=yMax;y++){const v=cy-y*sc;if(v>=0&&v<=h){groundCtx.moveTo(0,v);groundCtx.lineTo(w,v);}}
    groundCtx.stroke();
    groundCtx.strokeStyle=style.axis;groundCtx.lineWidth=1.3;
    groundCtx.beginPath();groundCtx.moveTo(cx,0);groundCtx.lineTo(cx,h);groundCtx.moveTo(0,cy);groundCtx.lineTo(w,cy);groundCtx.stroke();
    groundCtx.fillStyle=style.text;groundCtx.font='10px ui-monospace,monospace';
    for(let x=xMin;x<=xMax;x++){if(x===0)continue;const u=cx+x*sc;if(u>22&&u<w-18)groundCtx.fillText(String(x),u+4,clamp(cy-8,13,h-7));}
    for(let y=yMin;y<=yMax;y++){if(y===0)continue;const v=cy-y*sc;if(v>15&&v<h-9)groundCtx.fillText(String(y),clamp(cx+7,7,w-29),v-4);}
    groundCtx.beginPath();groundCtx.fillStyle=style.pivot;groundCtx.arc(cx,cy,4,0,2*Math.PI);groundCtx.fill();
    model.groundDirty=false;
  }
  function strokeSegment(track,a,b){
    const [x1,y1]=project(a.x,a.y),[x2,y2]=project(b.x,b.y);
    trackCtx.strokeStyle=track.color;trackCtx.globalAlpha=.73;
    trackCtx.lineWidth=model.weight;trackCtx.lineCap='round';
    trackCtx.beginPath();trackCtx.moveTo(x1,y1);trackCtx.lineTo(x2,y2);trackCtx.stroke();
    trackCtx.globalAlpha=1;
  }
  function redrawTracks(){
    if(!model.tracksDirty)return;
    trackCtx.clearRect(0,0,model.width,model.height);
    if(model.drawTrails){
      for(const track of model.tracks){
        if(!track.visible||track.samples.length<2)continue;
        trackCtx.strokeStyle=track.color;trackCtx.globalAlpha=.72;trackCtx.lineWidth=model.weight;
        trackCtx.lineJoin='round';trackCtx.lineCap='round';trackCtx.beginPath();
        track.samples.forEach((s,j)=>{const [x,y]=project(s.x,s.y);if(j===0)trackCtx.moveTo(x,y);else trackCtx.lineTo(x,y);});
        trackCtx.stroke();
      }
      trackCtx.globalAlpha=1;
    }
    model.tracksDirty=false;
  }
  function renderCanvas(){
    resize();background();redrawTracks();const w=model.width,h=model.height;
    ctx.clearRect(0,0,w,h);ctx.drawImage(groundCanvas,0,0,w,h);ctx.drawImage(trackCanvas,0,0,w,h);
    const selectedTrack=model.tracks[model.selected];
    if(model.drawTrails&&model.highlight&&selectedTrack.visible&&selectedTrack.samples.length>1){
      ctx.beginPath();ctx.strokeStyle=selectedTrack.color;ctx.lineWidth=model.weight+1.45;ctx.globalAlpha=.95;
      selectedTrack.samples.forEach((p,j)=>{const [x,y]=project(p.x,p.y);if(!j)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
      ctx.stroke();ctx.globalAlpha=1;
    }
    if(model.drawBobs){
      model.pendulums.forEach((p,i)=>{
        const [x,y]=project(p.r[0],p.r[1]);
        if(x<-20||y<-20||x>w+20||y>h+20)return;
        const sel=i===model.selected, col=model.tracks[i].color;
        ctx.beginPath();ctx.fillStyle=col;ctx.shadowBlur=sel?15:7;ctx.shadowColor=col;
        ctx.arc(x,y,sel?5.4:3.4,0,2*Math.PI);ctx.fill();ctx.shadowBlur=0;
        if(sel){ctx.beginPath();ctx.strokeStyle=col;ctx.lineWidth=1;ctx.arc(x,y,11,0,2*Math.PI);ctx.stroke();}
        if(model.drawLabels){ctx.fillStyle=STYLE[model.theme].text;ctx.font='10px ui-monospace,monospace';ctx.fillText(String(i+1),x+11,y-10);}
      });
    }
  }
  function updateMeasures(){
    const p=model.pendulums[model.selected];if(!p)return;
    const m=P.measures(p,model.gravity);
    $('#metricSpeed').textContent=num(m.speed);$('#metricKinetic').textContent=num(m.kinetic);
    $('#metricPotential').textContent=num(m.potential);$('#metricEnergy').textContent=num(m.total);
    $('#metricDistance').textContent=num(m.groundDistance);$('#metricLz').textContent=num(m.angularMomentumZ,3);
    drawEnergy();
  }
  function drawEnergy(){
    const rect=energyCanvas.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);
    if(w===0||h===0)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(energyCanvas.width!==Math.round(w*dpr)||energyCanvas.height!==Math.round(h*dpr)){
      energyCanvas.width=Math.round(w*dpr);energyCanvas.height=Math.round(h*dpr);
    }
    ectx.setTransform(dpr,0,0,dpr,0,0);ectx.clearRect(0,0,w,h);
    const samples=model.tracks[model.selected].samples;
    if(!samples.length)return;
    const shown=samples.slice(-220);
    const maxE=Math.max(.001,...shown.map(s=>Math.max(s.kinetic,s.potential)))*1.1;
    const margin=12,plotW=w-24,plotH=h-32;
    ectx.strokeStyle='#334d43';ectx.lineWidth=1;
    for(let j=0;j<4;j++){
      const y=margin+j*(plotH/3);ectx.beginPath();ectx.moveTo(margin,y);ectx.lineTo(w-margin,y);ectx.stroke();
    }
    for(const [key,col] of [['kinetic','#f5bf93'],['potential','#8ad7c1']]){
      ectx.strokeStyle=col;ectx.lineWidth=1.8;ectx.beginPath();
      shown.forEach((s,i)=>{const x=margin+(i/Math.max(1,shown.length-1))*plotW,y=margin+plotH-(s[key]/maxE)*plotH;
        if(i===0)ectx.moveTo(x,y);else ectx.lineTo(x,y);});ectx.stroke();
    }
    ectx.fillStyle='#93a99c';ectx.font='10px ui-monospace,monospace';
    ectx.fillText('0 J',margin,h-6);ectx.fillText(num(maxE,1)+' J',w-66,h-6);
  }
  function renderRows(){
    $('#tableCount').textContent=model.count;
    $('#rows').innerHTML=model.pendulums.map((p,i)=>{
      const t=model.tracks[i],m=P.measures(p,model.gravity);
      return `<tr data-index="${i}" tabindex="0" role="button" aria-label="Inspect pendulum ${i+1}" class="${i===model.selected?'selected':''}">
       <td class="pathCell"><button data-toggle="${i}" title="${t.visible?'Hide':'Show'} path ${i+1}" aria-label="${t.visible?'Hide':'Show'} path ${i+1}" aria-pressed="${t.visible}">${t.visible?'◉':'◌'}</button><span class="rowColor" style="background:${t.color}"></span><span class="rowLabel">#${pad(i+1)}</span></td>
       <td>${num(p.length)}</td><td>${num(m.speed)}</td><td>${num(m.kinetic)}</td><td>${num(m.potential)}</td><td>${num(m.total)}</td><td>${num(m.groundDistance)}</td></tr>`;
    }).join('');
    $('#sampleStats').textContent=`${model.tracks.reduce((sum,t)=>sum+t.samples.length,0).toLocaleString()} measured path snapshots across ${model.count} bobs · 60 snapshots/sec each · capped at ${MAX_SAMPLES.toLocaleString()} per bob with older paths thinned to preserve coverage.`;
  }
  function tick(timestamp){
    if(!model.lastFrame)model.lastFrame=timestamp;
    const realDt=clamp((timestamp-model.lastFrame)/1000,0,.06);model.lastFrame=timestamp;
    if(model.running){
      model.accumulator+=realDt*model.speed;
      let loops=0;
      while(model.accumulator>=P.FIXED_DT&&loops<80){
        for(let i=0;i<model.pendulums.length;i++){
          const damping=model.configs[i].damping ?? model.damping;
          P.step(model.pendulums[i],P.FIXED_DT,model.gravity,damping);
        }
        model.time+=P.FIXED_DT;model.simSteps++;
        if(model.simSteps%SAMPLE_STEPS===0)for(let i=0;i<model.count;i++)storeSample(i);
        model.accumulator-=P.FIXED_DT;loops++;
      }
      if(loops===80)model.accumulator=0; // avoid endless catch-up on a slow device
    }
    renderCanvas();
    model.renderAccumulator+=realDt;
    if(model.renderAccumulator>.16){
      model.renderAccumulator=0;$('#time').textContent=timeLabel(model.time);
      updateMeasures();renderRows();
    }
    requestAnimationFrame(tick);
  }
  function reconfigure(){
    try{
      const count=Number($('#count').value),name=$('#preset').value;
      const heading=Number($('#releaseExact').value);
      if(!Number.isInteger(heading)||heading<0||heading>359)throw new RangeError('Choose a whole-number release point from 0 to 359°.');
      // A bulk arrangement changes only ensemble-managed bobs.  Individual
      // edits have priority until the owner explicitly clears their override.
      const cfg=P.preset(count,name,model.gravity,heading).map((c,i)=>{
        const previous=model.configs[i];
        return previous?.individualOverride
          ? {...c,...previous,id:i,individualOverride:true}
          : {...c,id:i,color:colorFrom(i)};
      });
      model.releaseHeading=heading;
      if(model.spiralAutoDamping && name!=='spiral'){model.damping=0;model.spiralAutoDamping=false;}
      if(name==='spiral' && model.damping===0){model.damping=SPIRAL_DAMPING;model.spiralAutoDamping=true;}
      model.preset=name;build(cfg);notice(`New ${name} pattern: ${count} real pendulums launched at ${heading}° on the 360-point wheel.`);
    }catch(error){notice(error.message);}
  }
  function clearSand(){
    for(let i=0;i<model.count;i++){
      model.tracks[i].samples=[];storeSample(i);
    }
    model.tracksDirty=true;renderCanvas();drawEnergy();renderRows();notice('Sand cleared. Each pendulum keeps swinging from its current position.');
  }
  function changeIndividual(){
    const id=model.selected;
    const old=model.configs[id];
    // Never discard the bob's drag/recipe metadata when the inspector edits
    // an otherwise unrelated property (the former implementation did).
    const cfg={...old,id,individualOverride:true,soloRecipe:'custom',color:$('#editColor').value,
      length:Number($('#editLength').value),mass:Number($('#editMass').value),
      theta:Number($('#editTheta').value),phi:Number($('#editPhi').value),
      spin:Number($('#editSpin').value),push:Number($('#editPush').value)};
    if(!validateColor(cfg.color))return notice('Choose a valid hex color.');
    if(['Length','Mass','Theta','Phi','Spin','Push'].some(k=>$('#edit'+k).value.trim()==='') ||
      ![cfg.length,cfg.mass,cfg.theta,cfg.phi,cfg.spin,cfg.push].every(Number.isFinite))
      return notice('Enter valid finite numbers for every individual setting.');
    try{
      const p=P.makePendulum(cfg);
      model.configs[id]=cfg;model.pendulums[id]=p;
      model.tracks[id]={id,color:cfg.color,visible:model.tracks[id].visible,samples:[]};
      storeSample(id);model.tracksDirty=true;model.groundDirty=true;
      applyFocus();renderRows();renderCanvas();notice(`Pendulum #${pad(id+1)} reset with individual settings. The others keep moving.`);
    }catch(error){notice(error.message);$('#editColor').value=old.color;}
  }
  function clearIndividualOverride(index){
    if(!Number.isInteger(index)||index<0||index>=model.count)
      throw new RangeError('Invalid pendulum index.');
    const old=model.configs[index];
    if(!old.individualOverride)return {index,cleared:false};
    // Reset only the specified bob.  Remaining positions, velocities and
    // recorded trajectories are not touched.
    const base=P.preset(model.count,model.preset,model.gravity,model.releaseHeading)[index];
    const cfg={...base,id:index,color:old.color};
    const bob=P.makePendulum(cfg);
    model.configs[index]=cfg;
    model.pendulums[index]=bob;
    model.tracks[index]={id:index,color:cfg.color,visible:model.tracks[index].visible,samples:[]};
    storeSample(index);
    model.tracksDirty=true;model.groundDirty=true;
    applyFocus();renderRows();renderCanvas();
    notice(`Pendulum #${pad(index+1)} returned to the ${model.preset} ensemble. The other bobs keep their own paths.`);
    return {index,cleared:true,config:{...cfg}};
  }
  function setIndividualRecipe(index,recipe){
    if(!Number.isInteger(index)||index<0||index>=model.count ||
      !['custom','spiral','rosette','petals','starburst','spinburst','orbit','fan','ribbons','wave','still'].includes(recipe))
      throw new RangeError('Invalid pendulum index or recipe.');
    if(!model.configs[index].individualOverride)
      throw new Error('Apply the individual settings before naming their recipe.');
    model.configs[index].soloRecipe=recipe;
    return {index,recipe,individualOverride:true};
  }
  function download(name, blob){
    const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.download=name;link.href=url;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
  function savePNG(){
    renderCanvas();
    canvas.toBlob(blob=>{if(!blob)return notice('PNG export failed.');download(`pendulums-${stamp()}.png`,blob);notice('Exported the visible sand canvas as PNG.');},'image/png');
  }
  function saveSVG(){
    const w=Math.round(model.width),h=Math.round(model.height),style=STYLE[model.theme];
    const paths=model.tracks.filter(t=>t.visible&&t.samples.length>1).map(t=>{
      const d=t.samples.map((p,i)=>{const [x,y]=project(p.x,p.y);return (i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2);}).join(' ');
      return `<path d="${d}" fill="none" stroke="${t.color}" stroke-width="${model.weight}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`;
    }).join('');
    const [px,py]=project(0,0);
    const content=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>Pendulums — top-down sand paths</title><rect width="100%" height="100%" fill="${style.background}"/>${paths}<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="4" fill="${style.pivot}"/></svg>`;
    download(`pendulums-${stamp()}.svg`,new Blob([content],{type:'image/svg+xml;charset=utf-8'}));notice('Exported visible trajectories as editable SVG paths.');
  }
  function saveCSV(){
    const lines=['pendulum_id,color,sim_seconds,x_m,y_m,z_down_m,speed_m_s,kinetic_j,potential_j,total_j,vertical_angular_momentum_kg_m2_s'];
    for(const track of model.tracks)for(const s of track.samples){
      lines.push([track.id+1,track.color,s.t,s.x,s.y,s.z,s.speed,s.kinetic,s.potential,s.total,s.angularMomentumZ].join(','));
    }
    download(`pendulums-${stamp()}.csv`,new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}));
    notice('Exported all retained paths and their time-stamped kinetics as CSV.');
  }
  function session(){return {
    format:'pendulums-sand-session',version:1,created:new Date().toISOString(),
    elapsed:model.time,selected:model.selected,preset:model.preset,releaseHeading:model.releaseHeading,
    settings:{gravity:model.gravity,damping:model.damping,speed:model.speed,theme:model.theme,weight:model.weight},
    tracks:model.tracks.map((t,i)=>({config:{...model.configs[i]},visible:t.visible,
      current:{r:[...model.pendulums[i].r],v:[...model.pendulums[i].v],distance:model.pendulums[i].distance,groundDistance:model.pendulums[i].groundDistance},
      samples:t.samples.map(s=>[s.t,s.x,s.y,s.z,s.speed,s.kinetic,s.potential,s.total,s.angularMomentumZ])}))
  };}
  function saveJSON(){
    download(`pendulums-session-${stamp()}.json`,new Blob([JSON.stringify(session())],{type:'application/json;charset=utf-8'}));
    notice('Exported positions, velocities, every retained path and kinetic sample.');
  }
  function parseSession(json){
    if(!json||json.format!=='pendulums-sand-session'||json.version!==1||!Array.isArray(json.tracks)||json.tracks.length<1||json.tracks.length>30)throw new Error('Not a supported Pendulums session (1–30 tracks).');
    if(!Number.isFinite(json.elapsed)||json.elapsed<0||json.elapsed>1e8)throw new Error('Invalid elapsed time.');
    if(!Number.isInteger(json.selected)||json.selected<0||json.selected>=json.tracks.length)throw new Error('Invalid selected pendulum.');
    const settings=json.settings;
    if(!settings||!Number.isFinite(settings.gravity)||settings.gravity<0||settings.gravity>20||!Number.isFinite(settings.damping)||settings.damping<0||settings.damping>.5||!Number.isFinite(settings.speed)||settings.speed<.25||settings.speed>3||!STYLE[settings.theme]||!Number.isFinite(settings.weight)||settings.weight<.6||settings.weight>4)throw new Error('Invalid simulation settings.');
    if(json.tracks.some((tr,i)=>{
      try{P.makePendulum({...tr.config,id:i});}catch{return true;}
      if(tr.config.damping!==undefined&&(!Number.isFinite(tr.config.damping)||tr.config.damping<0||tr.config.damping>.5))return true;
      return !tr||!validateColor(tr.config.color)||typeof tr.visible!=='boolean'||!tr.current||
        !Array.isArray(tr.current.r)||!Array.isArray(tr.current.v)||tr.current.r.length!==3||tr.current.v.length!==3||
        ![...tr.current.r,...tr.current.v,tr.current.distance,tr.current.groundDistance].every(Number.isFinite)||
        Math.abs(Math.hypot(...tr.current.r)-tr.config.length)>1e-3||
        Math.abs(tr.current.r.reduce((n,x,j)=>n+x*tr.current.v[j],0))>1e-3*Math.max(1,Math.hypot(...tr.current.v))||
        tr.current.distance<0||tr.current.groundDistance<0||!Array.isArray(tr.samples)||tr.samples.length>MAX_SAMPLES||
        tr.samples.some((s,j)=>!Array.isArray(s)||s.length!==9||!s.every(Number.isFinite)||s[0]<0||s[0]>json.elapsed+.01||(j>0&&s[0]<tr.samples[j-1][0]));
    }))throw new Error('Invalid path, physics state or samples in JSON.');
    if(typeof json.preset!=='string'||!['wave','orbit','fan','ribbons','still','spiral','rosette','petals','starburst'].includes(json.preset))throw new Error('Invalid motion preset.');
    const releaseHeading=json.releaseHeading??0;
    if(!Number.isInteger(releaseHeading)||releaseHeading<0||releaseHeading>359)throw new Error('Invalid release heading (0–359).');
    return {configs:json.tracks.map((tr,i)=>({...tr.config,id:i})),settings,
      restored:{elapsed:json.elapsed,selected:json.selected,tracks:json.tracks.map(tr=>({...tr,samples:tr.samples.map(s=>({t:s[0],x:s[1],y:s[2],z:s[3],speed:s[4],kinetic:s[5],potential:s[6],total:s[7],angularMomentumZ:s[8]}))}))},preset:json.preset,releaseHeading};
  }
  async function loadJSON(event){
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>65_000_000)throw new Error('JSON too large (65 MB maximum).');
      const parsed=parseSession(JSON.parse(await file.text()));
      Object.assign(model,parsed.settings);model.preset=parsed.preset;model.releaseHeading=parsed.releaseHeading;model.spiralAutoDamping=false;
      model.running=false;build(parsed.configs,parsed.restored);updateControls();
      notice(`Loaded ${model.count} pendulums and ${model.tracks.reduce((n,t)=>n+t.samples.length,0).toLocaleString()} recorded points. Paused for inspection.`);
    }catch(error){notice('Import not applied: '+error.message);}finally{event.target.value='';}
  }

  $('#play').addEventListener('click',()=>{model.running=!model.running;model.lastFrame=0;model.accumulator=0;updateControls();});
  $('#reset').addEventListener('click',()=>{model.running=false;build(model.configs);updateControls();notice('Restarted every pendulum at its selected initial conditions. Press Play to run.');});
  $('#clear').addEventListener('click',clearSand);
  $('#count').addEventListener('input',e=>$('#countVal').textContent=e.target.value);
  $('#releaseHeading').addEventListener('input',e=>syncReleaseControls(Number(e.target.value)));
  $('#releaseExact').addEventListener('input',e=>{
    const n=Number(e.target.value);
    if(e.target.value!==''&&Number.isInteger(n)&&n>=0&&n<=359)syncReleaseControls(n);
  });
  $('#releaseDial').addEventListener('pointerdown',e=>{
    $('#releaseDial').setPointerCapture?.(e.pointerId);setReleaseFromWheel(e);
  });
  $('#releaseDial').addEventListener('pointermove',e=>{if(e.buttons&1)setReleaseFromWheel(e);});
  const applyArrangement=()=>{reconfigure();updateControls();};
  $('#apply').addEventListener('click',applyArrangement);
  $('#applyTop').addEventListener('click',applyArrangement);
  $('#gravity').addEventListener('input',e=>{model.gravity=Number(e.target.value);updateControls();updateMeasures();renderRows();});
  $('#damping').addEventListener('input',e=>{model.damping=Number(e.target.value);model.spiralAutoDamping=false;updateControls();});
  $('#speed').addEventListener('input',e=>{model.speed=Number(e.target.value);updateControls();});
  $('#theme').addEventListener('change',e=>{model.theme=e.target.value;model.groundDirty=true;renderCanvas();});
  for(const [id,key] of [['trailsToggle','drawTrails'],['bobToggle','drawBobs'],['labelToggle','drawLabels'],['followToggle','highlight']])
    $('#'+id).addEventListener('change',e=>{model[key]=e.target.checked;model.tracksDirty=true;renderCanvas();});
  $('#weight').addEventListener('input',e=>{model.weight=Number(e.target.value);model.tracksDirty=true;$('#weightVal').textContent=num(model.weight,1)+' px';});
  $('#focus').addEventListener('change',e=>setSelected(Number(e.target.value)));
  $('#updateOne').addEventListener('click',changeIndividual);
  $('#updateOneTop').addEventListener('click',changeIndividual);
  $('#rows').addEventListener('click',event=>{
    const toggle=event.target.closest('[data-toggle]');
    if(toggle){const i=Number(toggle.dataset.toggle);model.tracks[i].visible=!model.tracks[i].visible;model.tracksDirty=true;renderRows();renderCanvas();updateControls();return;}
    const row=event.target.closest('tr[data-index]');if(row)setSelected(Number(row.dataset.index));
  });
  $('#rows').addEventListener('keydown',event=>{if(event.key==='Enter'){const row=event.target.closest('tr[data-index]');if(row){setSelected(Number(row.dataset.index));}}});
  function zoom(amount){model.zoom=clamp(model.zoom*amount,.4,5);model.groundDirty=true;model.tracksDirty=true;renderCanvas();}
  $('#zoomIn').addEventListener('click',()=>zoom(1.2));$('#zoomOut').addEventListener('click',()=>zoom(1/1.2));
  $('#fit').addEventListener('click',()=>{model.zoom=1;model.panX=0;model.panY=0;model.groundDirty=true;model.tracksDirty=true;renderCanvas();});
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(-Math.sign(event.deltaY)*.12));},{passive:false});
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0){pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointermove',e=>{if(!pointer)return;model.panX+=e.clientX-pointer.x;model.panY+=e.clientY-pointer.y;pointer={x:e.clientX,y:e.clientY};model.groundDirty=true;model.tracksDirty=true;});
  canvas.addEventListener('pointerup',()=>pointer=null);canvas.addEventListener('pointercancel',()=>pointer=null);
  $('#png').addEventListener('click',savePNG);$('#svg').addEventListener('click',saveSVG);
  $('#csv').addEventListener('click',saveCSV);$('#json').addEventListener('click',saveJSON);
  $('#load').addEventListener('click',()=>$('#file').click());$('#file').addEventListener('change',loadJSON);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{resize();renderCanvas();drawEnergy();}).observe(canvas);
  window.addEventListener('resize',()=>{resize();renderCanvas();drawEnergy();});
  document.addEventListener('visibilitychange',()=>{model.lastFrame=0;model.accumulator=0;});
  // Local snapshot readers and explicit state-changing helpers for the studio
  // and reproducible browser tests. No API key or network access is required.
  window.Pendulums = Object.freeze({
    get status(){return {running:model.running,time:model.time,count:model.count,gravity:model.gravity,damping:model.damping,speed:model.speed,preset:model.preset,releaseHeading:model.releaseHeading};},
    getSnapshot(){return session();},
    // Fast, bounded samples for 3D draw calls without copying whole CSV histories.
    // The underlying physics states remain untouched by this viewer interface.
    getVisualFrame(limit=1250){
      const max=Math.min(2500,Math.max(150,Math.round(Number(limit))||1250));
      return {time:model.time,preset:model.preset,releaseHeading:model.releaseHeading,
        tracks:model.tracks.map((track,i)=>{
          const n=track.samples.length,stride=Math.max(1,Math.ceil(n/max)),samples=[];
          for(let j=0;j<n;j+=stride){const p=track.samples[j];samples.push([p.x,p.y,p.z]);}
          if(n>1&&(n-1)%stride!==0){
            const p=track.samples[n-1];samples.push([p.x,p.y,p.z]);
          }
          return {id:i,color:track.color,visible:track.visible,
            xyz:[...model.pendulums[i].r],samples,length:model.pendulums[i].length};
        })};
    },
    setTrailColors(colors){
      if(!Array.isArray(colors)||colors.length!==model.count||!colors.every(validateColor))
        throw Error('Supply a #RRGGBB color for every active pendulum.');
      colors.forEach((c,i)=>{
        model.configs[i].color=c;
        model.tracks[i].color=c;
        model.pendulums[i].color=c;
      });
      model.tracksDirty=true;applyFocus();renderRows();renderCanvas();
      return model.count;
    },
    clearIndividualOverride,
    setIndividualRecipe,
    setIndividualDamping(index,rate){
      if(!Number.isInteger(index)||index<0||index>=model.count)throw RangeError('Invalid pendulum index');
      if(!Number.isFinite(rate)||rate<0||rate>.5)throw RangeError('Individual damping must be from 0 to 0.5 s^-1');
      model.configs[index].damping=rate;
      return {index,damping:rate};
    },
    play(){model.running=true;updateControls();},pause(){model.running=false;updateControls();},
    clearSand,fitView(){model.zoom=1;model.panX=0;model.panY=0;model.groundDirty=true;model.tracksDirty=true;renderCanvas();}
  });
  reconfigure();updateControls();requestAnimationFrame(tick);
})();
