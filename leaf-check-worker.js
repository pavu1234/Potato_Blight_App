import {pipeline,env,RawImage} from './vendor/transformers.min.js';
import {LABELS,assessLeaf} from './leaf-policy.mjs';
env.allowLocalModels=false;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
let classifierPromise;
self.onmessage=async({data})=>{
 const {id,pixels,width,height}=data;
 try {
  if(!classifierPromise)classifierPromise=pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32',{
   revision:'d15189d7028b43f1d3e65039190477f6af591c2a',quantized:true,
   progress_callback:p=>{if(p.status==='progress')self.postMessage({id,type:'progress',text:'Downloading leaf-check model… '+Math.round(p.progress||0)+'%'});}
  }).catch(e=>{classifierPromise=null;throw e;});
  const classifier=await classifierPromise;
  self.postMessage({id,type:'progress',text:'Checking whether the photo is a leaf…'});
  const image=new RawImage(new Uint8ClampedArray(pixels),width,height,4);
  const scores=await classifier(image,LABELS,{hypothesis_template:'{}'});
  self.postMessage({id,type:'result',result:assessLeaf(scores)});
 } catch(e) {
  self.postMessage({id,type:'error',text:'Leaf check unavailable. Check your connection and retry. Disease analysis remains blocked.'});
 }
};
