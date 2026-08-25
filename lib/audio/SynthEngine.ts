import { Voice } from "./Voice";
import { POLYPHONY, type Patch, type SlotIndex } from "./types";

type NotesListener = (notes: number[]) => void;

/** Two seconds of white noise, looped by every voice's noise source. */
function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Owns the AudioContext, the master bus and a fixed pool of voices.
 *
 * The engine is deliberately framework-free: React drives it through
 * `setPatch` / `noteOn` / `noteOff`, and subscribes for the list of sounding
 * notes so the on-screen keyboard can light up.
 */
export class SynthEngine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;

  private readonly master: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly voices: Voice[] = [];

  /** note -> the voice currently sounding it */
  private readonly noteMap = new Map<number, Voice>();
  /** notes whose key/pad is physically down */
  private readonly heldNotes = new Set<number>();
  /** notes released while the sustain pedal was down */
  private readonly sustainedNotes = new Set<number>();
  private sustainOn = false;

  private readonly listeners = new Set<NotesListener>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private patch: Patch;
  private disposed = false;

  constructor(patch: Patch) {
    this.patch = patch;

    const Ctor: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();

    this.master = this.ctx.createGain();
    this.master.gain.value = patch.master.volume;

    // Polyphony plus three amp sections can add up fast; keep peaks in check.
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    this.master.connect(this.limiter);
    this.limiter.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    const noiseBuffer = createNoiseBuffer(this.ctx);
    for (let i = 0; i < POLYPHONY; i += 1) {
      const voice = new Voice(this.ctx, noiseBuffer, patch);
      voice.output.connect(this.master);
      this.voices.push(voice);
    }
  }

  // --- lifecycle -----------------------------------------------------------

  async resume(): Promise<void> {
    if (this.ctx.state !== "running") {
      await this.ctx.resume();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const voice of this.voices) voice.dispose();
    this.noteMap.clear();
    this.heldNotes.clear();
    this.sustainedNotes.clear();
    this.master.disconnect();
    this.limiter.disconnect();
    this.analyser.disconnect();
    void this.ctx.close();
  }

  // --- patch ---------------------------------------------------------------

  setPatch(patch: Patch): void {
    if (this.disposed) return;
    this.patch = patch;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(patch.master.volume, now, 0.01);
    for (const voice of this.voices) voice.applyPatch(patch, now);
  }

  getPatch(): Patch {
    return this.patch;
  }

  // --- notes ---------------------------------------------------------------

  noteOn(note: number, velocity = 0.8): void {
    if (this.disposed) return;
    void this.resume();

    const now = this.ctx.currentTime;
    this.heldNotes.add(note);
    this.sustainedNotes.delete(note);

    const voice = this.noteMap.get(note) ?? this.allocateVoice();
    voice.applyPatch(this.patch, now);
    voice.noteOn(note, velocity, now);
    this.noteMap.set(note, voice);
    this.notify();
  }

  noteOff(note: number): void {
    if (this.disposed) return;
    this.heldNotes.delete(note);

    if (this.sustainOn) {
      if (this.noteMap.has(note)) this.sustainedNotes.add(note);
      return;
    }
    this.releaseNote(note);
  }

  setSustain(on: boolean): void {
    if (this.disposed || this.sustainOn === on) return;
    this.sustainOn = on;
    if (!on) {
      for (const note of Array.from(this.sustainedNotes)) {
        if (!this.heldNotes.has(note)) this.releaseNote(note);
      }
      this.sustainedNotes.clear();
    }
  }

  allNotesOff(): void {
    if (this.disposed) return;
    for (const note of Array.from(this.noteMap.keys())) this.releaseNote(note);
    this.heldNotes.clear();
    this.sustainedNotes.clear();
  }

  /** Immediate silence — no release tails. */
  panic(): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices) {
      voice.kill(now);
      voice.free();
    }
    this.noteMap.clear();
    this.heldNotes.clear();
    this.sustainedNotes.clear();
    this.notify();
  }

  getActiveNotes(): number[] {
    return Array.from(this.noteMap.keys());
  }

  getVoiceUsage(): number {
    return this.voices.filter((voice) => voice.state !== "idle").length;
  }

  subscribe(listener: NotesListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- internals -----------------------------------------------------------

  private releaseNote(note: number): void {
    const voice = this.noteMap.get(note);
    if (!voice) return;
    this.noteMap.delete(note);

    const now = this.ctx.currentTime;
    const end = voice.noteOff(now);
    this.scheduleFree(voice, end - now);
    this.notify();
  }

  /**
   * Free the voice once its amp envelopes have actually reached zero. The
   * generation check keeps a stale timer from freeing a voice that has since
   * been retriggered.
   */
  private scheduleFree(voice: Voice, seconds: number): void {
    const generation = voice.generation;
    const timer = setTimeout(
      () => {
        this.timers.delete(timer);
        if (voice.generation === generation && voice.state === "releasing") {
          voice.free();
        }
      },
      Math.max(seconds, 0) * 1000 + 30,
    );
    this.timers.add(timer);
  }

  private allocateVoice(): Voice {
    const idle = this.voices.find((voice) => voice.state === "idle");
    if (idle) return idle;

    const releasing = this.voices
      .filter((voice) => voice.state === "releasing")
      .sort((a, b) => a.startedAt - b.startedAt)[0];
    if (releasing) return releasing;

    // Everything is sounding: steal the oldest note.
    const oldest = this.voices.reduce((a, b) => (a.startedAt <= b.startedAt ? a : b));
    if (oldest.note !== null) {
      this.noteMap.delete(oldest.note);
      this.heldNotes.delete(oldest.note);
      this.sustainedNotes.delete(oldest.note);
    }
    return oldest;
  }

  private notify(): void {
    const notes = this.getActiveNotes();
    for (const listener of this.listeners) listener(notes);
  }
}

export type { SlotIndex };
