let scene, camera, renderer, blackHole, gasStreamlines, lensedTop, lensedBottom, stars, gridGroup;
let orbitSpeed = 0.003, gasIntensity = 2.8, bhSize = 42, bhMass = 100, time = 0;
let clockAngle = 0, cameraAngle = 0, zoomDist = 400, raysVisible = true, gasVisible = true;
let realRays = [], lastTime = 0, deltaTime = 0, flowOffset = 0;
let targetClockSpeed = 1, currentClockSpeed = 1, singularityReached = false, singularityTime = 0;

// === SIMPLE TIME DIAL (No numbers, just rotating hand) ===
let baseTimeAngle = 0; // Always ticking base time

function getTimeDilation(distance) {
  const schwarzschildRadius = bhSize * 1.48;
  let rNorm = Math.max(distance / schwarzschildRadius, 1.01);
  const dilation = 1 / Math.sqrt(1 - 2/rNorm);
  return Math.min(dilation, 100);
}

// Replace ONLY this function - BULLETPROOF SMOOTH ROTATION:

// Global variables (add these at top with other globals):
let dialAngle = 0;          // current angle of the hand
let baseDialSpeed = 2.0;   // base speed (radians per second)


// === PERFECTLY SMOOTH CLOCK - ALWAYS RESTARTS ===
function updateTimeDial(delta) {
  const hand = document.getElementById('hand');
  const dial = document.getElementById('clock');
  if (!hand || !dial || !camera || !blackHole) return;

  // 1. Measure distance from camera to black hole
  const distance = camera.position.distanceTo(blackHole.position);

  // 2. Compute a smooth time factor based only on distance
  const r_s = bhSize * 1.5;       // "event horizon scale"
  const minFactor = 0.02;         // 2% of normal speed (never zero)
  const maxFactor = 1.0;          // 100% speed far away
  const farDist  = r_s * 5;       // where time is basically normal again

  // Clamp distance into [r_s, farDist]
  const dClamped = Math.max(r_s, Math.min(distance, farDist));
  // t = 0 near horizon, 1 far away
  const t = (dClamped - r_s) / (farDist - r_s);

  // Ease (smoothstep) so change feels smooth
  const smoothT = t * t * (3 - 2 * t);

  // Time factor between minFactor (near BH) and maxFactor (far)
  const timeFactor = minFactor + (maxFactor - minFactor) * smoothT;

  // 3. Always increase angle clockwise, scaled by timeFactor
  dialAngle += baseDialSpeed * timeFactor * delta;

  // 4. Apply rotation (no modulo; CSS handles large angles fine)
  hand.style.transform = `rotate(${dialAngle}rad)`;

  // 5. Optional: visual feedback – more glow when time is slower
  const glow = 10 + (1 - timeFactor) * 40;
  dial.style.boxShadow = `0 0 ${glow}px #ffaa44`;


}



// === SINGULARITY BLACKOUT + MESSAGE ===
function updateStory(distance) {
  const eventHorizon = bhSize * 1.48;
  const singularityDist = bhSize * 0.15;
  
  const storyPanel = document.getElementById('storyPanel');
  const title = document.getElementById('storyTitle');
  const text = document.getElementById('storyText');
  const display = document.getElementById('zoomDisplay');
  
  if(!storyPanel || !title || !text || !display) return;
  
  display.textContent = `Distance: ${Math.round(distance)}m`;
  
  if(distance < singularityDist && !singularityReached) {
    // TRIGGER SINGULARITY
    singularityReached = true;
    singularityTime = time;
    
    // INSTANT BLACK SCREEN
    document.body.style.background = '#000000';
    renderer.domElement.style.opacity = '0.1';
    
    title.textContent = '💀 POINT OF NO RETURN';
    text.innerHTML = `
      <strong>YOU CROSSED THE EVENT HORIZON</strong><br>
      • No escape possible<br>
      • External observers see you frozen forever<br>
      • Spaghettification begins<br>
      • Singularity consumes all information<br>
      <br><small>Slide LEFT to escape</small>
    `;
    storyPanel.style.background = 'radial-gradient(circle, rgba(255,50,50,0.8), rgba(0,0,0,1))';
    storyPanel.style.boxShadow = '0 0 50px #ff0000';
    storyPanel.style.zIndex = '1000';
    
  } else if(singularityReached && time - singularityTime < 3) {
    // SINGULARITY HOLD
    title.textContent = '💀 INEVITABLE DOOM';
    text.innerHTML = 'Tidal forces stretch you infinitely. All physics breaks down.';
    
  } else if(distance < eventHorizon * 1.2) {
    title.textContent = '⚠️ EVENT HORIZON';
    text.innerHTML = 'Point of no return! Clock nearly frozen. External observers see you frozen forever. Prepare to cross...';
    storyPanel.style.background = 'radial-gradient(circle, rgba(255,100,0,0.4), rgba(0,0,20,0.95))';
    storyPanel.style.boxShadow = '0 0 25px #ff8800';
    storyPanel.style.zIndex = '10';
    renderer.domElement.style.opacity = '0.3';
    
  } else if(distance < eventHorizon * 2) {
    title.textContent = '🔴 Approaching Horizon';
    text.innerHTML = `Time dilation: ${(1/currentClockSpeed).toFixed(0)}x slower. Event horizon at ${Math.round(eventHorizon)}m.`;
    storyPanel.style.background = 'radial-gradient(circle, rgba(255,170,0,0.3), rgba(0,0,20,0.95))';
    storyPanel.style.boxShadow = '0 0 20px #ffaa44';
    renderer.domElement.style.opacity = '0.7';
    
  } else {
    // SAFE - RESET EVERYTHING
    singularityReached = false;
    singularityTime = 0;
    title.textContent = '🛸 Safe Orbit';
    text.innerHTML = `Orbiting safely. Time normal (${currentClockSpeed.toFixed(1)}x). Slide RIGHT to approach singularity.`;
    storyPanel.style.background = 'rgba(0,0,20,0.9)';
    storyPanel.style.boxShadow = '0 0 15px #ffaa44';
    storyPanel.style.zIndex = '10';
    document.body.style.background = 'radial-gradient(ellipse at center, #000011 0%, #000000 70%)';
    renderer.domElement.style.opacity = '1';
  }
}

// === GENTLE FLOWING GAS ===
function createFlowingGasDisk() {
  if(gasStreamlines) {
    scene.remove(gasStreamlines);
    if(lensedTop) scene.remove(lensedTop);
    if(lensedBottom) scene.remove(lensedBottom);
  }
  
  gasStreamlines = new THREE.Group();
  for(let i = 0; i < 800; i++) {
    gasStreamlines.add(createAnimatedGasStream(i));
  }
  scene.add(gasStreamlines);
  
  lensedTop = gasStreamlines.clone();
  lensedTop.rotation.x = -0.28; lensedTop.position.y = bhSize * 0.32; lensedTop.scale.setScalar(0.82);
  scene.add(lensedTop);
  
  lensedBottom = gasStreamlines.clone();
  lensedBottom.rotation.x = 0.28; lensedBottom.position.y = -bhSize * 0.32; lensedBottom.scale.setScalar(0.82);
  scene.add(lensedBottom);
}

function createAnimatedGasStream(i) {
  const points = [], baseAngle = i * (Math.PI * 2 / 800), startRadius = bhSize * (2.2 + Math.random() * 6 * gasIntensity), segments = 35;
  for(let j = 0; j <= segments; j++) {
    const t = j / segments, radius = startRadius * (1 - t * 0.92), angle = baseAngle + t * Math.PI * 5.2;
    const height = Math.sin(angle * 4 + i * 0.01) * bhSize * 0.22 * gasIntensity;
    points.push(new THREE.Vector3(radius * Math.cos(angle), height, radius * Math.sin(angle)));
  }
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0xff4400, transparent: true, opacity: 0.85, linewidth: 2.8, blending: THREE.AdditiveBlending
  }));
}

function updateFlowingGas(delta) {
  flowOffset += 0.035 * delta * 60;
  
  gasStreamlines.children.forEach((line, i) => {
    const positions = line.geometry.attributes.position.array, segments = 35;
    const streamData = { baseAngle: i * (Math.PI * 2 / 800), flowPhase: i * 0.02 };
    
    for(let j = 0; j <= segments; j++) {
      const t = j / segments, progress = (flowOffset * 0.08 + streamData.flowPhase) % 1.0;
      const flowT = (t + progress * 0.035) % 1.0;
      
      const startRadius = bhSize * (2.2 + Math.sin(i * 0.1) * 3 * gasIntensity);
      const radius = startRadius * (1 - flowT * 0.92);
      const angle = streamData.baseAngle + flowT * Math.PI * 5.2 + progress * 0.25;
      const height = Math.sin(angle * 4 + i * 0.01 + progress * 0.35) * bhSize * 0.22 * gasIntensity;
      
      const idx = j * 3;
      positions[idx] = radius * Math.cos(angle);
      positions[idx + 1] = height;
      positions[idx + 2] = radius * Math.sin(angle);
    }
    
    line.geometry.attributes.position.needsUpdate = true;
    
    const brightness = 0.80 + 0.20 * Math.sin(flowOffset * 0.35 + i * 0.15);
    line.material.opacity = brightness * (0.94 + 0.06 * Math.sin(flowOffset * 0.25 + i * 0.1));
    line.material.linewidth = 2.7 + 0.3 * Math.sin(flowOffset * 0.18 + i * 0.08);
    line.material.needsUpdate = true;
  });
  
  [lensedTop, lensedBottom].forEach(disk => {
    if(disk) disk.children.forEach((line, i) => {
      line.material.opacity = 0.70 + 0.16 * Math.sin(flowOffset * 0.32 + i * 0.12);
      line.material.needsUpdate = true;
    });
  });
}

// === CONTROLS ===
function setupControls() {
  const zoomSlider = document.getElementById('zoomSlider');
  if(zoomSlider) {
    zoomSlider.oninput = e => {
      zoomDist = 850 - parseFloat(e.target.value);
      updateCamera();
    };
  }
  
  document.getElementById('orbitSpeed').oninput = e => orbitSpeed = parseFloat(e.target.value);
  document.getElementById('gasIntensity').oninput = e => {
    gasIntensity = parseFloat(e.target.value);
    createFlowingGasDisk();
  };
  document.getElementById('bhSize').oninput = e => {
    bhSize = parseFloat(e.target.value);
    bhMass = 8 + (bhSize - 25) * 1.8;
    createBlackHole();
    createFlowingGasDisk();
    createPhotonRays();
    document.getElementById('massDisplay').textContent = `${Math.round(bhMass)}M☉`;
  };
}

// === INIT ===
function init() {
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x000011);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000);
  camera.position.set(0, 0, 400);
  
  renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: "high-performance"});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);
  
  scene.add(new THREE.AmbientLight(0x444488, 0.7), new THREE.PointLight(0xff8800, 6, 1000));
  
  createStars(); createGrid(); createBlackHole(); createFlowingGasDisk(); createPhotonRays();
  setupControls(); window.addEventListener('resize', onWindowResize);
  animate(0);
}

// === ANIMATE ===
function animate(currentTime) {
  requestAnimationFrame(animate);
  deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
  lastTime = currentTime; time += deltaTime;
  
 updateTimeDial(deltaTime);
  if(!singularityReached) updateFlowingGas(deltaTime);
  
  if(stars && stars.geometry) {
    const starPos = stars.geometry.attributes.position;
    for(let i = 0; i < starPos.count * 3; i += 3) {
      starPos.array[i+2] += 1.5 * deltaTime * 60;
      if(starPos.array[i+2] > 4000) starPos.array[i+2] = -4000;
    }
    starPos.needsUpdate = true;
  }
  
  if(raysVisible) realRays.forEach((ray, i) => ray.rotation.y += (0.025 + i * 0.0002) * deltaTime * 60);
  
  if(gridGroup) {
    const dist = camera.position.distanceTo(blackHole.position);
    gridGroup.rotation.y += Math.max(0, 1 - dist / 300) * 0.05 * deltaTime * 60;
  }
  
  updateCamera();
  renderer.render(scene, camera);
}

// === ALL OTHER FUNCTIONS ===
function updateCamera() {
  cameraAngle += orbitSpeed;
  camera.position.set(Math.cos(cameraAngle) * 60, Math.sin(cameraAngle * 0.7) * 25, zoomDist);
  camera.lookAt(0, 0, 0);
  document.getElementById('zoomDisplay').textContent = `Distance: ${Math.round(zoomDist)}m`;
}

function createStars() {
  const starGeo = new THREE.BufferGeometry(), positions = new Float32Array(15000 * 3);
  for(let i = 0; i < 15000; i++) {
    positions[i*3] = (Math.random() - 0.5) * 8000;
    positions[i*3+1] = (Math.random() - 0.5) * 8000;
    positions[i*3+2] = (Math.random() - 0.5) * 8000;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1.2, sizeAttenuation: true}));
  scene.add(stars);
}

function createGrid() {
  gridGroup = new THREE.Group();
  const size = 800, divs = 15, mat = new THREE.LineBasicMaterial({color: 0x6666ff, transparent: true, opacity: 0.25});
  for(let i = -size/2; i <= size/2; i += size/divs) {
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0, -size/2), new THREE.Vector3(i, 0, size/2)]), mat));
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-size/2, 0, i), new THREE.Vector3(size/2, 0, i)]), mat));
  }
  gridGroup.rotation.x = Math.PI / 2; scene.add(gridGroup);
}

function createBlackHole() {
  if(blackHole) scene.remove(blackHole);
  blackHole = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshBasicMaterial({color: 0x000000}));
  blackHole.scale.setScalar(bhSize); scene.add(blackHole);
  if(document.getElementById('massDisplay')) {
    document.getElementById('massDisplay').textContent = `${Math.round(bhMass)}M☉`;
  }
}

function createPhotonRays() {
  realRays.forEach(ray => scene.remove(ray)); realRays = [];
  for(let i = 0; i < 150; i++) {
    const points = [], startR = bhSize * 2.8;
    for(let j = 0; j <= 50; j++) {
      const t = j / 50, r = startR * (1 - t * 0.88), angle = i * (Math.PI * 2 / 150) + t * Math.PI * 4.8;
      points.push(new THREE.Vector3(r * Math.cos(angle), Math.sin(angle * 2.5) * bhSize * 0.15, r * Math.sin(angle)));
    }
    const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.7}));
    scene.add(ray); realRays.push(ray);
  }
}

function toggleRays() { raysVisible = !raysVisible; realRays.forEach(ray => ray.visible = raysVisible); }
function toggleGas() { gasVisible = !gasVisible; [gasStreamlines, lensedTop, lensedBottom].forEach(d => d.visible = gasVisible); }
function resetView() {
  clockActive = true;
  smoothedDialAngle = 0;  
  zoomDist = 400; 
  orbitSpeed = 0.003; 
  gasIntensity = 2.8; 
  bhSize = 42; 
  bhMass = 100;
  singularityReached = false; 
  singularityTime = 0;
  document.getElementById('zoomSlider').value = 400;
  document.getElementById('gasIntensity').value = 2.8;
  document.getElementById('bhSize').value = 42;
  createBlackHole(); createFlowingGasDisk(); createPhotonRays(); updateCamera();
  document.body.style.background = 'radial-gradient(ellipse at center, #000011 0%, #000000 70%)';
  renderer.domElement.style.opacity = '1';
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
