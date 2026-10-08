import {assess,countMasks,DISCLAIMER} from './severity-policy.mjs';
const $=id=>document.getElementById(id);
let state={mode:'phase1',selection:0,imageValid:false,quality:'unknown',waterLevel:null},image=null,maskNonce=0,frame=0,running=false;
const num=id=>$(id).value.trim()===''?null:Number($(id).value);
function stop(message='Simulation stopped. No hardware command was sent.'){
 if(frame)cancelAnimationFrame(frame);frame=0;
 if(running){$('simulation-status').textContent=message;state.operatorConfirmed=false;$('operator-confirmed').checked=false;}running=false;
 $('stop-simulation').disabled=true;
}
function clearConfirm(){state.operatorConfirmed=false;state.agronomistConfirmed=false;$('operator-confirmed').checked=false;$('agronomist-confirmed').checked=false;}
function render(){
 const result=assess(state);
 $('assessment-disease').textContent=result.disease||'Awaiting leaf';
 $('assessment-confidence').textContent=result.confidence===null?'— confidence':(result.confidence*100).toFixed(2)+'% confidence';
 $('assessment-mode').textContent=result.severityMode;$('assessment-band').textContent=result.severityBand;
 $('severity-percent-row').hidden=!Object.hasOwn(result,'severityPercent');
 $('assessment-percent').textContent=Object.hasOwn(result,'severityPercent')?result.severityPercent.toFixed(2)+'%':'';
 $('assessment-duration').textContent=result.simulatedDuration;
 $('assessment-review').textContent=result.manualReview?'Required':'No additional manual review flagged';
 $('assessment-agronomist').textContent=result.agronomistReview?(state.agronomistConfirmed?'Review recorded by operator':'Required · pending'):'Not triggered by severity rules';
 $('recommendation').textContent=result.recommendation;$('review-reasons').replaceChildren();
 for(const reason of result.reasons){const li=document.createElement('li');li.textContent=reason;$('review-reasons').append(li);}
 $('start-simulation').disabled=!result.canSimulate||running;
 $('agronomist-confirmed').disabled=!result.agronomistReview;
 const level=state.waterLevel,valid=Number.isFinite(level)&&level>=0&&level<=100;
 $('water-reading').textContent=valid?level+'%':'—';$('water-gauge').style.setProperty('--level',valid?level+'%':'0%');
 $('water-gauge').setAttribute('aria-label',valid?'Manual water level '+level+' percent':'Water level unknown');
 $('water-status').textContent=!valid?'Unknown · enter 0–100%. No sensor connected.':level===0?'Empty · simulation blocked.':level<=20?'Low reserve · manually reported.':'Available · manually reported, not live telemetry.';
 return result;
}
function invalidateMasks(){maskNonce++;state.segmentation=null;clearConfirm();stop();$('mask-status').textContent='No validated segmentation available.';render();}
function reset(){stop('Simulation cancelled: image or analysis changed.');state={mode:$('severity-mode').value,selection:state.selection+1,imageValid:false,quality:'unknown',waterLevel:num('water-level')};image=null;maskNonce++;clearConfirm();$('leaf-mask').value='';$('disease-mask').value='';$('seg-confidence').value='';$('mask-reviewed').checked=false;$('mask-status').textContent='No segmentation available.';$('quality-note').textContent='Analyze the current tomato leaf to connect its prediction here.';$('simulation-progress').value=0;render();}
function qualityCheck(img){
 if(!img||img.naturalWidth<224||img.naturalHeight<224)return {pass:false,note:'Image quality: use a photo at least 224 × 224 pixels.'};
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,256,256);const d=ctx.getImageData(0,0,256,256).data;const g=new Float32Array(65536);let mean=0,clip=0;
 for(let i=0;i<g.length;i++){g[i]=.299*d[4*i]+.587*d[4*i+1]+.114*d[4*i+2];mean+=g[i];if(g[i]<5||g[i]>250)clip++;}
 let sum=0,sq=0,n=0;for(let y=1;y<255;y++)for(let x=1;x<255;x++){const i=y*256+x,v=4*g[i]-g[i-1]-g[i+1]-g[i-256]-g[i+256];sum+=v;sq+=v*v;n++;}
 const variance=sq/n-(sum/n)**2;mean/=g.length;
 const pass=mean>=20&&mean<=240&&clip/g.length<.7&&variance>=8;
 return {pass,note:pass?'Basic quality check passed (resolution, exposure, focus heuristics). Visually review the leaf; this is not a validated quality model.':'Image quality needs review: photo may be blurry, too dark, overexposed or lack detail. No simulation allowed.'};
}
document.addEventListener('leaf-analysis-reset',reset);
document.addEventListener('leaf-input-rejected',()=>{reset();$('quality-note').textContent='Input rejected by the leaf check. No disease treatment is available.';});
document.addEventListener('leaf-analysis-complete',e=>{
 reset();const d=e.detail||{};image=d.image;state.selection=d.selection;
 const q=qualityCheck(image);state.imageValid=!!image;state.quality=q.pass?'pass':'fail';state.disease=d.disease;state.confidence=d.confidence;
 $('quality-note').textContent=q.note;render();
});
$('severity-mode').addEventListener('change',()=>{state.mode=$('severity-mode').value;$('segmentation-inputs').hidden=state.mode!=='phase2';invalidateMasks();});
for(const id of ['leaf-mask','disease-mask','seg-confidence','mask-reviewed'])$(id).addEventListener('input',invalidateMasks);
$('water-level').addEventListener('input',()=>{stop();clearConfirm();state.waterLevel=num('water-level');render();});
$('operator-confirmed').addEventListener('change',()=>{stop();state.operatorConfirmed=$('operator-confirmed').checked;render();});
$('agronomist-confirmed').addEventListener('change',()=>{stop();state.agronomistConfirmed=$('agronomist-confirmed').checked;state.operatorConfirmed=false;$('operator-confirmed').checked=false;render();});
async function readMask(file){
 if(!file||file.type!=='image/png'||file.size>20*1024*1024)throw Error('Choose a PNG mask under 20 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  if(!image||bitmap.width!==image.naturalWidth||bitmap.height!==image.naturalHeight)throw Error('Each mask must match the current photo’s original dimensions exactly.');
  if(bitmap.width*bitmap.height>12000000)throw Error('Masks above 12 megapixels are not supported. Use a smaller photo and matching masks.');
  const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);return ctx.getImageData(0,0,c.width,c.height).data;
 }finally{bitmap.close();}
}
$('import-masks').addEventListener('click',async()=>{
 invalidateMasks();const nonce=maskNonce,selection=state.selection;
 try{
  if(!image||!state.imageValid)throw Error('Analyze a valid leaf photo first.');
  const confidence=num('seg-confidence');if(confidence===null||confidence<0||confidence>100)throw Error('Enter source segmentation confidence from 0 to 100.');
  if(!$('mask-reviewed').checked)throw Error('Verify that the masks align with the current photo.');
  $('mask-status').textContent='Checking masks…';
  const [leaf,disease]=await Promise.all([readMask($('leaf-mask').files[0]),readMask($('disease-mask').files[0])]);
  if(nonce!==maskNonce||selection!==state.selection)return;
  const counts=countMasks(leaf,disease);state.segmentation={...counts,confidence:confidence/100,reviewed:true,selection,source:'Imported binary PNG masks; confidence entered by operator'};
  $('mask-status').textContent=`${counts.diseasedLeafPixels.toLocaleString()} diseased / ${counts.visibleLeafPixels.toLocaleString()} visible leaf pixels. ${confidence<80?'Confidence below 80%: severity withheld and simulation blocked.':'Masks imported and operator-reviewed.'}`;render();
 }catch(error){if(nonce===maskNonce){state.segmentation=null;$('mask-status').textContent=error.message;render();}}
});
$('start-simulation').addEventListener('click',()=>{
 const result=render();if(!result.canSimulate||running)return;
 running=true;$('start-simulation').disabled=true;$('stop-simulation').disabled=false;const start=performance.now(),ms=result.simulatedDuration*1000;
 function tick(now){
  if(!running)return;const elapsed=Math.min(ms,now-start);$('simulation-progress').value=elapsed/ms;
  $('simulation-status').textContent=`Screen-only simulation · ${Math.max(0,(ms-elapsed)/1000).toFixed(1)} seconds remaining`;
  if(elapsed>=ms){running=false;frame=0;state.operatorConfirmed=false;$('operator-confirmed').checked=false;$('stop-simulation').disabled=true;$('simulation-status').textContent='Simulation complete. No water consumed and no hardware command sent.';render();return;}
  frame=requestAnimationFrame(tick);
 }frame=requestAnimationFrame(tick);
});
$('stop-simulation').addEventListener('click',()=>{stop();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop('Simulation stopped because the tab was hidden.');render();}});
window.addEventListener('pagehide',()=>stop());
$('export-assessment').addEventListener('click',()=>{
 const output={...assess(state),waterLevelMode:'Manual — no sensor connected',waterLevelPercent:Number.isFinite(state.waterLevel)&&state.waterLevel>=0&&state.waterLevel<=100?state.waterLevel:null,qualityCheck:state.quality,segmentationSource:state.segmentation?.source||null,simulationRunning:running,recordedAt:new Date().toISOString(),safetyDisclaimer:DISCLAIMER};
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));a.href=url;a.download='leaf-flight-assessment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();

window.LeafFlightAssessment=Object.freeze({get:()=>({...assess(state),waterLevelMode:'Manual — no sensor connected',waterLevelPercent:Number.isFinite(state.waterLevel)&&state.waterLevel>=0&&state.waterLevel<=100?state.waterLevel:null,qualityCheck:state.quality,segmentationSource:state.segmentation?.source||null})});
