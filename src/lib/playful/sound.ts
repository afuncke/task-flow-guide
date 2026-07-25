import { isPlayful } from "./store";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Note = { freq: number; at: number; dur: number; gain?: number; type?: OscillatorType };

function play(notes: Note[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.freq;
    const start = now + n.at;
    const peak = n.gain ?? 0.08;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}

/** Short blip — pickups, drag start. */
export function soundPop() {
  if (!isPlayful()) return;
  play([{ freq: 520, at: 0, dur: 0.09, type: "triangle", gain: 0.05 }]);
}

/** Soft thunk — dropping a card into a column / slot. */
export function soundDrop() {
  if (!isPlayful()) return;
  play([
    { freq: 300, at: 0, dur: 0.07, type: "sine", gain: 0.06 },
    { freq: 200, at: 0.05, dur: 0.09, type: "sine", gain: 0.05 },
  ]);
}

/** Happy little arpeggio — task completed. */
export function soundComplete() {
  if (!isPlayful()) return;
  play([
    { freq: 660, at: 0, dur: 0.12, type: "triangle" },
    { freq: 880, at: 0.08, dur: 0.14, type: "triangle" },
    { freq: 1320, at: 0.17, dur: 0.22, type: "triangle", gain: 0.06 },
  ]);
}

/** Gentle chime — mode switched on. */
export function soundSparkle() {
  if (typeof window === "undefined") return;
  play([
    { freq: 990, at: 0, dur: 0.1, type: "sine", gain: 0.05 },
    { freq: 1480, at: 0.07, dur: 0.16, type: "sine", gain: 0.04 },
  ]);
}
