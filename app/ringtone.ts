// app/ringtone.ts
// Generates ringtone-style tones with Web Audio (no audio files needed).
// Guards against overlapping/duplicate playback.

let audioCtx: AudioContext | null = null;
let intervalId: any = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

function beep(freq: number, duration: number, startDelay: number) {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0, ctx.currentTime + startDelay);
  gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + startDelay + 0.02);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startDelay + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startDelay);
  osc.stop(ctx.currentTime + startDelay + duration + 0.05);
}

export function startRingtone(kind: "outgoing" | "incoming") {
  stopRingtone();
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume();

  function playPattern() {
    if (kind === "outgoing") {
      beep(440, 1, 0);
      beep(440, 1, 1.2);
    } else {
      beep(880, 0.3, 0);
      beep(880, 0.3, 0.4);
    }
  }

  playPattern();
  intervalId = setInterval(playPattern, kind === "outgoing" ? 3000 : 1500);
}

export function stopRingtone() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}