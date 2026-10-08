'use strict';
const $ = id => document.getElementById(id);
const CLASSES = ['Early blight','Healthy','Late blight'];
const NOTES = ['The model found features most similar to early blight examples.','The model found features most similar to healthy leaf examples. This does not rule out other problems.','The model found features most similar to late blight examples.'];
let model = null, selectedImage = null, imageURL = null, selection = 0, loading = false, predicting = false;
function message(text = '') { $('message').textContent = text; $('message').hidden = !text; }
function updateButton() { $('predict').disabled = !model || !selectedImage || predicting || window.droneCaptureBusy; }
function clearResult() {
 $('result').hidden=true;$('empty-result').hidden=false;
 $('input-verdict').hidden=true;$('leaf-check-status').textContent='Leaf check required before disease analysis';
}
function rejectInput(status) {
 const text=status==='not-leaf'?'Not a leaf — upload a clear photo of a tomato leaf.':'Leaf not confirmed — use a clear close-up of one tomato leaf.';
 $('result').hidden=true;$('empty-result').hidden=true;
 $('prediction-name').textContent='';$('top-score').textContent='';$('scores').replaceChildren();
 $('input-verdict').textContent=text;$('input-verdict').hidden=false;
 $('leaf-check-status').textContent='Disease analysis blocked';
 document.dispatchEvent(new CustomEvent('leaf-input-rejected',{detail:{status}}));
 return {status:'rejected',reason:text};
}
async function getBytes(path) { const r = await fetch(new URL(path, document.baseURI)); if (!r.ok) throw new Error(`Could not load ${path}: ${r.status}`); return await r.arrayBuffer(); }
async function loadModel() {
 if (loading || model) return;
 loading = true; $('retry').hidden = true; $('model-status').textContent = 'Loading model…';
 try {
  if (!window.tf || !window.tflite_web_api_ModuleFactory) throw new Error('Prediction files did not load');
  await tf.setBackend('cpu'); await tf.ready();
  const [wasm, bytes] = await Promise.all([getBytes('./tflite_web_api_cc.wasm'), getBytes('./tomato.tflite')]);
  model = await createLeafEngine(tflite_web_api_ModuleFactory, wasm, bytes);
  $('model-status').textContent = 'Model ready · on-device';
 } catch (error) {
  console.error(error); $('model-status').textContent = 'Model could not load'; $('retry').hidden = false;
  message('Could not load the model. Check your connection and choose Retry loading. If the problem continues, reload this page in a current version of Chrome, Edge, Firefox or Safari.');
 } finally { loading = false; updateButton(); }
}
async function chooseFile(file, {keepCamera = false} = {}) {
 if (!keepCamera && typeof closeCamera === 'function') closeCamera(false);
 const token = ++selection; selectedImage = null; updateButton(); clearResult(); message();
 if (imageURL) { URL.revokeObjectURL(imageURL); imageURL = null; }
 $('captured-frame').hidden = true; $('captured-thumbnail').removeAttribute('src');
 $('preview').hidden = true; $('preview').removeAttribute('src'); $('upload-prompt').hidden = false; $('file-name').textContent = 'No photo selected'; $('image-size').textContent = '';
 if (!file) return;
 if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { message('Please choose a JPG, PNG or WebP image.'); return; }
 if (file.size > 10*1024*1024) { message('This photo is over 10 MB. Please choose a smaller image.'); return; }
 const url = URL.createObjectURL(file); imageURL = url;
 try {
  const img = new Image(); img.src = url; await img.decode();
  if (token !== selection) return;
  if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 40000000) throw new Error('Image too large');
  selectedImage = img; $('preview').src = url; $('preview').hidden = !!(keepCamera && cameraStream); $('upload-prompt').hidden = true;
  $('captured-thumbnail').src = url; $('captured-frame').hidden = false;
  $('file-name').textContent = file.name; $('image-size').textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
 } catch (error) { if (token === selection) { message('This image could not be opened, or exceeds 40 megapixels. Try a smaller JPG, PNG or WebP.'); URL.revokeObjectURL(url); imageURL = null; } }
 finally { if (token === selection) updateButton(); }
}
function showResult(scores) {
 const top = scores.indexOf(Math.max(...scores));
 $('prediction-name').textContent = CLASSES[top]; $('top-score').textContent = `${(scores[top]*100).toFixed(1)}%`; $('result-description').textContent = NOTES[top]; $('scores').replaceChildren();
 scores.map((score,index)=>({score,index})).sort((a,b)=>b.score-a.score).forEach(({score,index})=>{
  const row=document.createElement('div'); row.className=`score-row${index===top?' winner':''}`;
  const heading=document.createElement('div');heading.className='score-header';
  const label=document.createElement('span');label.textContent=CLASSES[index];const number=document.createElement('strong');number.textContent=`${(score*100).toFixed(1)}%`;heading.append(label,number);
  const track=document.createElement('div');track.className='track';track.setAttribute('aria-hidden','true');const fill=document.createElement('div');fill.className='fill';fill.style.width=`${score*100}%`;track.append(fill);row.append(heading,track);$('scores').append(row);
 });
 $('low-score').hidden = scores[top]>=.5; $('result').hidden=false; $('empty-result').hidden=true;
 return {prediction:CLASSES[top],scores:Object.fromEntries(CLASSES.map((name,i)=>[name,scores[i]])),scope:'Three tomato leaf classes only; not a diagnosis.'};
}
async function predict() {
 if (predicting || !model || !selectedImage || window.droneCaptureBusy) throw new Error('Select a photo and wait for the model to be ready.');
 predicting=true;const token=selection, img=selectedImage;updateButton();message();clearResult();$('predict').textContent='Checking leaf…';
 try {
  if(!window.LeafGuard)throw Object.assign(new Error('Leaf check unavailable. Reload the page. Disease analysis remains blocked.'),{code:'LEAF_CHECK_UNAVAILABLE'});
  $('leaf-check-status').textContent='Loading leaf check… First use downloads about 154 MB; later checks can use the browser cache.';
  const verdict=await window.LeafGuard.check(img,text=>{if(token===selection)$('leaf-check-status').textContent=text;});
  if(token!==selection)return {status:'cancelled',reason:'Photo changed during leaf check'};
  if(verdict.status!=='leaf')return rejectInput(verdict.status);
  $('leaf-check-status').textContent='Leaf check passed · checking the three tomato disease classes';
  $('predict').textContent='Analyzing…';
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  // Match tf.image.resize: RGB, bilinear, half-pixel centers, float32 0–255.
  // Normalization is embedded in the model: do not divide by 255.
  const pixels=tf.tidy(()=>tf.image.resizeBilinear(tf.browser.fromPixels(img,3),[224,224],false,true).toFloat().dataSync());
  const values=model.predict(pixels);
  if (token!==selection) throw new Error('Photo changed during analysis');
  return showResult(values);
 } catch(error) { if(token===selection) {message(error.code==='LEAF_CHECK_UNAVAILABLE'?error.message:'Prediction could not finish. Try another photo or reload the page.');$('leaf-check-status').textContent='Analysis blocked — retry required';}console.error(error);throw error; }
 finally { predicting=false;$('predict').textContent='Check & analyze leaf';updateButton(); }
}
$('photo').addEventListener('change',event=>{chooseFile(event.target.files[0]);event.target.value='';});
$('predict').addEventListener('click',()=>{predict().catch(()=>{});});$('retry').addEventListener('click',()=>{message();loadModel();});
['dragenter','dragover'].forEach(type=>$('drop-zone').addEventListener(type,event=>{event.preventDefault();$('drop-zone').classList.add('dragging');}));
['dragleave','drop'].forEach(type=>$('drop-zone').addEventListener(type,event=>{event.preventDefault();$('drop-zone').classList.remove('dragging');}));
$('drop-zone').addEventListener('drop',event=>{if(event.dataTransfer.files.length)chooseFile(event.dataTransfer.files[0]);});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'analyze_selected_tomato_leaf',title:'Analyze selected tomato leaf',description:'Run the trained model on the photo already selected by the user, and display all three class scores. Requires a loaded model and selected photo.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');return await predict();}})).catch(()=>{});}catch{}}
loadModel();

