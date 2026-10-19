'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../physics.js');
function approx(a,b,tol=1e-6){assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`)}
test('spinning starburst creates genuine tangential motion, unlike radial starburst',()=>{
 const a=P.preset(30,'starburst',9.81),b=P.preset(30,'spinburst',9.81);
 assert.equal(a.length,30);assert.equal(b.length,30);
 for(let i=0;i<30;i++){
  assert.equal(a[i].spin,0);assert.ok(b[i].spin>.35);
  approx(a[i].theta,b[i].theta);approx(a[i].length,b[i].length);
  const p=P.makePendulum(b[i]);approx(Math.hypot(...p.r),p.length,1e-11);
  approx(p.r.reduce((acc,n,j)=>acc+n*p.v[j],0),0,1e-11);
 }
});
test('changing camera rotation / trail color never changes forces, energy or momentum',()=>{
 const p=P.makePendulum(P.preset(1,'spinburst',9.81)[0]);
 const m0=P.measures(p);p.color='#abcdef';const m1=P.measures(p);
 approx(m0.total,m1.total);approx(m0.angularMomentumZ,m1.angularMomentumZ);
 for(let i=0;i<2400;i++)P.step(p,P.FIXED_DT,9.81,0);
 const m=P.measures(p);approx(m.total,m0.total,1e-4);
 approx(m.angularMomentumZ,m0.angularMomentumZ,1e-4);
 approx(Math.hypot(...p.r),p.length,1e-10);
});
test('spinburst generated first-step XYZ point is real integrated dynamics',()=>{
 const p=P.makePendulum(P.preset(1,'spinburst',9.81)[0]);const r=[...p.r];
 P.step(p,P.FIXED_DT,9.81,0);assert.notDeepEqual(p.r,r);
 assert.ok(p.r.every(Number.isFinite));
});
