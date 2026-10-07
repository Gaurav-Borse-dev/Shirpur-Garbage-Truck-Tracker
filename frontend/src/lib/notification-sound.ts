/**
 * CleanTrack Unique Garbage Tracker Notification Sound Engine
 *
 * Provides a signature, instantly recognizable acoustic chime for Shirpur
 * Municipal Corporation waste management alerts. Built using Web Audio API
 * with warm harmonic bell synthesis — works 100% offline, zero network latency,
 * and immune to asset loading failures on mobile & desktop browsers.
 */

export type SoundType =
  | "truck_nearby"
  | "truck_arrived"
  | "route_started"
  | "route_completed"
  | "booking_update"
  | "generic"
  | "whatsapp_pop";

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Ensures AudioContext is active upon first user tap/click to comply with
 * browser autoplay policies.
 */
export function unlockAudio() {
  if (unlocked || typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const buffer = ctx.createBuffer(1, 1, 22050);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);

  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => {
        unlocked = true;
      })
      .catch(() => {});
  } else {
    unlocked = true;
  }
}

if (typeof window !== "undefined") {
  const handleFirstInteraction = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", handleFirstInteraction);
    window.removeEventListener("keydown", handleFirstInteraction);
    window.removeEventListener("touchstart", handleFirstInteraction);
  };
  window.addEventListener("pointerdown", handleFirstInteraction, { passive: true });
  window.addEventListener("keydown", handleFirstInteraction, { passive: true });
  window.addEventListener("touchstart", handleFirstInteraction, { passive: true });
}

/**
 * Synthesizes a resonant bell chime note with natural harmonic overtones.
 */
function playChimeNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.28,
) {
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, startTime);
  masterGain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  masterGain.connect(ctx.destination);

  // Fundamental frequency oscillator (warm sine)
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, startTime);

  // Second harmonic (subtle bell clarity)
  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq * 2.02, startTime);
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.35, startTime);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

  // Third sparkle harmonic (bright municipal chime overtone)
  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq * 3.01, startTime);
  const gain3 = ctx.createGain();
  gain3.gain.setValueAtTime(0.18, startTime);
  gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.5);

  osc1.connect(masterGain);
  osc2.connect(gain2);
  gain2.connect(masterGain);
  osc3.connect(gain3);
  gain3.connect(masterGain);

  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);

  osc1.stop(startTime + duration + 0.05);
  osc2.stop(startTime + duration + 0.05);
  osc3.stop(startTime + duration + 0.05);
}

/**
 * Plays the signature CleanTrack unique notification melody.
 */
export function playNotificationSound(type: SoundType = "truck_nearby") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime + 0.02;

    switch (type) {
      case "truck_arrived": {
        // Signature CleanTrack 4-note ascending fanfare chime (C5 -> E5 -> G5 -> C6)
        // Highly distinctive and immediately notifies resident that garbage truck is here!
        playChimeNote(ctx, 523.25, t + 0.0, 0.45, 0.32); // C5
        playChimeNote(ctx, 659.25, t + 0.12, 0.45, 0.34); // E5
        playChimeNote(ctx, 783.99, t + 0.24, 0.5, 0.36); // G5
        playChimeNote(ctx, 1046.5, t + 0.38, 0.75, 0.4); // C6 (long bright bell sustain)
        break;
      }

      case "truck_nearby": {
        // CleanTrack 3-note melodic alert chime (E5 -> G5 -> B5)
        playChimeNote(ctx, 659.25, t + 0.0, 0.4, 0.3); // E5
        playChimeNote(ctx, 783.99, t + 0.14, 0.45, 0.32); // G5
        playChimeNote(ctx, 987.77, t + 0.28, 0.65, 0.36); // B5
        break;
      }

      case "route_completed":
      case "route_started": {
        // Upbeat double chime for driver tasks & route milestones (G5 -> C6)
        playChimeNote(ctx, 783.99, t + 0.0, 0.35, 0.3);
        playChimeNote(ctx, 1046.5, t + 0.15, 0.6, 0.35);
        break;
      }

      case "booking_update": {
        // Friendly municipal tone (A5 -> E6)
        playChimeNote(ctx, 880.0, t + 0.0, 0.3, 0.26);
        playChimeNote(ctx, 1318.51, t + 0.12, 0.55, 0.32);
        break;
      }

      case "whatsapp_pop":
      case "generic":
      default: {
        // Crisp WhatsApp-style pop & bell ping (F5 -> C6)
        playChimeNote(ctx, 698.46, t + 0.0, 0.25, 0.28);
        playChimeNote(ctx, 1046.5, t + 0.09, 0.5, 0.34);
        break;
      }
    }
  } catch (err) {
    console.debug("[audio] notification sound skipped", err);
  }
}
