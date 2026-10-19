'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../physics.js');
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} ~= ${b}`);
const names=['ribbons','wave','orbit','fan','still','spiral','rosette','petals','starburst'];

test('all nine patterns keep 1–30 physically constrained bobs and separate colors',()=>{
  for(const name of names)for(const count of [1,7,30]){
    const group=P.preset(count,name,9.81,137);
    assert.equal(group.length,count);
    assert.equal(new Set(group.map(c=>c.color)).size,count);
    for(const c of group){
      assert.ok(c.phi>=0&&c.phi<360);
      const bob=P.makePendulum(c);
      close(Math.hypot(...bob.r),bob.length,1e-11);
      close(bob.r.reduce((s,v,i)=>s+v*bob.v[i],0),0,1e-10);
    }
  }
});
test('360 unique, one-degree release positions around the pivot',()=>{
  const xy=[];
  for(let deg=0;deg<360;deg++){
    const p=P.makePendulum(P.preset(1,'starburst',9.81,deg)[0]);
    xy.push(`${p.r[0].toFixed(9)},${p.r[1].toFixed(9)}`);
  }
  assert.equal(new Set(xy).size,360);
  const p0=P.makePendulum(P.preset(1,'starburst',9.81,0)[0]);
  const p90=P.makePendulum(P.preset(1,'starburst',9.81,90)[0]);
  close(p0.r[0],p90.r[1],1e-11);
  close(p0.r[1],0,1e-11);
  close(p90.r[0],0,1e-11);
  for(const bad of [-1,360,360.5,NaN,Infinity,'7'])
    assert.throws(()=>P.preset(1,'starburst',9.81,bad),/Release heading/);
});
test('turning the release compass rotates the ensemble without changing initial energy',()=>{
  for(const name of ['spiral','rosette','petals','orbit','ribbons']){
    const a=P.preset(30,name,9.81,0),b=P.preset(30,name,9.81,143);
    for(let i=0;i<30;i++){
      const x=P.makePendulum(a[i]),y=P.makePendulum(b[i]);
      close(x.r[2],y.r[2],1e-10);
      close(P.measures(x).total,P.measures(y).total,1e-9);
      close(P.measures(x).speed,P.measures(y).speed,1e-9);
      close((a[i].phi+143)%360,b[i].phi,1e-10);
    }
  }
});
test('damped spherical spiral winds inward as real mechanical energy is dissipated',()=>{
  const p=P.makePendulum(P.preset(1,'spiral')[0]);
  const start=Math.hypot(p.r[0],p.r[1]),e0=P.measures(p).total;
  let phi=Math.atan2(p.r[1],p.r[0]),angle=0,low=start,high=0;
  for(let i=0;i<240*25;i++){
    P.step(p,P.FIXED_DT,9.81,.055);
    const radius=Math.hypot(p.r[0],p.r[1]);
    low=Math.min(low,radius);high=Math.max(high,radius);
    const next=Math.atan2(p.r[1],p.r[0]);
    let delta=next-phi;
    if(delta>Math.PI)delta-=2*Math.PI;
    if(delta<-Math.PI)delta+=2*Math.PI;
    angle+=delta;phi=next;
  }
  assert.ok(Math.abs(angle)>8*Math.PI,'expected multiple true revolutions');
  assert.ok(Math.hypot(p.r[0],p.r[1])<start*.75,'inward contraction');
  assert.ok(P.measures(p).total<e0*.5,'energy loss');
  assert.ok(high>low,'trajectory radius varies');
});
test('undamped rosette remains conservative with non-circular radial variation',()=>{
  const p=P.makePendulum(P.preset(1,'rosette')[0]),initial=P.measures(p);
  const start=Math.hypot(p.r[0],p.r[1]);let spread=0;
  for(let i=0;i<240*20;i++){
    P.step(p,P.FIXED_DT,9.81,0);
    if(i%120===0)spread=Math.max(spread,Math.abs(Math.hypot(p.r[0],p.r[1])-start));
  }
  close(P.measures(p).total,initial.total,1e-4);
  close(P.measures(p).angularMomentumZ,initial.angularMomentumZ,1e-4);
  assert.ok(spread>.1);
});
test('starburst begins with 30 evenly spaced radial directions',()=>{
  const cfg=P.preset(30,'starburst',9.81,7);
  for(let i=0;i<30;i++){
    close(cfg[i].phi,(7+12*i)%360,1e-9);
    assert.equal(cfg[i].spin,0);
  }
});
