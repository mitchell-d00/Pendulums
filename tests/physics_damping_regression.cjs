'use strict';
const test=require('node:test'), assert=require('node:assert/strict'),P=require('../physics.js');
function energy(bob){return P.measures(bob).total;}
test('independent per-bob damping uses unchanged RK4 engine and physical loss',()=>{
 const a=P.makePendulum(P.preset(2,'rosette',9.81,120)[0]);
 const b=P.makePendulum(P.preset(2,'rosette',9.81,120)[0]);
 const beforeA=energy(a),beforeB=energy(b);
 for(let k=0;k<240*12;k++){ P.step(a,P.FIXED_DT,9.81,0.08);P.step(b,P.FIXED_DT,9.81,0); }
 assert.ok(energy(a)<beforeA*0.75,'damped bob lost energy');
 assert.ok(Math.abs(energy(b)-beforeB)<0.0001,'undamped bob conserves energy');
 for(const bob of [a,b]){assert.ok(Math.abs(Math.hypot(...bob.r)-bob.length)<1e-10);assert.ok(Math.abs(bob.r.reduce((s,x,i)=>s+x*bob.v[i],0))<1e-8);}
});
