'use strict';
// Receive-only WHEP adapter: no microphone, local webcam or flight-control access.
class WHEPCamera {
 constructor(endpoint,token='') {
  let url;try{url=new URL(endpoint);}catch{throw new Error('Enter a valid HTTPS WHEP stream URL.');}
  const localHTTP=url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname) && location.protocol==='http:';
  if((url.protocol!=='https:'&&!localHTTP)||url.username||url.password||url.hash)throw new Error('Use an HTTPS WHEP URL without embedded credentials.');
  this.url=url;this.token=token;this.closed=false;this.controller=new AbortController();
 }
 headers(extra={}) {return {...extra,...(this.token?{Authorization:`Bearer ${this.token}`}:{})};}
 async removeSession(url) {
  if(!url)return;
  // Never forward adapter credentials to a different origin.
  if(url.origin!==this.url.origin)return;
  try {await fetch(url.href,{method:'DELETE',headers:this.headers(),credentials:'omit',redirect:'error',keepalive:true});}catch{}
 }
 async connect(onLost) {
  if(typeof RTCPeerConnection==='undefined')throw new Error('WebRTC is unavailable in this browser.');
  const pc=this.pc=new RTCPeerConnection({iceServers:[]});
  const stream=new MediaStream();this.stream=stream;
  const trackPromise=new Promise((resolve,reject)=>{
   this.rejectTrack=reject;
   pc.ontrack=e=>{if(this.closed){e.track.stop();return;}if(e.track.kind==='video'){stream.addTrack(e.track);resolve(stream);}};
  });
  // Attach a handler immediately because cancellation can happen during signaling.
  trackPromise.catch(()=>{});
  pc.onconnectionstatechange=()=>{if(!this.closed&&['failed','disconnected','closed'].includes(pc.connectionState))onLost();};
  pc.addTransceiver('video',{direction:'recvonly'});
  this.timeout=setTimeout(()=>this.close(),18000);
  try {
   await pc.setLocalDescription(await pc.createOffer());
   await new Promise((resolve,reject)=>{
    if(pc.iceGatheringState==='complete')return resolve();
    const end=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);this.controller.signal.removeEventListener('abort',aborted);};
    const changed=()=>{if(pc.iceGatheringState==='complete'){end();resolve();}};
    const aborted=()=>{end();reject(new Error('Drone connection cancelled or timed out.'));};
    const timer=setTimeout(()=>{end();reject(new Error('Could not gather connection candidates.'));},7000);
    pc.addEventListener('icegatheringstatechange',changed);this.controller.signal.addEventListener('abort',aborted,{once:true});
    if(this.controller.signal.aborted)aborted();
   });
   if(this.closed)throw new Error('Drone connection cancelled.');
   const response=await fetch(this.url.href,{method:'POST',headers:this.headers({'Content-Type':'application/sdp',Accept:'application/sdp'}),body:pc.localDescription.sdp,signal:this.controller.signal,credentials:'omit',redirect:'error'});
   if(response.status!==201)throw new Error(`Drone adapter rejected the connection (HTTP ${response.status}). Check the endpoint, access token and running video source.`);
   const resource=response.headers.get('Location');
   if(resource){const u=new URL(resource,this.url);if(u.origin===this.url.origin)this.resource=u;}
   if(this.closed){await this.removeSession(this.resource);throw new Error('Drone connection cancelled.');}
   if(!response.headers.get('Content-Type')?.includes('application/sdp'))throw new Error('The URL is not a compatible WHEP endpoint.');
   await pc.setRemoteDescription({type:'answer',sdp:await response.text()});
   const result=await trackPromise;clearTimeout(this.timeout);return result;
  }catch(e){this.close();if(e.name==='AbortError')throw new Error('Drone connection cancelled or timed out.');if(e instanceof TypeError)throw new Error('Cannot reach the drone adapter. Check HTTPS, CORS, browser network permission and the adapter address.');throw e;}
 }
 close() {
  if(this.closed)return;this.closed=true;clearTimeout(this.timeout);this.controller.abort();
  this.rejectTrack?.(new Error('Drone connection cancelled or timed out.'));
  this.pc?.close();this.stream?.getTracks().forEach(t=>t.stop());
  void this.removeSession(this.resource);
 }
}
