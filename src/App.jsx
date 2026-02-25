import React, { useState } from 'react';
import { useThreeScene } from './useThreeScene';

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

  // Logarithmic Speed: v = (x^2) * 0.25 for extreme slow-motion control
  const getMappedSpeed = (val) => Math.pow(val, 2) * 0.25;

  const { mountRef } = useThreeScene({
    text,
    mode,
    seed,
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
    fontFamily
  });

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
