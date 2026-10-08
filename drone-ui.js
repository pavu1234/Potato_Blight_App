'use strict';
// Presentation only: does not call, change or retrain the prediction engine.
(() => {
 const el = id => document.getElementById(id);
 let lastSource = '', currentSnapshot = null, snapshotNumber = 0;
 const gallery = el('snapshot-gallery');
 function rememberImage() {
  const img = el('preview');
  const src = img.getAttribute('src');
  if (!src || src === lastSource || !img.complete || !img.naturalWidth) return;
  const canvas = document.createElement('canvas');
  const ratio = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  const thumb = document.createElement('img');
  thumb.src = canvas.toDataURL('image/jpeg', .8);
  thumb.alt = `Leaf image ${++snapshotNumber}`;
  const card = document.createElement('figure'); card.className = 'snapshot-card';
  const caption = document.createElement('figcaption');
  const label = document.createElement('strong'); label.textContent = 'Not analyzed';
  const name = document.createElement('span'); name.textContent = `${String(snapshotNumber).padStart(2,'0')} / ${el('file-name').textContent}`;
  const time = document.createElement('time'); const now = new Date();
  time.dateTime = now.toISOString(); time.textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  caption.append(label, name, time); card.append(thumb, caption); gallery.prepend(card);
  while (gallery.children.length > 6) gallery.lastElementChild.remove();
  currentSnapshot = label; lastSource = src;
  el('snapshot-count').textContent = String(gallery.children.length);
  el('snapshot-empty').hidden = true;
 }
 document.addEventListener('leaf-input-rejected', e => {
  if(currentSnapshot && lastSource === el('preview').getAttribute('src')) currentSnapshot.textContent=e.detail.status==='not-leaf'?'Not a leaf · rejected':'Leaf not confirmed · rejected';
 });
 el('preview').addEventListener('load', () => { rememberImage(); updateView(); });
 const mission = () => el('mission-name').value.trim() || 'Leaf inspection';
 function updateNotes() {
  el('mission-display').textContent = mission();
  el('result-mission').textContent = mission();
  el('result-plot').textContent = el('plot-name').value.trim() || 'Not provided';
 }
 ['mission-name','plot-name'].forEach(id => el(id).addEventListener('input', updateNotes));
 function updateView() {
  const live = !el('camera-video').hidden && !el('camera-panel').hidden;
  const photo = !el('preview').hidden && !!el('preview').getAttribute('src');
  const busy = /Analyzing|Checking/.test(el('predict').textContent);
  el('source-badge').textContent = live ? (window.activeCameraSource || 'CAMERA') + ' · LIVE' : photo ? 'STILL IMAGE · DRONE OFF' : 'DRONE OFF';
  el('feed-state').textContent = busy ? 'ANALYZING IMAGE' : live ? 'CAMERA PREVIEW' : photo ? 'FRAME LOADED' : 'AWAITING INPUT';
  el('result-file').textContent = el('file-name').textContent;
  el('frame-label').hidden = live || !photo || el('result').hidden;
  if (!el('result').hidden) {
   const label = el('prediction-name').textContent;
   const score = el('top-score').textContent;
   el('frame-label').textContent = `${label} · ${score} score / whole image`;
   rememberImage();
   if (currentSnapshot && lastSource === el('preview').getAttribute('src')) currentSnapshot.textContent = `${label} · ${score} score`;
   el('score-explanation').textContent = `The model assigned ${score} of its three-class score total to ${label}. This is its strongest match among Early blight, Healthy and Late blight; the three displayed scores total approximately 100% after rounding.`;
   const explanations = {
    'Early blight':'The image most closely matches the model’s early blight examples. The model has not measured lesions or confirmed their cause.',
    'Healthy':'The image most closely matches the model’s healthy examples. This does not rule out other diseases, pests or nutritional problems.',
    'Late blight':'The image most closely matches the model’s late blight examples. This remains a screening result and requires confirmation.'
   };
   el('class-explanation').textContent = explanations[label] || '';
  }
  updateNotes();
 }
 const observer = new MutationObserver(updateView);
 ['preview','camera-video','camera-panel','result'].forEach(id=>observer.observe(el(id),{attributes:true,attributeFilter:['hidden','src']}));
 ['predict','prediction-name','top-score','file-name'].forEach(id=>observer.observe(el(id),{childList:true,characterData:true,subtree:true}));
 el('clock').textContent = new Date().toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});
 updateView();
})();


