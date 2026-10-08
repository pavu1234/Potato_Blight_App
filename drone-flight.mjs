import * as THREE from './vendor/three/three.module.js';
const host=document.getElementById('flight-scene'),button=document.getElementById('pause-flight');
try{
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;host.prepend(renderer.domElement);host.classList.add('intro-ready');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(6,4.3,7.4);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xe4ffe2,0x344438,3));const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(3,7,4);scene.add(key);const rim=new THREE.DirectionalLight(0xb4f57e,5);rim.position.set(-5,2,-3);scene.add(rim);
 const drone=new THREE.Group();scene.add(drone);
 const carbon=new THREE.MeshStandardMaterial({color:0x202923,roughness:.43,metalness:.65}),shell=new THREE.MeshStandardMaterial({color:0x647168,roughness:.32,metalness:.72}),metal=new THREE.MeshStandardMaterial({color:0xa8b5af,roughness:.26,metalness:.9}),accent=new THREE.MeshStandardMaterial({color:0xc1ed7d,roughness:.35,metalness:.4}),rubber=new THREE.MeshStandardMaterial({color:0x0b1712,roughness:.75}),glass=new THREE.MeshStandardMaterial({color:0x28475b,metalness:.95,roughness:.12});
 function box(w,h,d,x,y,z,mat,parent=drone){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);parent.add(o);return o;}
 function cyl(r,h,x,y,z,mat,parent=drone){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),mat);o.position.set(x,y,z);parent.add(o);return o;}
 function rod(a,b,r,mat){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,av.distanceTo(bv),12),mat);o.position.copy(av.clone().add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());drone.add(o);return o;}
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),shell);body.scale.set(.72,.25,1);drone.add(body);box(.75,.18,1.3,0,.23,0,carbon);box(.1,.04,1.12,0,.34,0,accent);
 for(let i=0;i<7;i++)box(.58,.025,.035,0,.332,-.43+i*.11,rubber);
 const rotors=[];
 for(const x of [-1,1])for(const z of [-1,1]){
  const px=x*1.5,pz=z*1.35;rod([x*.45,0,z*.65],[px,.12,pz],.075,carbon);rod([x*.5,-.08,z*.57],[px,.02,pz],.035,metal);
  cyl(.18,.25,px,.18,pz,carbon);cyl(.14,.06,px,.33,pz,metal);const rotor=new THREE.Group();rotor.position.set(px,.4,pz);drone.add(rotor);
  for(const angle of [0,Math.PI]){const blade=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),rubber);blade.scale.set(.56,.018,.065);blade.position.x=.48;const g=new THREE.Group();g.rotation.y=angle;g.add(blade);rotor.add(g);}cyl(.065,.075,0,.035,0,metal,rotor);rotors.push(rotor);
  const led=new THREE.MeshStandardMaterial({color:z>0?0xc5f985:0xf87b60,emissive:z>0?0x7aff35:0xff3b22,emissiveIntensity:2});box(.09,.035,.12,px,.01,pz,led);
 }
 for(const x of [-.58,.58]){rod([x,0,-.55],[x*1.3,-.9,-.65],.035,metal);rod([x,0,.55],[x*1.3,-.9,.65],.035,metal);rod([x*1.3,-.9,-1],[x*1.3,-.9,1],.05,carbon);}
 // Camera gimbal and a generic payload enclosure; no claimed real drone model.
 cyl(.12,.3,0,-.35,.55,metal);box(.38,.28,.33,0,-.57,.72,carbon);const lens=cyl(.11,.11,0,-.57,.94,glass);lens.rotation.x=Math.PI/2;
 const tank=new THREE.Mesh(new THREE.BoxGeometry(.65,.44,.62),new THREE.MeshStandardMaterial({color:0x859d80,roughness:.45,metalness:.25}));tank.position.set(0,-.4,-.25);drone.add(tank);box(.68,.045,.1,0,-.55,-.25,carbon);
 const ring=new THREE.Mesh(new THREE.RingGeometry(2.4,2.42,96),new THREE.MeshBasicMaterial({color:0x819f70,transparent:true,opacity:.22,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-1.5;scene.add(ring);
 const grid=new THREE.GridHelper(16,24,0x6a855e,0x405840);grid.position.y=-1.55;grid.material.transparent=true;grid.material.opacity=.12;scene.add(grid);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches,visible=true,raf=0,time=0,last=performance.now();
 function pose(){const enter=paused?1:Math.min(1,time/3.2),ease=1-(1-enter)**3;drone.position.set((1-ease)*5,paused?0:(1-ease)*1.8+Math.sin(time*1.2)*.07,(1-ease)*-4);drone.rotation.set(.04,paused?-.3:-.3+(1-ease)*1.4+Math.sin(time*.3)*.08,paused?0:(1-ease)*-.35+Math.sin(time*.7)*.025);for(let i=0;i<rotors.length;i++)rotors[i].rotation.y=time*35*(i%2?1:-1);}
 function draw(now){raf=0;if(document.hidden||!visible)return;if(!paused)time+=Math.min((now-last)/1000,.05);last=now;pose();renderer.render(scene,camera);if(!paused)raf=requestAnimationFrame(draw);}
 function requestDraw(){if(!raf){last=performance.now();raf=requestAnimationFrame(draw);}}
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();requestDraw();}new ResizeObserver(resize).observe(host);
 button.textContent=paused?'Play animation':'Pause animation';button.addEventListener('click',()=>{paused=!paused;time=Math.max(time,3.2);button.textContent=paused?'Play animation':'Pause animation';requestDraw();});
 reduced.addEventListener('change',e=>{paused=e.matches;button.textContent=paused?'Play animation':'Pause animation';requestDraw();});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();}).observe(host);document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestDraw();});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;host.classList.remove('intro-ready');button.hidden=true;});
 window.addEventListener('pagehide',()=>{if(raf)cancelAnimationFrame(raf);renderer.dispose();});resize();
}catch(error){button.hidden=true;host.classList.remove('intro-ready');console.warn('3D preview unavailable; showing static drone.',error.message);}
