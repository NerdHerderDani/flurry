/**
 * A4 — one quiet synthesized mechanical keyclick, for new CRITICAL launches
 * only. Web Audio, no asset files. Off by default; never plays on load; never
 * plays for non-CRITICAL events.
 *
 * The AudioContext is created lazily on the first *enabled* click, so a user
 * who never turns SFX on never has an audio context created at all.
 */
let ctx: AudioContext | null = null;

/** OS "reduce motion" is treated as a proxy for "minimal", per the brief. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function playKeyclick(): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    const now = ctx.currentTime;

    // Short filtered-noise burst + a low thock: a keyswitch, not a beep.
    const frames = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      // Deterministic-ish decaying noise; no Math.random needed for a click.
      const decay = (1 - i / frames) ** 4;
      data[i] = (((i * 1103515245 + 12345) % 2048) / 1024 - 1) * decay;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0.06; // quiet on purpose
    noise.connect(bandpass).connect(gain).connect(ctx.destination);
    noise.start(now);

    const thock = ctx.createOscillator();
    thock.type = "square";
    thock.frequency.setValueAtTime(160, now);
    const tGain = ctx.createGain();
    tGain.gain.setValueAtTime(0.05, now);
    tGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    thock.connect(tGain).connect(ctx.destination);
    thock.start(now);
    thock.stop(now + 0.05);
  } catch {
    /* audio unavailable (autoplay policy, no device) — silence is fine */
  }
}
