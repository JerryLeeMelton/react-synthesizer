"use client";

import { EnvelopeEditor, Slider } from "./controls";
import type { AmpSettings, Envelope } from "@/lib/audio/types";
import styles from "./synth.module.css";

interface Props {
  index: number;
  settings: AmpSettings;
  onChange: (changes: Partial<AmpSettings>) => void;
  onEnvelopeChange: (changes: Partial<Envelope>) => void;
}

export function AmpPanel({ index, settings, onChange, onEnvelopeChange }: Props) {
  return (
    <section className={styles.panel} data-enabled={settings.level > 0}>
      <header className={styles.panelHeader}>
        <h3>Amp {index + 1}</h3>
        <span className={styles.routeNote}>&rarr; Master</span>
      </header>

      <Slider
        label="Level"
        value={settings.level}
        min={0}
        max={1}
        format={(value) => value.toFixed(2)}
        onChange={(level) => onChange({ level })}
      />
      <EnvelopeEditor envelope={settings.envelope} onChange={onEnvelopeChange} />
    </section>
  );
}
