'use strict';
// Fail closed: never run the disease classifier if leaf verification is unavailable.
window.LeafGuard=(()=>{
 let worker=null,serial=0,pending=null;
 const cache=new WeakMap();
 const failure=()=>Object.assign(new Error('Leaf check unavailable. Check your connection and retry. Disease analysis remains blocked.'),{code:'LEAF_CHECK_UNAVAILABLE'});
 function reset(error=failure()) {
  worker?.terminate();worker=null;
  if(pending){clearTimeout(pending.timer);const reject=pending.reject;pending=null;reject(error);}
 }
 function getWorker(){
  if(!worker){
   worker=new Worker(new URL('./leaf-check-worker.js?v=leaf-1',document.baseURI),{type:'module'});
   worker.onerror=()=>reset();worker.onmessageerror=()=>reset();
   worker.onmessage=({data})=>{
    if(!pending||data.id!==pending.id)return;
    if(data.type==='progress'){pending.onProgress?.(data.text);return;}
    const job=pending;pending=null;clearTimeout(job.timer);
    if(data.type==='result'&&['leaf','not-leaf','uncertain'].includes(data.result?.status)){
     cache.set(job.img,data.result);job.resolve(data.result);
    }else {worker.terminate();worker=null;job.reject(failure());}
   };
  }
  return worker;
 }
 async function check(img,onProgress){
  if(cache.has(img))return cache.get(img);
  if(pending)throw failure();
  try {
   if(!img.naturalWidth||!img.naturalHeight)throw failure();
   // Bounded transfer; the original disease-model image remains unmodified.
   const scale=Math.min(1,1024/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw failure();
   context.drawImage(img,0,0,canvas.width,canvas.height);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
   const receiver=getWorker();
   return await new Promise((resolve,reject)=>{
    const id=++serial;
    pending={id,img,onProgress,resolve,reject,timer:setTimeout(()=>reset(),240000)};
    try{receiver.postMessage({id,width:canvas.width,height:canvas.height,pixels:pixels.buffer},[pixels.buffer]);}catch{reset();}
   });
  }catch(e){if(e.code==='LEAF_CHECK_UNAVAILABLE')throw e;throw failure();}
 }
 window.addEventListener('pagehide',()=>reset());
 return {check};
})();
