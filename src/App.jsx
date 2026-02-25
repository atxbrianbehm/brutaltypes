import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

// --- Simple Deterministic Noise for Fractal Seed ---
const hashNoise = (x, y, z, seed) => {
  const p = (x * 12.9898 + y * 78.233 + z * 43.123 + seed * 91.432);
  const q = (z * 13.1313 + x * 93.939 + y * 17.171);
  return (Math.sin(p + q) * 43758.5453) % 1;
};

// Discrete steps for posterization (FPS)
const POSTERIZE_STEPS = [1, 2, 4, 6, 8, 12, 18, 24, 30, 60];

const App = () => {
  // --- UI & Scene State ---
  const [text, setText] = useState('DESIGNED SYSTEM');
  const [showUI, setShowUI] = useState(true);
  const [mode, setMode] = useState('dials');

  const [seed, setSeed] = useState(123);

  // --- Animation Controllers ---
  const [rawSpeed, setRawSpeed] = useState(1.4);

  const [phase, setPhase] = useState(0.12);
  const [depth, setDepth] = useState(0.20);
  const [rotSpeed, setRotSpeed] = useState(0.0);

  const [posterizeIdx, setPosterizeIdx] = useState(POSTERIZE_STEPS.length - 1);

  // --- Color & Font Controllers ---
  const [accentColor, setAccentColor] = useState('#00ffff');
  const [isColorEnabled, setIsColorEnabled] = useState(true);
  const [fontFamily, setFontFamily] = useState('ui-sans-serif, system-ui, sans-serif');
  const [isFontLoading, setIsFontLoading] = useState(false);

  // --- Toggles ---
  const [isSpeedEnabled, setIsSpeedEnabled] = useState(true);
  const [isRotationEnabled, setIsRotationEnabled] = useState(true);
  const [isWanderEnabled, setIsWanderEnabled] = useState(true);

  const mountRef = useRef(null);
  const sceneRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    blocks: [],
    group: null,
    wanderLight: null,
    clock: new THREE.Clock(),
    texCache: new Map()
  });

  // Logarithmic Speed: v = (x^2) * 0.25 for extreme slow-motion control
  const getMappedSpeed = (val) => Math.pow(val, 2) * 0.25;

  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = {
      speed: getMappedSpeed(rawSpeed),
      phase,
      depth,
      rotSpeed,
      posterize: POSTERIZE_STEPS[posterizeIdx],
      accentColor,
      isColorEnabled,
      isSpeedEnabled,
      isRotationEnabled,
      isWanderEnabled,
      mode,
      seed
    };
  }, [rawSpeed, phase, depth, rotSpeed, posterizeIdx, accentColor, isColorEnabled, isSpeedEnabled, isRotationEnabled, isWanderEnabled, mode, seed]);

  const createEnvMap = () => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0b0e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const brightness = 35 + Math.random() * 25;
        ctx.fillStyle = `rgb(${brightness}, ${brightness + 2}, ${brightness + 4})`;
        ctx.fillRect(i * 16 + 1, j * 16 + 1, 14, 14);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  };

  const getRingTex = (content) => {
    const { texCache } = sceneRef.current;
    const key = `ring-final-${content}-${fontFamily}`;
    if (texCache.has(key)) return texCache.get(key);

    const canvas = document.createElement('canvas');
    const h = 512;
    const ctx = canvas.getContext('2d');
    const fontStr = `900 500px ${fontFamily}`;
    ctx.font = fontStr;
    const displayStr = (content || " ").toUpperCase();
    const metrics = ctx.measureText(displayStr);
    const w = Math.ceil(metrics.width);

    canvas.width = w; canvas.height = h;

    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = "-12px";
    ctx.fillText(displayStr, w / 2, h / 2 + 45);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.userData = { aspect: w / h };
    texCache.set(key, tex);
    return tex;
  };

  const getCharTex = (char) => {
    const { texCache } = sceneRef.current;
    const charKey = `char-final-${char.toUpperCase()}-${fontFamily}`;
    if (texCache.has(charKey)) return texCache.get(charKey);

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f1115'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 160px ${fontFamily}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(char.toUpperCase(), 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    texCache.set(charKey, tex);
    return tex;
  };

  const initGrid = () => {
    const { group, blocks } = sceneRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const obj = group.children[0];
      obj.geometry.dispose();
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
      group.remove(obj);
    }
    blocks.length = 0;

    const aspect = window.innerWidth / window.innerHeight;
    const ringTex = getRingTex(text);
    const isRingMode = mode === 'dials' || mode === 'pulsing' || mode === 'z-ripple' || mode === 'spiral-wrap';
    const currentEmissiveColor = isColorEnabled ? new THREE.Color(accentColor) : new THREE.Color(0x000000);

    if (mode === 'spiral-wrap') {
      const turns = 10;
      const height = 0.5;
      const hairlineGap = 0.01;
      const pitch = height + hairlineGap;
      const k = pitch / (Math.PI * 2);
      const segments = turns * 128;
      const geometry = new THREE.PlaneGeometry(turns * Math.PI * 2, height, segments, 1);
      const pos = geometry.attributes.position;
      const uvs = geometry.attributes.uv;

      let totalArcLength = 0;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * (turns * Math.PI * 2);
        const r = k * theta + 0.6;
        const deltaTheta = (turns * Math.PI * 2) / segments;
        totalArcLength += Math.sqrt(r * r + k * k) * deltaTheta;
      }
      const uRepeat = totalArcLength / (height * ringTex.userData.aspect);

      for (let i = 0; i < pos.count; i++) {
        const x_flat = pos.getX(i) + (turns * Math.PI);
        const y_flat = pos.getY(i);
        const theta = x_flat;
        const r = k * theta + 0.6 + y_flat;
        pos.setXY(i, r * Math.cos(-theta), r * Math.sin(-theta));
        const u = (x_flat / (turns * Math.PI * 2)) * uRepeat;
        const v = (y_flat + height / 2) / height;
        uvs.setXY(i, u, v);
      }
      geometry.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        map: ringTex, metalnessMap: ringTex, roughness: 0.08, metalness: 0.9,
        envMapIntensity: 1.8, side: THREE.DoubleSide, transparent: true,
        emissive: currentEmissiveColor, emissiveIntensity: 0
      });
      const mesh = new THREE.Mesh(geometry, mat);
      group.add(mesh);
      blocks.push({ mesh, type: 'spiral' });

    } else if (isRingMode) {
      const ringCount = aspect < 1 ? 10 : 16;
      const ringHeight = 0.5;
      const ringGap = 0.51;
      for (let r = 1; r <= ringCount; r++) {
        const radius = r * ringGap;
        const geom = new THREE.PlaneGeometry(Math.PI * 2, ringHeight, 128, 1);
        const pos = geom.attributes.position;
        const uvs = geom.attributes.uv;
        const circum = 2 * Math.PI * radius;
        const uRepeat = circum / (ringHeight * ringTex.userData.aspect);

        for (let i = 0; i < pos.count; i++) {
          const x_flat = pos.getX(i);
          const y_flat = pos.getY(i);
          const theta = x_flat;
          const rad = radius + y_flat;
          pos.setXY(i, rad * Math.cos(-theta), rad * Math.sin(-theta));
          const u = 1.0 - ((x_flat + Math.PI) / (Math.PI * 2)) * uRepeat;
          const v = (y_flat + ringHeight / 2) / ringHeight;
          uvs.setXY(i, u, v);
        }
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          map: ringTex, metalnessMap: ringTex, roughness: 0.08, metalness: 0.9,
          envMapIntensity: 1.8, side: THREE.DoubleSide, transparent: true,
          emissive: currentEmissiveColor, emissiveIntensity: 0
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.z = r * -0.01;
        group.add(mesh);
        blocks.push({ mesh, ringIndex: r, type: 'tube' });
      }

    } else {
      const spacing = 0.55;
      const cols = aspect < 1 ? 6 : 14;
      const rows = aspect < 1 ? 10 : 8;

      const geom = mode === 'radial'
        ? new THREE.CylinderGeometry(0.25, 0.25, 0.5, 32)
        : new THREE.BoxGeometry(0.5, 0.5, 0.5);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const char = (text.length > 0 ? text : ' ')[(r * cols + c) % text.length];
          const tex = getCharTex(char);
          const mat = new THREE.MeshStandardMaterial({
            map: tex, metalnessMap: tex, roughness: 0.12, metalness: 0.95, envMapIntensity: 1.2,
            emissive: currentEmissiveColor, emissiveIntensity: 0
          });
          const mesh = new THREE.Mesh(geom, mat);
          const x = (c - cols / 2 + 0.5) * spacing;
          const y = (rows / 2 - r - 0.5) * spacing;
          mesh.position.set(x, y, 0);
          if (mode === 'radial') mesh.rotation.x = Math.PI / 2;
          group.add(mesh);
          blocks.push({
            mesh,
            r,
            c,
            index: r * cols + c,
            baseX: x,
            baseY: y,
            dist: Math.sqrt(x * x + y * y),
            type: 'block'
          });
        }
      }
    }
  };

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0b0e);
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 10;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    scene.environment = createEnvMap();
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const wanderLight = new THREE.PointLight(0xffffff, 0.6, 80);
    scene.add(wanderLight);

    const group = new THREE.Group();
    scene.add(group);

    sceneRef.current = { ...sceneRef.current, scene, camera, renderer, group, wanderLight };

    initGrid();

    let frameId;
    const animate = () => {
      const { renderer, scene, camera, blocks, clock, wanderLight } = sceneRef.current;
      const t = clock.getElapsedTime();
      const s = stateRef.current;
      const st = s.posterize >= 60 ? t : Math.floor(t * s.posterize) / s.posterize;

      if (s.isWanderEnabled && s.isColorEnabled) {
        const wanderSpeed = st * 0.06;
        wanderLight.color.set(s.accentColor);
        wanderLight.position.set(Math.sin(wanderSpeed) * 18, Math.cos(wanderSpeed * 0.5) * 15, 8);
        wanderLight.intensity = 0.6 + Math.sin(st * 0.1) * 0.2;
      } else if (s.isWanderEnabled) {
        wanderLight.color.set(0xffffff);
        wanderLight.intensity = 0.3;
      } else {
        wanderLight.intensity = 0;
      }

      blocks.forEach((b) => {
        let glow = 0;
        if (b.type === 'spiral') {
          if (s.isRotationEnabled) b.mesh.rotation.z = st * s.rotSpeed;
          if (s.isSpeedEnabled) {
            b.mesh.material.map.offset.x = -(st * s.speed * 0.5);
            b.mesh.material.metalnessMap.offset.x = -(st * s.speed * 0.5);
          }
          glow = 0.5 + Math.sin(st * s.speed) * 0.5;
        }
        else if (b.type === 'tube') {
          const direction = b.ringIndex % 2 === 0 ? 1 : -1;
          if (s.mode === 'pulsing') {
            const osc = Math.sin(st * s.speed + b.ringIndex * s.phase * 4);
            if (s.isRotationEnabled) b.mesh.rotation.z = osc * s.rotSpeed * 2 * direction;
            b.mesh.position.z = (b.ringIndex * -0.01) + osc * 0.2;
            glow = Math.max(0, osc);
          } else if (s.mode === 'z-ripple') {
            const ringSpeedFactor = 1.0 / (1 + b.ringIndex * 0.35);
            if (s.isRotationEnabled) b.mesh.rotation.z = st * s.rotSpeed * direction * ringSpeedFactor;
            const wave = Math.sin(st * s.speed + b.ringIndex * s.phase * 6);
            b.mesh.position.z = (b.ringIndex * -0.01) + (wave * 0.4);
            glow = wave;
          } else {
            const ringSpeedFactor = 1.0 / (1 + b.ringIndex * 0.35);
            if (s.isRotationEnabled) b.mesh.rotation.z = st * s.rotSpeed * direction * ringSpeedFactor;
            const wave = Math.sin(st * s.speed + b.ringIndex * s.phase * 5);
            b.mesh.position.z = (b.ringIndex * -0.01) + wave * 0.12;
            glow = wave;
          }
        } else {
          b.mesh.rotation.set(s.mode === 'radial' ? Math.PI / 2 : 0, 0, 0);
          b.mesh.position.set(b.baseX, b.baseY, 0);
          b.mesh.scale.set(1, 1, 1);

          switch (s.mode) {
            case 'fractal': {
              const n = hashNoise(b.r, b.c, Math.floor(st * s.speed), s.seed);
              b.mesh.position.z = n * s.depth * 4;
              if (s.isRotationEnabled) b.mesh.rotation.x = st * s.rotSpeed + n;
              glow = n;
              break;
            }
            case 'ticker': {
              const rowDir = b.r % 2 === 0 ? 1 : -1;
              const xShift = (st * s.speed + b.c * s.phase) * rowDir;
              b.mesh.position.x = b.baseX + (xShift % 0.5);
              glow = Math.sin(st * s.speed + b.c);
              break;
            }
            case 'matrix': {
              const drop = (Math.floor(st * s.speed * 2 + b.c * 10) % 20) * 0.1;
              b.mesh.position.y = b.baseY - drop;
              glow = 1 - drop;
              break;
            }
            case 'horizontal': {
              b.mesh.position.z = Math.sin(st * s.speed + b.index * s.phase) * 0.15;
              if (s.isRotationEnabled) b.mesh.rotation.y = (st * s.rotSpeed) + (b.index * 0.1);
              break;
            }
            case 'snake': {
              const sn = Math.sin(st * s.speed + b.index * s.phase);
              b.mesh.position.z = sn * 0.35;
              if (s.isRotationEnabled) b.mesh.rotation.x = st * s.rotSpeed + b.index * s.phase;
              glow = sn;
              break;
            }
            case 'radial': {
              const rd = Math.sin(st * s.speed * 2 - b.dist * s.phase * 10);
              b.mesh.position.z = rd * 0.25;
              glow = rd;
              break;
            }
          }
        }

        b.mesh.material.emissiveIntensity = (s.isSpeedEnabled && s.isColorEnabled)
          ? Math.pow(Math.max(0, glow), 2) * 0.25
          : 0;

        if (b.type === 'block') {
          b.mesh.scale.set(1, 1, 1 + s.depth * 8);
        }
      });

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      initGrid();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const { texCache } = sceneRef.current;
    texCache.clear();
    initGrid();
  }, [text, mode, accentColor, isColorEnabled, fontFamily]);

  const handleFontUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFontLoading(true);
    try {
      const fontName = `CustomFont-${Date.now()}`;
      const fontData = await file.arrayBuffer();
      const fontFace = new FontFace(fontName, fontData);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);
      setFontFamily(fontName);
    } catch (err) { console.error(err); }
    finally { setIsFontLoading(false); }
  };

  const handleRotChange = (val) => {
    if (Math.abs(val) < 0.2) setRotSpeed(0);
    else setRotSpeed(val);
  };

  const modes = [
    { id: 'dials', label: 'Circle: Concentric Tubes' },
    { id: 'z-ripple', label: 'Circle: Z-Ripple Tubes' },
    { id: 'pulsing', label: 'Circle: Pulsing Tubes' },
    { id: 'spiral-wrap', label: 'Circle: Infinite Spiral' },
    { id: 'radial', label: 'Circle: Radial Wave' },
    { id: 'horizontal', label: '3D Horizontal Twist' },
    { id: 'ticker', label: '2D Ticker Tape' },
    { id: 'matrix', label: '2D Column March' },
    { id: 'fractal', label: '3D Fractal Noise' },
    { id: 'snake', label: '3D Tumble Snake' },
  ];

  return (
    <div className="relative w-full h-screen bg-[#0a0b0e] overflow-hidden text-white font-sans">
      <div ref={mountRef} className="absolute inset-0" />

      <div className={`absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50 transition-all ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-3">
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer hover:bg-white/10">
            {modes.map(m => <option key={m.id} value={m.id} className="bg-[#0b0c10]">{m.label}</option>)}
          </select>
          <div className="text-[10px] font-black text-teal-400 pr-4 tracking-tighter uppercase">Scene</div>
        </div>
      </div>

      <button onClick={() => setShowUI(!showUI)} className="absolute top-4 right-4 z-50 bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-full text-xs font-bold active:scale-90 transition-transform shadow-2xl">{showUI ? '✕' : '⚙'}</button>

      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md bg-black/75 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-7 transition-all duration-500 z-40 ${showUI ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}`}>
        <div className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="bg-transparent text-xl font-black uppercase tracking-[0.2em] focus:outline-none w-full" />
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors">
                <span className="text-[9px] font-black uppercase tracking-widest text-teal-400">{isFontLoading ? 'Loading Type...' : 'Upload Font (.otf)'}</span>
                <input type="file" accept=".otf,.ttf" onChange={handleFontUpload} className="hidden" />
              </label>
              {mode === 'fractal' && (
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-white/40 uppercase font-bold">Seed</span>
                  <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value))} className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] w-12 text-teal-400 font-mono" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase text-white/40">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isSpeedEnabled} onChange={() => setIsSpeedEnabled(!isSpeedEnabled)} className="w-3 h-3 accent-teal-400" />
                    <span>Speed</span>
                  </div>
                  <span className="text-teal-400">{getMappedSpeed(rawSpeed).toFixed(3)}</span>
                </div>
                <input type="range" min="0" max="4" step="0.01" value={rawSpeed} onChange={(e) => setRawSpeed(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-teal-400" disabled={!isSpeedEnabled} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase text-white/40">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isRotationEnabled} onChange={() => setIsRotationEnabled(!isRotationEnabled)} className="w-3 h-3 accent-teal-400" />
                    <span>Rotation</span>
                  </div>
                  <span className={rotSpeed === 0 ? "text-teal-400" : "text-white/40"}>{rotSpeed === 0 ? "STOP" : rotSpeed.toFixed(2)}</span>
                </div>
                <input type="range" min="-4" max="4" step="0.01" value={rotSpeed} onChange={(e) => handleRotChange(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-teal-400" disabled={!isRotationEnabled} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase text-white/40">
                  <span>Posterize</span>
                  <span className="text-teal-400">{POSTERIZE_STEPS[posterizeIdx] >= 60 ? 'Smooth' : POSTERIZE_STEPS[posterizeIdx] + ' fps'}</span>
                </div>
                <input type="range" min="0" max={POSTERIZE_STEPS.length - 1} step="1" value={posterizeIdx} onChange={(e) => setPosterizeIdx(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-teal-400" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase text-white/40">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isColorEnabled} onChange={() => setIsColorEnabled(!isColorEnabled)} className="w-3 h-3 accent-teal-400" />
                    <span>Accent Color</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-5 bg-transparent border-none cursor-pointer" disabled={!isColorEnabled} />
                  <span className="text-[9px] font-mono text-white/40 uppercase">{isColorEnabled ? accentColor : 'OFF'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-white/40">Phase Offset</label>
                <input type="range" min="0" max="1" step="0.01" value={phase} onChange={(e) => setPhase(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-teal-400" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase text-white/40">Extrusion</label>
                <input type="range" min="0" max="1" step="0.01" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value))} className="w-full h-1 bg-white/10 rounded-lg appearance-none accent-teal-400" />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
