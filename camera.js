'use strict';
// Camera transport only. Inference/preprocessing stays in the original app.js.
let cameraStream = null, cameraRequest = 0, capturingPhoto = false;
let cameraSession = null, cameraTimer = null, frameCallback = null;
let lastFrameAt = 0, frameSeen = false, activeSource = '';
window.droneCaptureBusy = false;
function cameraError(text = '') { $('camera-error').textContent=text; $('camera-error').hidden=!text; }
function stopTracks(stream) { stream?.getTracks().forEach(t=>t.stop()); }
function setPower(state) {
 $('drone-power-status').textContent=state;
 document.body.classList.toggle('drone-on',state==='DRONE ON');
 $('drone-off').disabled=state==='DRONE OFF';
}
function closeCamera(returnFocus=true) {
 ++cameraRequest;
 clearInterval(cameraTimer); cameraTimer=null;
 const video=$('camera-video');
 if(frameCallback!==null && video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameCallback);
 frameCallback=null;frameSeen=false;lastFrameAt=0;
 cameraSession?.close();cameraSession=null;stopTracks(cameraStream);cameraStream=null;
 capturingPhoto=false;window.droneCaptureBusy=false;
 video.pause();video.srcObject=null;video.hidden=true;
 $('camera-panel').hidden=true;$('capture-photo').disabled=true;$('capture-photo').textContent='Capture image';
 $('open-camera').disabled=false;$('open-camera').setAttribute('aria-expanded','false');
 $('preview').hidden=!selectedImage;$('upload-prompt').hidden=!!selectedImage;
 $('connection-detail').textContent='Disconnected';
 setPower('DRONE OFF');updateButton();
 if(returnFocus)$('open-camera').focus();
}
function connectionLost(text='Drone disconnected. Reconnect the selected source; the phone camera will not be opened.') {
 closeCamera(false);cameraError(text);
}
async function refreshCameras() {
 const select=$('camera-device'), previous=select.value;
 try {
  if(!navigator.mediaDevices?.enumerateDevices)throw new Error('Camera listing is unavailable in this browser.');
  const cameras=(await navigator.mediaDevices.enumerateDevices()).filter(x=>x.kind==='videoinput'&&x.deviceId);
  select.replaceChildren(new Option('Select the drone/capture-device camera', ''));
  cameras.forEach((d,i)=>select.add(new Option(d.label||`Camera ${i+1} (name hidden until permission)`,d.deviceId)));
  if(cameras.some(d=>d.deviceId===previous))select.value=previous;
  $('device-help').textContent=cameras.length ? 'Select the exact capture device. Your browser cannot verify whether it is attached to a drone.' : 'No selectable camera found. Connect a compatible capture device, or use Phone / laptop camera once to grant permission, then refresh this list.';
 } catch(e) {cameraError(e.message);}
}
function updateSourceUI() {
 closeCamera(false);cameraError();
 // Clear the previous image/result when the user changes source intentionally.
 chooseFile(null);
 const mode=$('camera-source').value;
 $('device-settings').hidden=mode!=='device';$('network-settings').hidden=mode!=='whep';
 $('source-help').textContent=mode==='phone'?'Uses your phone rear camera when available, or your laptop camera.':mode==='device'?'Connect a drone receiver or camera capture device recognized by your browser. There is no automatic camera fallback.':'Use a configured HTTPS WHEP video adapter. An RTSP URL or a drone app link cannot be entered directly.';
 if(mode==='device')refreshCameras();
}
async function openCamera() {
 if(!$('camera-panel').hidden)return;
 cameraError();
 if(!window.isSecureContext){cameraError('Camera connections require HTTPS or localhost.');return;}
 const mode=$('camera-source').value;
 if(mode==='device'&&!$('camera-device').value){cameraError('Choose the exact connected camera first. No phone-camera fallback will be used.');return;}
 if(mode!=='whep'&&!navigator.mediaDevices?.getUserMedia){cameraError('Camera access is unavailable in this browser.');return;}
 const request=++cameraRequest;
 activeSource=mode==='phone'?'Phone / laptop camera':mode==='device'?'Selected capture device':'Network drone stream';
 window.activeCameraSource=activeSource;
 $('camera-panel').hidden=false;$('open-camera').disabled=true;$('open-camera').setAttribute('aria-expanded','true');
 $('capture-photo').disabled=true;$('camera-status').textContent=mode==='whep'?'Connecting to the selected drone stream…':'Allow access to the selected camera. Drone OFF cancels.';
 setPower('CONNECTING');$('drone-off').focus();
 // Block stale captures if the connection delivers no new decoded frames.
 const started=performance.now();lastFrameAt=started;frameSeen=false;
 cameraTimer=setInterval(()=>{
  if(request!==cameraRequest)return;
  if(performance.now()-(frameSeen?lastFrameAt:started)>(frameSeen?4000:20000))connectionLost('Camera feed stopped or timed out. Reconnect your selected source. No camera fallback was used.');
 },500);
 try {
  let stream;
  if(mode==='whep') {
   cameraSession=new WHEPCamera($('stream-url').value.trim(),$('stream-token').value.trim());
   stream=await cameraSession.connect(()=>{if(request===cameraRequest)connectionLost();});
  } else {
   const video={width:{ideal:1280},height:{ideal:960},frameRate:{ideal:24,max:30}};
   if(mode==='device')video.deviceId={exact:$('camera-device').value};
   else video.facingMode={ideal:'environment'};
   stream=await navigator.mediaDevices.getUserMedia({audio:false,video});
  }
  if(request!==cameraRequest){stopTracks(stream);return;}
  cameraStream=stream;
  const video=$('camera-video');video.srcObject=stream;video.hidden=false;$('preview').hidden=true;$('upload-prompt').hidden=true;
  const track=stream.getVideoTracks()[0];if(!track)throw new Error('The selected source did not provide video.');
  track.addEventListener('ended',()=>{if(request===cameraRequest)connectionLost();},{once:true});
  const settings=track.getSettings?.()||{};
  $('connection-detail').textContent=`${activeSource}${track.label?' · '+track.label:''}${settings.width?' · '+settings.width+' × '+settings.height:''}`;
  await video.play();if(request!==cameraRequest)return;
  if(video.requestVideoFrameCallback) {
   const tick=()=>{if(request!==cameraRequest)return;lastFrameAt=performance.now();frameSeen=true;cameraFrameReady();frameCallback=video.requestVideoFrameCallback(tick);};
   frameCallback=video.requestVideoFrameCallback(tick);
  }
  cameraFrameReady();
 } catch(e) {
  if(request!==cameraRequest)return;
  closeCamera(false);
  const messages={NotAllowedError:'Camera permission denied. Allow camera access in browser settings.',NotFoundError:'The selected camera was not found. Reconnect it and refresh the camera list.',OverconstrainedError:'The selected camera is unavailable. No alternate camera was opened.',NotReadableError:'Camera is busy or unavailable. Close other camera applications.'};
  cameraError(messages[e.name]||e.message||'Could not connect the selected camera.');
 }
}
function cameraFrameReady() {
 const v=$('camera-video');
 const fresh=frameSeen && performance.now()-lastFrameAt<4000;
 if(cameraStream&&fresh&&v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0&&!capturingPhoto) {
  if(!$('capture-photo').disabled && $('drone-power-status').textContent==='DRONE ON')return;
  $('capture-photo').disabled=false;setPower('DRONE ON');
  $('camera-status').textContent=`${activeSource} ON · Capture a close-up of one leaf, then Analyze leaf.`;
 }
}
async function capturePhoto() {
 const v=$('camera-video');
 if(!cameraStream||capturingPhoto||!frameSeen||performance.now()-lastFrameAt>=4000||v.readyState<2||!v.videoWidth)return;
 const request=cameraRequest;capturingPhoto=true;window.droneCaptureBusy=true;updateButton();
 $('capture-photo').disabled=true;$('capture-photo').textContent='Capturing…';cameraError();
 try {
  const canvas=document.createElement('canvas'),scale=Math.min(1,1920/Math.max(v.videoWidth,v.videoHeight));
  canvas.width=Math.max(1,Math.round(v.videoWidth*scale));canvas.height=Math.max(1,Math.round(v.videoHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image capture unavailable');ctx.drawImage(v,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image capture failed')),'image/jpeg',.95));
  if(request!==cameraRequest)return;
  await chooseFile(new File([blob],`${$('camera-source').value}-capture.jpg`,{type:'image/jpeg'}),{keepCamera:true});
  if(request===cameraRequest && Math.min(v.videoWidth,v.videoHeight)<224)cameraError('Low-resolution feed: use a higher-quality close-up before relying on the result.');
 } catch(e) {if(request===cameraRequest)cameraError('Capture failed. Reconnect the source or upload a leaf photo.');}
 finally {if(request===cameraRequest){capturingPhoto=false;window.droneCaptureBusy=false;$('capture-photo').textContent='Capture image';cameraFrameReady();updateButton();}}
}
$('open-camera').addEventListener('click',openCamera);
$('drone-off').addEventListener('click',()=>closeCamera());$('close-camera').addEventListener('click',()=>closeCamera());
$('capture-photo').addEventListener('click',capturePhoto);
$('camera-source').addEventListener('change',updateSourceUI);
$('camera-device').addEventListener('change',()=>{closeCamera(false);chooseFile(null);cameraError();});
['stream-url','stream-token'].forEach(id=>$(id).addEventListener('input',()=>{closeCamera(false);chooseFile(null);}));
$('refresh-cameras').addEventListener('click',refreshCameras);
// Older browsers: timeupdate only counts as fresh when video time advances.
let previousVideoTime=-1;
$('camera-video').addEventListener('timeupdate',()=>{
 const v=$('camera-video');if(!v.requestVideoFrameCallback&&cameraStream&&v.currentTime!==previousVideoTime){previousVideoTime=v.currentTime;frameSeen=true;lastFrameAt=performance.now();cameraFrameReady();}
});
window.addEventListener('pagehide',()=>closeCamera(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeCamera(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCamera();});
