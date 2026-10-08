const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8').replace(/loadModel\(\);\s*$/,'');
function harness(check){
 const nodes=new Map(),events=[];let diseaseCalls=0,pixelCalls=0;
 const node=()=>({hidden:false,disabled:false,textContent:'',style:{},classList:{add(){},remove(){}},addEventListener(){},setAttribute(){},append(){},replaceChildren(){}});
 const c={console:{error(){}},window:{droneCaptureBusy:false,LeafGuard:check?{check}:undefined},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},createElement:node,dispatchEvent(e){events.push(e)}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},requestAnimationFrame:f=>f(),tf:{tidy:f=>f(),browser:{fromPixels(){pixelCalls++;return 'pixels'}},image:{resizeBilinear(p,size,corners,half){assert.deepEqual(Array.from(size),[224,224]);assert.equal(corners,false);assert.equal(half,true);return {toFloat:()=>({dataSync:()=>[1,2,3]})}}}},infer(){diseaseCalls++;return [.1,.8,.1]}};
 vm.createContext(c);vm.runInContext(src,c);vm.runInContext('model={predict:infer};selectedImage={naturalWidth:640,naturalHeight:480};',c);
 return {c,n:id=>c.document.getElementById(id),calls:()=>diseaseCalls,pixels:()=>pixelCalls,events};
}
(async()=>{
 for(const status of ['not-leaf','uncertain']){
  const h=harness(async()=>({status}));const r=await h.c.predict();assert.equal(r.status,'rejected');assert.equal(h.calls(),0);assert.equal(h.pixels(),0);assert.equal(h.n('result').hidden,true);assert.equal(h.n('input-verdict').hidden,false);assert.equal(h.n('top-score').textContent,'');
 }
 const valid=harness(async()=>({status:'leaf'}));await valid.c.predict();assert.equal(valid.calls(),1);assert.equal(valid.n('result').hidden,false);
 for(const check of [undefined,async()=>{throw Object.assign(new Error('Leaf check unavailable'),{code:'LEAF_CHECK_UNAVAILABLE'})}]){
  const h=harness(check);await assert.rejects(h.c.predict());assert.equal(h.calls(),0);assert.equal(h.n('result').hidden,true);assert.match(h.n('leaf-check-status').textContent,/blocked/);
 }
 let resolve;const changed=harness(()=>new Promise(r=>resolve=r));const p=changed.c.predict();vm.runInContext('selection++;selectedImage={};',changed.c);resolve({status:'leaf'});const r=await p;assert.equal(r.status,'cancelled');assert.equal(changed.calls(),0);
 const concurrent=harness(()=>new Promise(r=>resolve=r));const first=concurrent.c.predict();await assert.rejects(concurrent.c.predict());resolve({status:'not-leaf'});await first;assert.equal(concurrent.calls(),0);
 console.log('PASS: rejected/uncertain inputs, unavailable checker, changed image and concurrent calls cannot invoke disease inference; accepted image uses original preprocessing.');
})().catch(e=>{console.error(e);process.exitCode=1});
