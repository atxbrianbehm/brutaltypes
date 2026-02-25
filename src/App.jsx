import React, { useState } from 'react';
import { useThreeScene } from './useThreeScene';
import { palette } from './palette';

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
  const [accentColor, setAccentColor] = useState(palette.accent);
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
    <div className="relative w-full h-screen overflow-hidden font-sans" style={{ background: palette.bg, color: palette.ink }}>
      <div ref={mountRef} className="absolute inset-0" />

      <div className={`absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-50 transition-all ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="backdrop-blur-xl rounded-2xl p-2 flex items-center gap-3" style={{ background: palette.panel, border: `1px solid ${palette.border}` }}>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="flex-1 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer" style={{ background: palette.controlBg, border: `1px solid ${palette.border}`, color: palette.ink }}>
            {modes.map(m => <option key={m.id} value={m.id} style={{ background: palette.bg, color: palette.ink }}>{m.label}</option>)}
          </select>
          <div className="text-[10px] font-black pr-4 tracking-tighter uppercase" style={{ color: palette.accent }}>Scene</div>
        </div>
      </div>

      <button onClick={() => setShowUI(!showUI)} className="absolute top-4 right-4 z-50 backdrop-blur-md p-3 rounded-full text-xs font-bold active:scale-90 transition-transform shadow-2xl" style={{ background: palette.panel, border: `1px solid ${palette.border}` }}>{showUI ? '✕' : '⚙'}</button>

      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-md backdrop-blur-3xl rounded-[2.5rem] p-7 transition-all duration-500 z-40 ${showUI ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0 pointer-events-none'}`} style={{ background: palette.panel2, border: `1px solid ${palette.border}` }}>
        <div className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} className="bg-transparent text-xl font-black uppercase tracking-[0.2em] focus:outline-none w-full" />
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full transition-colors" style={{ background: palette.controlBg, border: `1px solid ${palette.border}` }}>
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: palette.accent }}>{isFontLoading ? 'Loading Type...' : 'Upload Font (.otf)'}</span>
                <input type="file" accept=".otf,.ttf" onChange={handleFontUpload} className="hidden" />
              </label>
              {mode === 'fractal' && (
                <div className="flex items-center gap-2">
                  <span className="text-[8px] uppercase font-bold" style={{ color: palette.muted }}>Seed</span>
                  <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value))} className="rounded px-2 py-1 text-[10px] w-12 font-mono" style={{ background: palette.controlBg, border: `1px solid ${palette.border}`, color: palette.accent }} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase" style={{ color: palette.muted }}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isSpeedEnabled} onChange={() => setIsSpeedEnabled(!isSpeedEnabled)} className="w-3 h-3" style={{ accentColor: palette.accent }} />
                    <span>Speed</span>
                  </div>
                  <span style={{ color: palette.accent }}>{getMappedSpeed(rawSpeed).toFixed(3)}</span>
                </div>
                <input type="range" min="0" max="4" step="0.01" value={rawSpeed} onChange={(e) => setRawSpeed(parseFloat(e.target.value))} className="w-full h-1 rounded-lg appearance-none" style={{ background: 'rgba(10,11,14,0.16)', accentColor: palette.accent }} disabled={!isSpeedEnabled} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase" style={{ color: palette.muted }}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isRotationEnabled} onChange={() => setIsRotationEnabled(!isRotationEnabled)} className="w-3 h-3" style={{ accentColor: palette.accent }} />
                    <span>Rotation</span>
                  </div>
                  <span style={{ color: rotSpeed === 0 ? palette.accent : palette.muted }}>{rotSpeed === 0 ? "STOP" : rotSpeed.toFixed(2)}</span>
                </div>
                <input type="range" min="-4" max="4" step="0.01" value={rotSpeed} onChange={(e) => handleRotChange(parseFloat(e.target.value))} className="w-full h-1 rounded-lg appearance-none" style={{ background: 'rgba(10,11,14,0.16)', accentColor: palette.accent }} disabled={!isRotationEnabled} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase" style={{ color: palette.muted }}>
                  <span>Posterize</span>
                  <span style={{ color: palette.accent }}>{POSTERIZE_STEPS[posterizeIdx] >= 60 ? 'Smooth' : POSTERIZE_STEPS[posterizeIdx] + ' fps'}</span>
                </div>
                <input type="range" min="0" max={POSTERIZE_STEPS.length - 1} step="1" value={posterizeIdx} onChange={(e) => setPosterizeIdx(parseInt(e.target.value))} className="w-full h-1 rounded-lg appearance-none" style={{ background: 'rgba(10,11,14,0.16)', accentColor: palette.accent }} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[9px] font-bold uppercase" style={{ color: palette.muted }}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isColorEnabled} onChange={() => setIsColorEnabled(!isColorEnabled)} className="w-3 h-3" style={{ accentColor: palette.accent }} />
                    <span>Accent Color</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-5 bg-transparent border-none cursor-pointer" disabled={!isColorEnabled} />
                  <span className="text-[9px] font-mono uppercase" style={{ color: palette.muted }}>{isColorEnabled ? accentColor : 'OFF'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase" style={{ color: palette.muted }}>Phase Offset</label>
                <input type="range" min="0" max="1" step="0.01" value={phase} onChange={(e) => setPhase(parseFloat(e.target.value))} className="w-full h-1 rounded-lg appearance-none" style={{ background: 'rgba(10,11,14,0.16)', accentColor: palette.accent }} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold uppercase" style={{ color: palette.muted }}>Extrusion</label>
                <input type="range" min="0" max="1" step="0.01" value={depth} onChange={(e) => setDepth(parseFloat(e.target.value))} className="w-full h-1 rounded-lg appearance-none" style={{ background: 'rgba(10,11,14,0.16)', accentColor: palette.accent }} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
