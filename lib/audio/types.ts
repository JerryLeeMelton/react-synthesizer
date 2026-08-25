/**
 * Patch model for the synthesizer.
 *
 * The patch is plain, serializable data: React owns it, and the audio engine
 * reads from it. Nothing in here holds a reference to an AudioNode.
 */

export type OscWaveform = "sine" | "square" | "sawtooth" | "triangle" | "noise";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

/** Index of a filter or amp section: the routing matrix is 3x3. */
export type SlotIndex = 0 | 1 | 2;

export const SLOT_COUNT = 3;
export const POLYPHONY = 10;

export interface Envelope {
  /** seconds */
  attack: number;
  /** seconds */
  decay: number;
  /** 0..1 */
  sustain: number;
  /** seconds */
  release: number;
}

export interface OscillatorSettings {
  enabled: boolean;
  waveform: OscWaveform;
  /** octave transpose, -3..+3 */
  octave: number;
  /** fine tune in cents, -100..+100 */
  tune: number;
  /** 0..1 */
  level: number;
  /** which filter section this oscillator feeds */
  target: SlotIndex;
}

export interface FilterSettings {
  /** when false the section passes audio through untouched */
  enabled: boolean;
  type: FilterKind;
  /** Hz */
  cutoff: number;
  /** biquad Q */
  resonance: number;
  /** -1..1, scaled to +/- FILTER_ENV_OCTAVES around the cutoff */
  envAmount: number;
  envelope: Envelope;
  /** which amp section this filter feeds */
  target: SlotIndex;
}

export interface AmpSettings {
  /** 0..1 */
  level: number;
  envelope: Envelope;
}

export interface Patch {
  oscillators: OscillatorSettings[];
  filters: FilterSettings[];
  amps: AmpSettings[];
  master: {
    /** 0..1 */
    volume: number;
  };
}

/** How far the filter envelope can push the cutoff at full amount. */
export const FILTER_ENV_OCTAVES = 6;

export const MIN_CUTOFF = 20;
export const MAX_CUTOFF = 20000;

export const defaultEnvelope = (): Envelope => ({
  attack: 0.01,
  decay: 0.2,
  sustain: 0.7,
  release: 0.3,
});

export function createDefaultPatch(): Patch {
  return {
    oscillators: [
      { enabled: true, waveform: "sawtooth", octave: 0, tune: 0, level: 0.6, target: 0 },
      { enabled: false, waveform: "square", octave: -1, tune: 7, level: 0.5, target: 1 },
      { enabled: false, waveform: "triangle", octave: 0, tune: -7, level: 0.5, target: 2 },
    ],
    filters: [
      {
        enabled: true,
        type: "lowpass",
        cutoff: 1200,
        resonance: 4,
        envAmount: 0.4,
        envelope: { attack: 0.02, decay: 0.35, sustain: 0.4, release: 0.4 },
        target: 0,
      },
      {
        enabled: true,
        type: "highpass",
        cutoff: 300,
        resonance: 1,
        envAmount: 0,
        envelope: defaultEnvelope(),
        target: 1,
      },
      {
        enabled: true,
        type: "bandpass",
        cutoff: 900,
        resonance: 6,
        envAmount: 0,
        envelope: defaultEnvelope(),
        target: 2,
      },
    ],
    amps: [
      { level: 0.8, envelope: { attack: 0.01, decay: 0.25, sustain: 0.75, release: 0.35 } },
      { level: 0.8, envelope: defaultEnvelope() },
      { level: 0.8, envelope: defaultEnvelope() },
    ],
    master: { volume: 0.7 },
  };
}
