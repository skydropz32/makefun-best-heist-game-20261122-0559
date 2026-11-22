// Sound only: tiny WebAudio synth, no audio files. Every effect is an oscillator (or filtered
// noise) with a short gain envelope, so the game stays offline and self-contained.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      return null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq || 800;
    const gain = ac.createGain();
    gain.gain.value = vol || 0.08;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(t0);
  }

  function play(name) {
    if (muted) return;
    if (name === 'loot') { tone(880, 0.12, 'sine', 0.14); tone(1318, 0.18, 'sine', 0.12, 0.07); }
    else if (name === 'alert') { tone(220, 0.25, 'sawtooth', 0.14, 0, 440); tone(220, 0.25, 'sawtooth', 0.12, 0.18, 440); }
    else if (name === 'coin') { tone(1568, 0.1, 'triangle', 0.12); noise(0.08, 0.05, 4000); }
    else if (name === 'hack') { tone(660, 0.08, 'square', 0.07); tone(990, 0.08, 'square', 0.07, 0.09); tone(1320, 0.14, 'square', 0.07, 0.18); }
    else if (name === 'win') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.14, i * 0.12)); }
    else if (name === 'lose') { tone(196, 0.6, 'sawtooth', 0.14, 0, 98); tone(147, 0.8, 'sawtooth', 0.12, 0.25, 73); }
    else if (name === 'step') { noise(0.05, 0.02, 500); }
  }

  function resume() { const ac = ensure(); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }
  function toggleMute() { muted = !muted; return muted; }

  return { play, resume, toggleMute, get muted() { return muted; } };
}
