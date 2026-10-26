import Phaser from 'phaser';

// Sound effects synthesised with Web Audio, since the game ships no audio
// files. Silent when Web Audio is unavailable or still locked before the
// first tap.

function context(scene: Phaser.Scene): AudioContext | null {
  const sound = scene.sound as Partial<Phaser.Sound.WebAudioSoundManager>;
  const ctx = sound.context;
  return ctx && ctx.state === 'running' ? ctx : null;
}

/** Two quick rising notes. Valuable coins play higher and longer. */
export function playCoin(scene: Phaser.Scene, valuable = false): void {
  try {
    const ctx = context(scene);
    if (!ctx) return;
    const notes = valuable ? [1047, 1319, 1760] : [988, 1319];
    const t0 = ctx.currentTime;
    notes.forEach((freq, i) => {
      const start = t0 + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // Audio is decoration; never let it break the game.
  }
}
