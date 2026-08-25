"use client";

import { EnvelopeEditor, Segmented, Slider, Toggle } from "./controls";
import {
  MAX_CUTOFF,
  MIN_CUTOFF,
  type Envelope,
  type FilterKind,
  type FilterSettings,
  type SlotIndex,
} from "@/lib/audio/types";
import styles from "./synth.module.css";

const TYPES: { value: FilterKind; label: string }[] = [
  { value: "lowpass", label: "LP" },
  { value: "highpass", label: "HP" },
  { value: "bandpass", label: "BP" },
];

const AMP_TARGETS: { value: SlotIndex; label: string }[] = [
  { value: 0, label: "Amp 1" },
  { value: 1, label: "Amp 2" },
  { value: 2, label: "Amp 3" },
];

interface Props {
  index: number;
  settings: FilterSettings;
  onChange: (changes: Partial<FilterSettings>) => void;
  onEnvelopeChange: (changes: Partial<Envelope>) => void;
}

export function FilterPanel({ index, settings, onChange, onEnvelopeChange }: Props) {
  return (
    <section className={styles.panel} data-enabled={settings.enabled}>
      <header className={styles.panelHeader}>
        <h3>Filter {index + 1}</h3>
        <Toggle
          label={settings.enabled ? "On" : "Bypass"}
          active={settings.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </header>

      <Segmented
        label="Type"
        value={settings.type}
        options={TYPES}
        onChange={(type) => onChange({ type })}
      />
      <Slider
        label="Cutoff"
        value={settings.cutoff}
        min={MIN_CUTOFF}
        max={MAX_CUTOFF}
        scale="log"
        format={(value) =>
          value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(0)} Hz`
        }
        onChange={(cutoff) => onChange({ cutoff })}
      />
      <Slider
        label="Resonance"
        value={settings.resonance}
        min={0.0001}
        max={20}
        format={(value) => `Q ${value.toFixed(1)}`}
        onChange={(resonance) => onChange({ resonance })}
      />
      <Slider
        label="Env Amount"
        value={settings.envAmount}
        min={-1}
        max={1}
        format={(value) => value.toFixed(2)}
        onChange={(envAmount) => onChange({ envAmount })}
      />
      <EnvelopeEditor envelope={settings.envelope} onChange={onEnvelopeChange} />
      <Segmented
        label="Route to"
        value={settings.target}
        options={AMP_TARGETS}
        onChange={(target) => onChange({ target })}
      />
    </section>
  );
}
