/**
 * All Forge audio is synthesized in the browser with WebAudio.
 * There are no samples and no third-party recordings.
 * See docs/AUDIO.md.
 */

export interface ForgeSound {
  setEnabled: (on: boolean) => void;
  setReduced: (reduced: boolean) => void;
  setDistance: (meters: number) => void;
  whoosh: () => void;
  click: () => void;
  stop: () => void;
}

export function createForgeSound(): ForgeSound {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let hum: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let enabled = false;
  let reduced = false;

  function ensure() {
    if (context) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context = new Ctx();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const low = context.createOscillator();
    low.type = "sine";
    low.frequency.value = 52;
    const mid = context.createOscillator();
    mid.type = "sine";
    mid.frequency.value = 78;
    const bed = context.createGain();
    bed.gain.value = 0.045;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    low.connect(filter);
    mid.connect(filter);
    filter.connect(bed);
    bed.connect(master);
    low.start();
    mid.start();

    const tone = context.createOscillator();
    tone.type = "triangle";
    tone.frequency.value = 98;
    hum = context.createGain();
    hum.gain.value = 0;
    tone.connect(hum);
    hum.connect(master);
    tone.start();

    const length = Math.floor(context.sampleRate * 0.6);
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function burst(duration: number, from: number, to: number, gain: number) {
    if (!context || !master || !noise) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), context.currentTime + duration);
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain, context.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    source.start();
    source.stop(context.currentTime + duration + 0.02);
  }

  return {
    setEnabled(on) {
      enabled = on;
      ensure();
      if (!context || !master) return;
      if (context.state === "suspended") void context.resume();
      master.gain.setTargetAtTime(on ? 0.85 : 0, context.currentTime, 0.12);
      if (!on && hum) hum.gain.setTargetAtTime(0, context.currentTime, 0.05);
    },
    setReduced(next) {
      reduced = next;
    },
    setDistance(meters) {
      if (!enabled || !context || !hum) return;
      const closeness = Math.max(0, 1 - meters / 38);
      hum.gain.setTargetAtTime(closeness * 0.07, context.currentTime, 0.12);
    },
    whoosh() {
      if (!enabled || reduced) return;
      ensure();
      burst(0.55, 1800, 180, 0.12);
    },
    click() {
      if (!enabled || reduced) return;
      ensure();
      burst(0.08, 2400, 900, 0.05);
    },
    stop() {
      this.setEnabled(false);
    },
  };
}
