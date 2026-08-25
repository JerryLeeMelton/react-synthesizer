"use client";

import { motion } from "motion/react";
import type { Envelope } from "@/lib/audio/types";
import styles from "./synth.module.css";

const tap = { scale: 0.95 };
const spring = { type: "spring", stiffness: 500, damping: 30 } as const;

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** log is the sane choice for anything measured in Hz */
  scale?: "linear" | "log";
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.001,
  scale = "linear",
  format,
  onChange,
}: SliderProps) {
  const isLog = scale === "log";
  const toSlider = (v: number) =>
    isLog ? Math.log(v / min) / Math.log(max / min) : v;
  const fromSlider = (v: number) => (isLog ? min * Math.pow(max / min, v) : v);

  return (
    <label className={styles.control}>
      <span className={styles.controlLabel}>
        {label}
        <span className={styles.controlValue}>{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={isLog ? 0 : min}
        max={isLog ? 1 : max}
        step={isLog ? 0.001 : step}
        value={toSlider(value)}
        onChange={(event) => onChange(fromSlider(Number(event.target.value)))}
      />
    </label>
  );
}

interface Option<T> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string | number> {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className={styles.control}>
      {label ? <span className={styles.controlLabel}>{label}</span> : null}
      <div className={styles.segmented} role="group" aria-label={label}>
        {options.map((option) => (
          <motion.button
            key={String(option.value)}
            type="button"
            whileTap={tap}
            transition={spring}
            className={option.value === value ? styles.segmentActive : styles.segment}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
}

export function Toggle({ label, active, onChange }: ToggleProps) {
  return (
    <motion.button
      type="button"
      whileTap={tap}
      transition={spring}
      className={active ? styles.toggleActive : styles.toggle}
      aria-pressed={active}
      onClick={() => onChange(!active)}
    >
      <span className={styles.led} data-on={active} />
      {label}
    </motion.button>
  );
}

interface EnvelopeEditorProps {
  envelope: Envelope;
  onChange: (changes: Partial<Envelope>) => void;
}

const seconds = (value: number) => `${value.toFixed(2)}s`;

export function EnvelopeEditor({ envelope, onChange }: EnvelopeEditorProps) {
  return (
    <div className={styles.envelope}>
      <Slider
        label="Attack"
        value={envelope.attack}
        min={0.001}
        max={4}
        format={seconds}
        onChange={(attack) => onChange({ attack })}
      />
      <Slider
        label="Decay"
        value={envelope.decay}
        min={0.001}
        max={4}
        format={seconds}
        onChange={(decay) => onChange({ decay })}
      />
      <Slider
        label="Sustain"
        value={envelope.sustain}
        min={0}
        max={1}
        format={(value) => value.toFixed(2)}
        onChange={(sustain) => onChange({ sustain })}
      />
      <Slider
        label="Release"
        value={envelope.release}
        min={0.001}
        max={6}
        format={seconds}
        onChange={(release) => onChange({ release })}
      />
    </div>
  );
}
