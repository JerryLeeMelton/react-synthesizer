"use client";

import { Segmented, Slider, Toggle } from "./controls";
import type { OscillatorSettings, OscWaveform, SlotIndex } from "@/lib/audio/types";
import styles from "./synth.module.css";

const WAVEFORMS: { value: OscWaveform; label: string }[] = [
  { value: "sine", label: "Sine" },
  { value: "square", label: "Square" },
  { value: "sawtooth", label: "Saw" },
  { value: "triangle", label: "Tri" },
  { value: "noise", label: "Noise" },
];

const FILTER_TARGETS: { value: SlotIndex; label: string }[] = [
  { value: 0, label: "Filter 1" },
  { value: 1, label: "Filter 2" },
  { value: 2, label: "Filter 3" },
];

interface Props {
  index: number;
  settings: OscillatorSettings;
  onChange: (changes: Partial<OscillatorSettings>) => void;
}

export function OscillatorPanel({ index, settings, onChange }: Props) {
  return (
    <section className={styles.panel} data-enabled={settings.enabled}>
      <header className={styles.panelHeader}>
        <h3>Osc {index + 1}</h3>
        <Toggle
          label={settings.enabled ? "On" : "Off"}
          active={settings.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </header>

      <Segmented
        label="Waveform"
        value={settings.waveform}
        options={WAVEFORMS}
        onChange={(waveform) => onChange({ waveform })}
      />
      <Slider
        label="Octave"
        value={settings.octave}
        min={-3}
        max={3}
        step={1}
        format={(value) => (value > 0 ? `+${value}` : String(value))}
        onChange={(octave) => onChange({ octave })}
      />
      <Slider
        label="Tune"
        value={settings.tune}
        min={-100}
        max={100}
        step={1}
        format={(value) => `${value.toFixed(0)} ct`}
        onChange={(tune) => onChange({ tune })}
      />
      <Slider
        label="Level"
        value={settings.level}
        min={0}
        max={1}
        format={(value) => value.toFixed(2)}
        onChange={(level) => onChange({ level })}
      />
      <Segmented
        label="Route to"
        value={settings.target}
        options={FILTER_TARGETS}
        onChange={(target) => onChange({ target })}
      />
    </section>
  );
}
