import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Activity, Zap, Terminal, Map, Upload, Cpu, AlertCircle, RefreshCw, User, Flame, Volume2, VolumeX, Navigation, Timer, Star, HelpCircle, X } from 'lucide-react';

// --- CONFIGURATION ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

// ENVIRONMENT CONSTRAINT: 
const PRIMARY_MODEL = 'gemini-2.5-flash-preview-09-2025';
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// --- TRAINING DATA 1: COACH TONY RODRIGUEZ ---
const COACH_TONY_SYSTEM_PROMPT = `
ROLE: You are Tony Rodriguez, a high-performance racing coach.
TONE: Colloquial, encouraging, "feel-based".
KEY PHRASES: "Scoot out", "Good hustle", "Commit", "Pop it in", "Don't be a wuss".
PHILOSOPHY:
1. MENTAL CAPACITY: Focus on flow once braking is done.
2. COMMITMENT: Delay throttle, then 100%.
3. CONFIDENCE: Trust the car.
INSTRUCTION:
Analyze telemetry. Give punchy, encouraging advice.
CONSTRAINT: Max 5 words.
Example: "Good hustle, scoot out."
`;

// --- TRAINING DATA 2: COACH RACHEL ---
const COACH_RACHEL_SYSTEM_PROMPT = `
ROLE: Rachel, Technical Physics Coach.
TONE: Calm, analytical, precise.
KEY PHRASES: "End-of-Braking", "Vision", "Smooth inputs", "Balance platform".
PHILOSOPHY:
1. VISION: Look through the corner.
2. BRAKING: Focus on smooth release (EoB).
3. SMOOTHNESS: Unsettled platform = slow.
INSTRUCTION:
Analyze telemetry. Focus on vehicle dynamics.
CONSTRAINT: Max 5 words.
Example: "Smooth release, balance platform."
`;

// --- TRAINING DATA 3: COACH AJ ---
const COACH_AJ_SYSTEM_PROMPT = `
ROLE: Coach AJ, Hybrid Race Engineer.
TONE: Direct, descriptive, actionable.
GOAL: Connect feeling to action.
INSTRUCTION:
Link a vehicle state (Grip, Rotation) to an input (Throttle, Brake).
CONSTRAINT: Max 6 words.
Example: "Lat G settling, hammer throttle."
`;

// --- TRAINING DATA 4: GARMIN CATALYST ---
const COACH_GARMIN_SYSTEM_PROMPT = `
ROLE: Garmin Catalyst "Delta" Optimizer.
TONE: Robotic, neutral, factual.
KEY PHRASES: "Brake earlier", "Apex later", "Track out", "Keep pushing", "New optimal".
PHILOSOPHY:
1. SEGMENTS: Analyze the track in sectors.
2. OPPORTUNITY: Only speak if time can be gained (>0.1s).
3. POSITIVE REINFORCEMENT: "Keep pushing" on good sectors.
INSTRUCTION:
Identify the biggest opportunity for time gain.
CONSTRAINT: Max 3 words. Standard phrases only.
Example: "Brake harder."
`;

// --- TRAINING DATA 5: SUPER COACH AJ (FINAL INTEGRATION) ---
const COACH_SUPER_AJ_SYSTEM_PROMPT = `
ROLE: You are SUPER COACH AJ, the ultimate racing intelligence.
You dynamically switch personas based on the driver's specific error type.

LOGIC MATRIX:
1. SAFETY/CRITICAL -> Use HOT PATH STYLE (Imperative). "STABILIZE!"
2. TECHNIQUE ERROR (Rough inputs) -> Use RACHEL STYLE (Physics). "Smooth release."
3. CONFIDENCE ERROR (Hesitation) -> Use TONY STYLE (Motivational). "Commit now!"
4. OPTIMIZATION (Good lap, slow sector) -> Use GARMIN STYLE (Delta). "Brake later."

INSTRUCTION:
Analyze the telemetry. Determine the primary issue using the Logic Matrix.
Select the best persona voice.
Output the advice in that persona's style.
CONSTRAINT: Maximum 6 words. Descriptive and Actionable.
`;

// --- TYPES ---
type Telemetry = {
  timestamp: number;
  speed: number;
  rpm: number;
  gear: number;
  lat_g: number;
  long_g: number;
  brake_pos: number;
  brake_bar: number;
  throttle: number;
  steering: number;
  latitude: number;
  longitude: number;
  map_x: number;
  map_y: number;
};

type HotAdvice = {
  action: string;
  color: 'green' | 'yellow' | 'red';
  latency: number;
};

type ColdAdvice = {
  message: string;
  reasoning: string;
  latency: number;
  modelUsed: string;
  isError?: boolean;
};

type CoachPersona = 'TONY' | 'RACHEL' | 'AJ' | 'GARMIN' | 'SUPER_AJ';

declare global {
  interface Window {
    LanguageModel: {
      availability: () => Promise<string>;
      create: (options?: any) => Promise<any>;
    };
  }
}

// --- AUDIO ENGINE ---
class AudioEngine {
  synth!: SpeechSynthesis;
  enabled: boolean = true;
  voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
          this.voices = this.synth.getVoices();
        };
      }
    }
  }

  speak(text: string, priority: 'HIGH' | 'LOW' = 'LOW', persona: CoachPersona = 'TONY') {
    if (!this.enabled || !text || !this.synth) return;

    if (priority === 'HIGH') {
      this.synth.cancel();
    }

    if (this.synth.speaking && priority === 'LOW') {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    let voice = null;

    if (priority === 'HIGH') {
      // HOT PATH: Urgent System Voice
      voice = this.voices.find(v => v.name.includes('Google UK English Female')) ||
        this.voices.find(v => v.name.includes('Microsoft Zira')) ||
        this.voices.find(v => v.name.includes('Samantha'));
      utterance.rate = 1.3;
      utterance.pitch = 1.2;
    } else {
      // WARM PATH: Persona Voice
      if (persona === 'TONY') {
        voice = this.voices.find(v => v.name.includes('Male') && v.lang.includes('US'));
        utterance.pitch = 0.9;
      } else if (persona === 'RACHEL') {
        voice = this.voices.find(v => v.name.includes('Female') && v.lang.includes('US'));
        utterance.pitch = 1.1;
      } else if (persona === 'AJ' || persona === 'SUPER_AJ') {
        voice = this.voices.find(v => v.name.includes('UK English Male'));
        utterance.rate = 1.15;
      } else if (persona === 'GARMIN') {
        voice = this.voices.find(v => v.name.includes('Google US English'));
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
      }
    }

    if (voice) utterance.voice = voice;
    this.synth.speak(utterance);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled && this.synth) this.synth.cancel();
    return this.enabled;
  }
}

const audio = new AudioEngine();

// --- GEMINI NANO BRIDGE ---
class GeminiNanoBridge {
  isReady: boolean = false;
  session: any = null;
  useRealNano: boolean = false;

  async initialize() {
    console.log("[NANO] Checking for Chrome Built-in AI...");
    if (window.LanguageModel) {
      try {
        const availability = await window.LanguageModel.availability();
        console.log("[NANO] Availability:", availability);
        if (availability == 'available') {
          this.session = await window.LanguageModel.create({
            systemPrompt: ` ${COACH_SUPER_AJ_SYSTEM_PROMPT}
            Output ONE word racing commands: STABILIZE, TRAIL_BRAKE, THRESHOLD, PUSH, or MAINTAIN.`,
            expectedInputs: [{
              type: "text",
              languages: ["en"]
            }],
            expectedOutputs: [{
              type: "text",
              languages: ["en"]
            }],
          });
          this.useRealNano = true;
          this.isReady = true;
          return;
        }
      } catch (e) { console.error(e); }
    }
    // Fallback
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.isReady = true;
    this.useRealNano = false;
  }

  async infer(telemetry: Telemetry): Promise<string> {
    if (!this.isReady) return "LOADING";
    const prompt = `Given the following Telemetry Data:
      Speed:${telemetry.speed.toFixed(0)} 
      LatG:${telemetry.lat_g.toFixed(2)} 
      Brake:${telemetry.brake_bar.toFixed(0)} 
      Throttle:${telemetry.throttle.toFixed(0)}
      
      Output Format (JSON):
      {
        "action": "ONE_WORD_COMMAND",
      }
    `

    if (this.useRealNano && this.session) {
      const schema = {
        "type": "object",
        "action": {
          "type": "string",
          "enum": ["STABILIZE", "TRAIL_BRAKE", "STABILIZE", "THRESHOLD", "PUSH", "MAINTAIN"]
        }
      };
      try {
        const output = await this.session.prompt(prompt, {
          responseConstraint: schema,
        });
        console.log(JSON.parse(output));
        return JSON.parse(output).action;
      } catch (e) {
        return "NANO_ERR";
      }
    } else {
      await new Promise(r => setTimeout(r, 25));
      if (Math.abs(telemetry.lat_g) > 1.3) return "STABILIZE";
      if (telemetry.brake_bar > 40 && Math.abs(telemetry.lat_g) > 0.5) return "TRAIL_BRAKE";
      if (telemetry.throttle > 90) return "PUSH";
      if (telemetry.long_g < -0.8) return "THRESHOLD";
      return "MAINTAIN";
    }
  }
}

const nano = new GeminiNanoBridge();

// --- COMPONENTS ---

const GaugeWidget = ({ label, value, max, unit, color = "blue" }: any) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  let bgClass = "bg-blue-500";
  if (color === "orange") bgClass = "bg-orange-500";
  if (color === "red") bgClass = "bg-red-500";
  if (color === "green") bgClass = "bg-green-500";

  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`absolute top-0 left-0 h-full transition-all duration-100 ease-out ${bgClass}`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="text-lg font-mono font-bold mt-0.5">{value.toFixed(0)} <span className="text-[10px] font-normal text-gray-500">{unit}</span></div>
    </div>
  );
};

const GForceWidget = ({ lat, long }: { lat: number, long: number }) => {
  const xPos = Math.max(-50, Math.min(50, lat * 25));
  const yPos = Math.max(-50, Math.min(50, long * -25));
  const isHighG = Math.abs(lat) > 1.2 || Math.abs(long) > 1.2;
  return (
    <div className="relative w-24 h-24 rounded-full border-2 border-zinc-700 bg-zinc-900 flex items-center justify-center shadow-inner">
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <div className="w-full h-px bg-zinc-500"></div>
        <div className="h-full w-px bg-zinc-500 absolute"></div>
      </div>
      <div className={`w-3 h-3 rounded-full shadow-lg transition-all duration-100 ease-out ${isHighG ? 'bg-red-500 shadow-red-500/80 scale-125' : 'bg-green-400 shadow-green-400/50'}`} style={{ transform: `translate(${xPos}px, ${yPos}px)` }} />
      <div className="absolute bottom-2 text-[10px] font-mono text-zinc-400">{Math.abs(lat).toFixed(2)}G</div>
    </div>
  );
};

const TrackMapWidget = ({ carX, carY, pathData }: { carX: number, carY: number, pathData: string }) => {
  return (
    <div className="relative w-full aspect-square bg-zinc-900 rounded-lg border border-zinc-800 p-2 shadow-lg">
      <div className="absolute top-3 left-3 text-gray-500 text-[10px] font-mono tracking-widest">GPS TRACK MAP</div>
      <svg viewBox="0 0 100 100" className="w-full h-full opacity-90">
        <path d={pathData || "M 10 10 L 90 90"} fill="none" stroke="#27272a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathData || "M 10 10 L 90 90"} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={carX} cy={carY} r="3" fill="white" stroke="#3B82F6" strokeWidth="2" className="transition-all duration-100 ease-linear shadow-white/50" />
      </svg>
    </div>
  );
};

const DeltaTimer = ({ delta }: { delta: number }) => {
  const isPositive = delta > 0;
  const color = isPositive ? "text-red-500" : "text-green-500";
  const sign = isPositive ? "+" : "";

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex flex-col items-center justify-center">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Timer size={12} /> Optimal Delta</div>
      <div className={`text-4xl font-mono font-black ${color}`}>
        {sign}{delta.toFixed(2)}
      </div>
      <div className="text-[10px] text-zinc-600 mt-1">VS BEST LAP</div>
    </div>
  );
}

const parseCoordinate = (coord: string): number => {
  if (!coord) return 0;
  const clean = coord.trim();
  if (!clean.includes('°')) return parseFloat(clean);
  const regex = /(\d+)°([\d\.]+)\s+([NSEW])/;
  const match = clean.match(regex);
  if (match) {
    let decimal = parseFloat(match[1]) + (parseFloat(match[2]) / 60);
    if (match[3] === 'S' || match[3] === 'W') decimal = -decimal;
    return decimal;
  }
  return 0;
};

export default function GeminiRacingSim() {
  const [raceData, setRaceData] = useState<Telemetry[]>([]);
  const [trackPath, setTrackPath] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [, setNanoReady] = useState(false);
  const [usingRealNano, setUsingRealNano] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // State
  const [activeCoach, setActiveCoach] = useState<CoachPersona>('SUPER_AJ');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [hotAdvice, setHotAdvice] = useState<HotAdvice>({ action: "LOADING...", color: "yellow", latency: 0 });
  const [coldAdvice, setColdAdvice] = useState<ColdAdvice | null>(null);
  const [coldProcessing, setColdProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const [currentDelta, setCurrentDelta] = useState(0);

  const timerRef = useRef<any>(null);
  const lastHotAction = useRef<string>("");

  useEffect(() => {
    nano.initialize().then(() => {
      setNanoReady(true);
      setUsingRealNano(nano.useRealNano);
      setHotAdvice({ action: "READY", color: "green", latency: 0 });
      const status = nano.useRealNano ? "✅ Gemini Nano (Hardware Accelerated)" : "⚠️ Gemini Nano Not Found (Using Simulation)";
      setLog(l => [status, ...l]);
    });
  }, []);

  const toggleAudio = () => {
    const newState = audio.toggle();
    setAudioEnabled(newState);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processCSV(e.target?.result as string);
    reader.readAsText(file);
  };

  const processCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const idxSpeed = headers.findIndex(h => h.includes('Speed (km/h)'));
    const idxRpm = headers.findIndex(h => h.includes('Engine Speed') || h.includes('rpm'));
    const idxLatG = headers.findIndex(h => h.includes('Lateral acceleration'));
    const idxLongG = headers.findIndex(h => h.includes('Longitudinal acceleration'));
    const idxBrakeBar = headers.findIndex(h => h.includes('Brake Pressure'));
    const idxThrottle = headers.findIndex(h => h.includes('Throttle'));
    const idxLat = headers.findIndex(h => h.includes('Latitude'));
    const idxLong = headers.findIndex(h => h.includes('Longitude'));
    const idxSteer = headers.findIndex(h => h.includes('Steering'));

    const parsedData: Telemetry[] = [];
    let minLat = 90, maxLat = -90, minLong = 180, maxLong = -180;
    const val = (idx: number, cols: string[]) => idx !== -1 ? parseFloat(cols[idx]) || 0 : 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(',');
      const lat = parseCoordinate(cols[idxLat]);
      const long = parseCoordinate(cols[idxLong]);

      if (lat !== 0) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (long < minLong) minLong = long;
        if (long > maxLong) maxLong = long;
      }

      parsedData.push({
        timestamp: i,
        speed: val(idxSpeed, cols) * 0.621371,
        rpm: val(idxRpm, cols),
        gear: 0,
        lat_g: val(idxLatG, cols),
        long_g: val(idxLongG, cols),
        brake_pos: 0,
        brake_bar: val(idxBrakeBar, cols),
        throttle: val(idxThrottle, cols),
        steering: val(idxSteer, cols),
        latitude: lat,
        longitude: long,
        map_x: 0, map_y: 0
      });
    }

    const latRange = maxLat - minLat;
    const longRange = maxLong - minLong;
    const normalizedData = parsedData.map(p => {
      let nx = 50, ny = 50;
      if (latRange > 0) {
        nx = ((p.longitude - minLong) / longRange) * 90 + 5;
        ny = 100 - (((p.latitude - minLat) / latRange) * 90 + 5);
      }
      return { ...p, map_x: nx, map_y: ny };
    });

    if (normalizedData.length > 0) {
      const d = normalizedData.reduce((acc, p, i) => {
        if (i % 5 !== 0 && i !== normalizedData.length - 1) return acc;
        return acc + `${i === 0 ? 'M' : 'L'} ${p.map_x.toFixed(1)} ${p.map_y.toFixed(1)} `;
      }, "");
      setTrackPath(d);
      setRaceData(normalizedData);
      setDataLoaded(true);
      setLog(l => ["✅ System Ready: Waiting for Start", ...l]);
    }
  };

  const runNanoHotPath = async (data: Telemetry) => {
    if (!nano.isReady) return;

    const start = performance.now();
    const output = await nano.infer(data);
    const end = performance.now();

    const cleanAction = output.trim().split(' ')[0].toUpperCase().substring(0, 12);

    let color: 'green' | 'yellow' | 'red' = 'green';
    if (cleanAction.includes("STABILIZE") || cleanAction.includes("THRESH")) color = "red";
    if (cleanAction.includes("TRAIL")) color = "yellow";
    if (cleanAction.includes("PUSH")) color = "green";

    setHotAdvice({ action: cleanAction, color, latency: end - start });

    if (cleanAction !== "MAINTAIN" && cleanAction !== lastHotAction.current) {
      setLog(l => [`[NANO] ${cleanAction} (${data.speed.toFixed(0)}mph)`, ...l].slice(0, 10));

      const priority = (color === 'red' || color === 'yellow') ? 'HIGH' : 'LOW';
      audio.speak(cleanAction, priority, activeCoach);

      lastHotAction.current = cleanAction;
    } else if (cleanAction === "MAINTAIN") {
      lastHotAction.current = cleanAction;
    }
  }

  const runGeminiColdPath = async (data: Telemetry) => {
    setColdProcessing(true);
    const start = Date.now();

    let systemPrompt = COACH_SUPER_AJ_SYSTEM_PROMPT; // Default fallback
    if (activeCoach === 'TONY') systemPrompt = COACH_TONY_SYSTEM_PROMPT;
    if (activeCoach === 'RACHEL') systemPrompt = COACH_RACHEL_SYSTEM_PROMPT;
    if (activeCoach === 'AJ') systemPrompt = COACH_AJ_SYSTEM_PROMPT;
    if (activeCoach === 'SUPER_AJ') systemPrompt = COACH_SUPER_AJ_SYSTEM_PROMPT;
    if (activeCoach === 'GARMIN') systemPrompt = COACH_GARMIN_SYSTEM_PROMPT;

    const prompt = `
      ${systemPrompt}
      
      CURRENT TELEMETRY:
      Speed: ${data.speed.toFixed(0)} mph
      LatG: ${data.lat_g.toFixed(2)} G
      Brake Pressure: ${data.brake_bar.toFixed(0)} bar
      Throttle: ${data.throttle.toFixed(0)} %
      
      INSTRUCTION: Provide 1 sentence of coaching advice in JSON format.
      OUTPUT SCHEMA: { "message": "The advice", "reasoning": "Technical justification" }
    `;

    try {
      const response = await fetch(`${BASE_URL}/${PRIMARY_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1000 }
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error.message);

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1) {
          const cleanJson = text.substring(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(cleanJson);
          const latency = Date.now() - start;
          setColdAdvice({ message: parsed.message, reasoning: parsed.reasoning, latency, modelUsed: "Gemini 2.5 Flash", isError: false });
          setLog(l => [`[${activeCoach}] 🗣️ "${parsed.message}"`, ...l].slice(0, 10));
          audio.speak(parsed.message, 'LOW', activeCoach);
        } else {
          throw new Error("Invalid JSON structure");
        }
      } else {
        throw new Error("Empty response from API");
      }
    } catch (e: any) {
      const latency = Date.now() - start;
      setColdAdvice({
        message: "RADIO STATIC...",
        reasoning: `Connection lost: ${e.message}`,
        latency,
        modelUsed: "Offline",
        isError: true
      });
    } finally {
      setColdProcessing(false);
    }
  };

  useEffect(() => {
    if (isPlaying && raceData.length > 0) {
      timerRef.current = setInterval(() => {
        setTick(t => (t + 1) % raceData.length);
        setCurrentDelta(d => d + (Math.random() - 0.45) * 0.1);
      }, 50);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, raceData]);

  const telemetry = raceData.length > 0 ? raceData[tick] : {
    speed: 0, rpm: 0, lat_g: 0, long_g: 0, brake_bar: 0, throttle: 0, map_x: 50, map_y: 50
  } as Telemetry;

  useEffect(() => {
    if (!isPlaying || !dataLoaded) return;
    if (tick % 2 === 0) runNanoHotPath(telemetry);
    if (tick % 100 === 0 && !coldProcessing) runGeminiColdPath(telemetry);
  }, [tick, isPlaying, dataLoaded]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white font-sans overflow-hidden">

      {/* HEADER */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <Zap size={20} className="text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              HYBRID AI <span className="text-zinc-400 font-normal">RACE COACH</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest flex gap-2 items-center">
              <span className="flex items-center gap-1 text-orange-400"><Cpu size={10} /> Hot: Gemini Nano</span>
              <span className="text-zinc-600">|</span>
              <span className="flex items-center gap-1 text-purple-400"><Flame size={10} /> Warm: Gemini 2.5 Flash</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowHelp(true)} className="p-2 rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Setup Guide">
            <HelpCircle size={16} />
          </button>
          <button onClick={toggleAudio} className={`p-2 rounded-full transition-colors ${audioEnabled ? 'bg-zinc-800 text-green-400' : 'bg-zinc-800 text-zinc-600'}`} title="Toggle Audio Coach">
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {!dataLoaded && (
            <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full cursor-pointer transition-colors text-xs font-bold border border-zinc-700">
              <Upload size={14} /> LOAD CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          )}
          {dataLoaded && (
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold text-sm transition-all transform active:scale-95 ${isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-green-500 hover:bg-green-600 shadow-[0_0_15px_rgba(34,197,94,0.5)]'}`}
            >
              {isPlaying ? <><Pause size={16} fill="currentColor" /> PAUSE</> : <><Play size={16} fill="currentColor" /> START</>}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto">

        {/* LEFT: TELEMETRY (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-2 text-blue-400 mb-4">
              <Map size={16} />
              <h2 className="text-xs font-bold tracking-widest">GPS MAP</h2>
            </div>
            <TrackMapWidget carX={telemetry.map_x} carY={telemetry.map_y} pathData={trackPath} />
          </div>

          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-2 text-blue-400 mb-4">
              <Activity size={16} />
              <h2 className="text-xs font-bold tracking-widest">SENSORS</h2>
            </div>
            <div className="grid grid-cols-1 gap-6">
              <GaugeWidget label="Speed" value={telemetry.speed} max={160} unit="MPH" color="blue" />
              <GaugeWidget label="Throttle" value={telemetry.throttle} max={100} unit="%" color="green" />
              <GaugeWidget label="Brake Press" value={telemetry.brake_bar} max={100} unit="BAR" color="red" />
            </div>
            <div className="flex items-center justify-between bg-zinc-800/30 rounded-lg p-3 mt-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase mb-1">Lateral G</span>
                <span className={`text-lg font-mono font-bold ${Math.abs(telemetry.lat_g) > 1.2 ? 'text-red-500' : 'text-white'}`}>
                  {telemetry.lat_g.toFixed(2)} G
                </span>
                <span className="text-[10px] text-zinc-500 uppercase mt-2 mb-1">Longitudinal G</span>
                <span className="text-sm font-mono text-zinc-300">{telemetry.long_g.toFixed(2)} G</span>
              </div>
              <GForceWidget lat={telemetry.lat_g} long={telemetry.long_g} />
            </div>
          </div>
        </div>

        {/* CENTER: HOT PATH HUD (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* HOT PATH VISUALIZATION - REDUCED SIZE */}
          <div className="h-32 bg-zinc-900 rounded-xl p-1 border border-zinc-800 relative shadow-xl flex flex-col overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>

            <div className="flex justify-between items-center p-2 bg-zinc-800/30">
              <div className="flex items-center gap-2 text-orange-400">
                <Cpu size={12} />
                <h2 className="text-[10px] font-bold tracking-widest">HOT PATH: GEMINI NANO</h2>
              </div>
              <div className="flex items-center gap-2">
                {!usingRealNano && <AlertCircle size={10} className="text-yellow-500" />}
                <span className="text-[9px] font-mono text-orange-400/70">{hotAdvice.latency.toFixed(1)}ms</span>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center p-2">
              <div className={`
                    w-full h-full rounded border-2 flex items-center justify-center transition-all duration-75
                    ${hotAdvice.color === 'red' ? 'border-red-500 bg-red-900/20' :
                  hotAdvice.color === 'yellow' ? 'border-yellow-500 bg-yellow-900/20' :
                    'border-zinc-700 bg-zinc-800/50'}
                `}>
                <span className={`text-3xl font-black uppercase tracking-tighter ${hotAdvice.color === 'red' ? 'text-red-500 animate-pulse' :
                  hotAdvice.color === 'yellow' ? 'text-yellow-400' : 'text-zinc-600'
                  }`}>
                  {hotAdvice.action}
                </span>
              </div>
            </div>
          </div>

          {/* WARM PATH - INCREASED SIZE */}
          <div className="flex-1 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col shadow-xl overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${activeCoach === 'TONY' ? 'from-purple-500 to-pink-500' : activeCoach === 'RACHEL' ? 'from-blue-500 to-cyan-500' : activeCoach === 'AJ' ? 'from-emerald-500 to-teal-500' : activeCoach === 'SUPER_AJ' ? 'from-amber-500 to-yellow-500' : 'from-slate-500 to-zinc-500'}`}></div>

            <div className="flex justify-between items-center p-3 bg-zinc-800/30">
              <div className="flex items-center gap-2">
                {activeCoach === 'GARMIN' ? <Navigation size={16} className="text-slate-400" /> : activeCoach === 'SUPER_AJ' ? <Star size={16} className="text-amber-400" /> : <User size={16} className={activeCoach === 'TONY' ? "text-purple-400" : activeCoach === 'RACHEL' ? "text-blue-400" : "text-emerald-400"} />}
                <h2 className="text-xs font-bold tracking-widest text-zinc-300">
                  WARM PATH: {activeCoach === 'TONY' ? "COACH TONY" : activeCoach === 'RACHEL' ? "COACH RACHEL" : activeCoach === 'AJ' ? "COACH AJ" : activeCoach === 'SUPER_AJ' ? "SUPER COACH AJ" : "GARMIN CATALYST"}
                </h2>
              </div>

              <div className="flex gap-1">
                <button onClick={() => setActiveCoach('TONY')} className={`text-[8px] px-2 py-1 rounded border transition-colors ${activeCoach === 'TONY' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'border-zinc-700 text-zinc-500'}`}>TONY</button>
                <button onClick={() => setActiveCoach('RACHEL')} className={`text-[8px] px-2 py-1 rounded border transition-colors ${activeCoach === 'RACHEL' ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'border-zinc-700 text-zinc-500'}`}>RACHEL</button>
                <button onClick={() => setActiveCoach('AJ')} className={`text-[8px] px-2 py-1 rounded border transition-colors ${activeCoach === 'AJ' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'border-zinc-700 text-zinc-500'}`}>AJ</button>
                <button onClick={() => setActiveCoach('SUPER_AJ')} className={`text-[8px] px-2 py-1 rounded border transition-colors ${activeCoach === 'SUPER_AJ' ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'border-zinc-700 text-zinc-500'}`}>SUPER</button>
                <button onClick={() => setActiveCoach('GARMIN')} className={`text-[8px] px-2 py-1 rounded border transition-colors ${activeCoach === 'GARMIN' ? 'bg-slate-500/20 border-slate-500 text-slate-300' : 'border-zinc-700 text-zinc-500'}`}>GARMIN</button>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col justify-center items-center text-center">
              {coldAdvice ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 w-full max-w-lg">
                  <div className="flex flex-col gap-4">
                    <p className={`text-3xl font-bold leading-tight ${coldAdvice.isError ? 'text-red-400' : 'text-white'}`}>
                      "{coldAdvice.message}"
                    </p>
                    <div className="h-px bg-zinc-800 w-full"></div>
                    <p className="text-sm text-zinc-400 leading-relaxed font-light" style={{ color: activeCoach === 'TONY' ? '#d8b4fe' : activeCoach === 'RACHEL' ? '#93c5fd' : activeCoach === 'AJ' ? '#6ee7b7' : '#cbd5e1' }}>
                      {coldAdvice.reasoning}
                    </p>
                    <div className="flex justify-center mt-4">
                      <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-1 rounded-full border border-zinc-700 uppercase">
                        Latency: {coldAdvice.latency.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-700">
                  <RefreshCw className={`w-8 h-8 ${isPlaying ? 'animate-spin' : ''}`} />
                  <span className="text-sm italic">Analyzing telemetry trends...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: LOGS & DELTA (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* NEW DELTA WIDGET */}
          <DeltaTimer delta={currentDelta} />

          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex flex-col shadow-xl flex-1">
            <div className="flex items-center gap-2 text-zinc-400 mb-4">
              <Terminal size={16} />
              <h2 className="text-xs font-bold tracking-widest">SYSTEM EVENT LOG</h2>
            </div>
            <div className="flex-1 bg-black rounded-lg p-3 font-mono text-[10px] overflow-y-auto max-h-[600px]">
              <div className="flex flex-col gap-1.5">
                {log.map((entry, i) => (
                  <div key={i} className={`border-l-2 pl-2 py-0.5 ${entry.includes("NANO") ? "border-orange-500 text-orange-300/80" : entry.includes("TONY") ? "border-purple-500 text-purple-300/80" : entry.includes("RACHEL") || entry.includes("ROSS") ? "border-blue-500 text-blue-300/80" : entry.includes("AJ") ? "border-emerald-500 text-emerald-300/80" : entry.includes("SUPER_AJ") ? "border-amber-500 text-amber-300/80" : entry.includes("GARMIN") ? "border-slate-500 text-slate-300/80" : "border-zinc-700 text-zinc-500"}`}>
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* HELP MODAL */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-800/50">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-400" />
                Setup Guide
              </h3>
              <button onClick={() => setShowHelp(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm text-zinc-300">
              <p>To enable Gemini Nano in Chrome:</p>

              <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 space-y-3">
                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">1. Enable Flags</div>
                  <p>Go to <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-300">chrome://flags</code> and enable:</p>
                  <ul className="list-disc list-inside mt-1 ml-1 space-y-1 text-zinc-400">
                    <li>Prompt API for Gemini Nano</li>
                    <li>Enforce On-Device Model Availability</li>
                  </ul>
                </div>

                <div className="h-px bg-zinc-800"></div>

                <div>
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">2. Update Component</div>
                  <p>Go to <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-blue-300">chrome://components</code></p>
                  <p className="mt-1">Find <strong>Optimization Guide On Device Model</strong> and click "Check for update".</p>
                </div>
              </div>

              <div className="text-xs text-zinc-500 italic text-center">
                After changes, restart Chrome.
              </div>
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-800/30 flex justify-end">
              <button onClick={() => setShowHelp(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
