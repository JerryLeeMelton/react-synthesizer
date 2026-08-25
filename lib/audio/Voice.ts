import { midiToFrequency } from "./notes";
import { cancelAndHold, triggerAttack, triggerAttackBetween, triggerRelease } from "./envelope";
import {
  FILTER_ENV_OCTAVES,
  MAX_CUTOFF,
  MIN_CUTOFF,
  SLOT_COUNT,
  type FilterSettings,
  type Patch,
  type SlotIndex,
} from "./types";

export type VoiceState = "idle" | "active" | "releasing";

interface SourceSlot {
  /** tonal source, free-running; the amp envelope does the gating */
  osc: OscillatorNode;
  oscGain: GainNode;
  /** noise source, also free-running; only one of the two gains is open */
  noise: AudioBufferSourceNode;
  noiseGain: GainNode;
  level: GainNode;
  target: SlotIndex;
}

interface FilterSlot {
  node: BiquadFilterNode;
  target: SlotIndex;
}

interface AmpSlot {
  env: GainNode;
  level: GainNode;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Base cutoff and the frequency the filter envelope peaks at. */
function envFrequencies(filter: FilterSettings): { base: number; peak: number } {
  const base = clamp(filter.cutoff, MIN_CUTOFF, MAX_CUTOFF);
  const peak = clamp(
    base * Math.pow(2, filter.envAmount * FILTER_ENV_OCTAVES),
    MIN_CUTOFF,
    MAX_CUTOFF,
  );
  return { base, peak };
}

/**
 * One complete, independent signal chain:
 *
 *   3 sources -> (routing) -> 3 filters -> (routing) -> 3 amps -> voice out
 *
 * Every node here belongs to this voice alone, so envelopes never retrigger
 * across notes. Sources run continuously from construction; a note is started
 * and stopped purely by the per-amp envelopes.
 */
export class Voice {
  readonly output: GainNode;

  private readonly ctx: BaseAudioContext;
  private readonly sources: SourceSlot[] = [];
  private readonly filters: FilterSlot[] = [];
  private readonly amps: AmpSlot[] = [];

  state: VoiceState = "idle";
  note: number | null = null;
  /** ctx time the voice was last triggered; used for voice stealing */
  startedAt = 0;
  /** bumped on every trigger so a stale release timer cannot free a live voice */
  generation = 0;

  private patch: Patch;
  private velocity = 1;

  constructor(ctx: BaseAudioContext, noiseBuffer: AudioBuffer, patch: Patch) {
    this.ctx = ctx;
    this.patch = patch;

    this.output = ctx.createGain();
    this.output.gain.value = 1;

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const env = ctx.createGain();
      env.gain.value = 0;
      const level = ctx.createGain();
      level.gain.value = patch.amps[i].level;
      env.connect(level);
      level.connect(this.output);
      this.amps.push({ env, level });
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const node = ctx.createBiquadFilter();
      const settings = patch.filters[i];
      node.type = settings.enabled ? settings.type : "allpass";
      node.frequency.value = clamp(settings.cutoff, MIN_CUTOFF, MAX_CUTOFF);
      node.Q.value = settings.resonance;
      node.connect(this.amps[settings.target].env);
      this.filters.push({ node, target: settings.target });
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const settings = patch.oscillators[i];

      const osc = ctx.createOscillator();
      osc.type = settings.waveform === "noise" ? "sawtooth" : settings.waveform;
      osc.frequency.value = 440;
      osc.detune.value = settings.tune;

      const oscGain = ctx.createGain();
      oscGain.gain.value = settings.waveform === "noise" ? 0 : 1;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = settings.waveform === "noise" ? 1 : 0;

      const level = ctx.createGain();
      level.gain.value = settings.enabled ? settings.level : 0;

      osc.connect(oscGain).connect(level);
      noise.connect(noiseGain).connect(level);
      level.connect(this.filters[settings.target].node);

      osc.start();
      noise.start();

      this.sources.push({ osc, oscGain, noise, noiseGain, level, target: settings.target });
    }
  }

  // --- routing -------------------------------------------------------------

  private routeSource(index: number, target: SlotIndex): void {
    const source = this.sources[index];
    if (source.target === target) return;
    source.level.disconnect();
    source.level.connect(this.filters[target].node);
    source.target = target;
  }

  private routeFilter(index: number, target: SlotIndex): void {
    const filter = this.filters[index];
    if (filter.target === target) return;
    filter.node.disconnect();
    filter.node.connect(this.amps[target].env);
    filter.target = target;
  }

  // --- patch ---------------------------------------------------------------

  /**
   * Push the current patch into this voice's nodes.
   *
   * Called on every patch edit (so knobs move held notes) and again on note-on.
   * Params under envelope control are only nudged, never re-scheduled, unless
   * the voice is idle.
   */
  applyPatch(patch: Patch, time: number): void {
    this.patch = patch;

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const settings = patch.oscillators[i];
      const source = this.sources[i];
      const isNoise = settings.waveform === "noise";

      if (settings.waveform !== "noise" && source.osc.type !== settings.waveform) {
        source.osc.type = settings.waveform;
      }
      source.oscGain.gain.setTargetAtTime(isNoise ? 0 : 1, time, 0.005);
      source.noiseGain.gain.setTargetAtTime(isNoise ? 1 : 0, time, 0.005);
      source.level.gain.setTargetAtTime(settings.enabled ? settings.level : 0, time, 0.01);
      source.osc.detune.setTargetAtTime(settings.tune, time, 0.01);
      this.routeSource(i, settings.target);

      if (this.note !== null) {
        source.osc.frequency.setTargetAtTime(this.sourceFrequency(i), time, 0.01);
      }
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const settings = patch.filters[i];
      const filter = this.filters[i];
      const type: BiquadFilterType = settings.enabled ? settings.type : "allpass";
      if (filter.node.type !== type) filter.node.type = type;
      filter.node.Q.setTargetAtTime(settings.resonance, time, 0.01);
      this.routeFilter(i, settings.target);

      const { base, peak } = envFrequencies(settings);
      if (this.state === "idle") {
        filter.node.frequency.setValueAtTime(base, time);
      } else if (this.state === "active") {
        // Follow the knob while the note is held: re-aim at the sustain point.
        const sustainFreq = base + (peak - base) * settings.envelope.sustain;
        cancelAndHold(filter.node.frequency, time);
        filter.node.frequency.setTargetAtTime(sustainFreq, time, 0.02);
      }
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      this.amps[i].level.gain.setTargetAtTime(patch.amps[i].level, time, 0.01);
    }
  }

  private sourceFrequency(index: number): number {
    const settings = this.patch.oscillators[index];
    const note = this.note ?? 69;
    return midiToFrequency(note) * Math.pow(2, settings.octave);
  }

  // --- note lifecycle ------------------------------------------------------

  noteOn(note: number, velocity: number, time: number): void {
    this.note = note;
    this.velocity = clamp(velocity, 0, 1);
    this.state = "active";
    this.startedAt = time;
    this.generation += 1;

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      this.sources[i].osc.frequency.setValueAtTime(this.sourceFrequency(i), time);
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const settings = this.patch.filters[i];
      const { base, peak } = envFrequencies(settings);
      triggerAttackBetween(this.filters[i].node.frequency, settings.envelope, base, peak, time);
    }

    for (let i = 0; i < SLOT_COUNT; i += 1) {
      triggerAttack(this.amps[i].env.gain, this.patch.amps[i].envelope, this.velocity, time);
    }
  }

  /** Starts the release phase; returns the ctx time the voice goes silent. */
  noteOff(time: number): number {
    if (this.state !== "active") return time;
    this.state = "releasing";

    let end = time;
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const settings = this.patch.filters[i];
      const { base } = envFrequencies(settings);
      triggerRelease(this.filters[i].node.frequency, settings.envelope.release, time, base);
    }
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      const release = this.patch.amps[i].envelope.release;
      end = Math.max(end, triggerRelease(this.amps[i].env.gain, release, time));
    }
    return end;
  }

  /** Cut the voice immediately (voice stealing, panic, power off). */
  kill(time: number, fade = 0.005): number {
    this.state = "releasing";
    let end = time;
    for (let i = 0; i < SLOT_COUNT; i += 1) {
      end = Math.max(end, triggerRelease(this.amps[i].env.gain, fade, time));
    }
    return end;
  }

  /** Mark the voice reusable once its amp envelopes have reached zero. */
  free(): void {
    this.state = "idle";
    this.note = null;
  }

  dispose(): void {
    for (const source of this.sources) {
      try {
        source.osc.stop();
        source.noise.stop();
      } catch {
        // already stopped
      }
      source.osc.disconnect();
      source.oscGain.disconnect();
      source.noise.disconnect();
      source.noiseGain.disconnect();
      source.level.disconnect();
    }
    for (const filter of this.filters) filter.node.disconnect();
    for (const amp of this.amps) {
      amp.env.disconnect();
      amp.level.disconnect();
    }
    this.output.disconnect();
  }
}
