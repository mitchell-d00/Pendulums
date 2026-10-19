'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../physics.js');
const near = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b)<=tol,`${a} vs ${b} (tol ${tol})`);
test('30 bounded pendulums and 30 distinct colors',()=>{
  const cfg=P.preset(30,'ribbons');
  assert.equal(cfg.length,30);
  assert.equal(new Set(cfg.map(c=>c.color)).size,30);
  assert.throws(()=>P.preset(31),/Count/);
});
test('initial fixed-length/tangential constraints',()=>{
  for (const item of P.preset(30,'ribbons')){
    const p=P.makePendulum(item);
    near(Math.hypot(...p.r),p.length,1e-12);
    near(p.r.reduce((a,x,i)=>a+x*p.v[i],0),0,1e-12);
  }
});
test('zero state stays at bottom',()=>{
  const p=P.makePendulum({...P.preset(1,'still')[0],length:3});
  for(let i=0;i<4800;i++)P.step(p,P.FIXED_DT);
  near(p.r[0],0,1e-10);near(p.r[1],0,1e-10);near(p.r[2],3,1e-10);
  near(P.measures(p).total,0,1e-10);
});
test('radial planar swing remains planar without launch spin',()=>{
  const p=P.makePendulum({...P.preset(1,'fan')[0],phi:0,spin:0,push:0,theta:40});
  for(let i=0;i<2400;i++)P.step(p,P.FIXED_DT);
  near(p.r[1],0,1e-9);near(p.v[1],0,1e-9);
});
test('long-run conservation of total energy, angular momentum and rod length',()=>{
  const p=P.makePendulum({id:0,length:3,mass:2,theta:35,phi:25,spin:2,push:.12});
  const start=P.measures(p), initialL=p.length;
  let peakE=0,peakJ=0,peakL=0;
  for(let i=0;i<24000;i++){
    P.step(p,P.FIXED_DT,9.81,0);
    if (i%60===0) {
      const m=P.measures(p);
      peakE=Math.max(peakE,Math.abs(m.total-start.total));
      peakJ=Math.max(peakJ,Math.abs(m.angularMomentumZ-start.angularMomentumZ));
      peakL=Math.max(peakL,Math.abs(Math.hypot(...p.r)-initialL));
    }
  }
  assert.ok(peakE < 2e-4,`max energy error ${peakE}`);
  assert.ok(peakJ < 2e-4,`max z-momentum error ${peakJ}`);
  assert.ok(peakL < 1e-10,`max length constraint error ${peakL}`);
});
test('damping causes mechanical energy to decrease',()=>{
  const p=P.makePendulum({id:0,length:2.5,mass:1.2,theta:42,phi:40,spin:1,push:0});
  const e0=P.measures(p).total;
  for(let i=0;i<4800;i++)P.step(p,P.FIXED_DT,9.81,.14);
  assert.ok(P.measures(p).total < e0*.6);
});
test('circular orbit preset launches approximately circular trajectory',()=>{
  const p=P.makePendulum(P.preset(1,'orbit')[0]);
  const radial=Math.hypot(p.r[0],p.r[1]),z=p.r[2];
  for(let i=0;i<4800;i++)P.step(p,P.FIXED_DT);
  near(Math.hypot(p.r[0],p.r[1]),radial,.001);
  near(p.r[2],z,.001);
});
test('no integration of unsafe settings',()=>{
  assert.throws(()=>P.makePendulum({id:0,length:0,mass:1,theta:30,phi:0,spin:0,push:0}),/Length/);
  assert.throws(()=>P.step(P.makePendulum(P.preset(1)[0]),0),/Time step/);
  assert.throws(()=>P.step(P.makePendulum(P.preset(1)[0]),.004,9.81,-1),/Damping/);
});
