"use client";

import { useCallback, useState } from "react";
import { motion } from "motion/react";
import { AmpPanel } from "./AmpPanel";
import { FilterPanel } from "./FilterPanel";
import { Keyboard } from "./Keyboard";
import { OscillatorPanel } from "./OscillatorPanel";
import { Slider } from "./controls";
import { useComputerKeyboard } from "./useComputerKeyboard";
import { useSynth, type MidiStatus } from "./useSynth";
import { POLYPHONY } from "@/lib/audio/types";
import styles from "./synth.module.css";

const MIDI_LABEL: Record<MidiStatus, string> = {
  unsupported: "MIDI unsupported in this browser",
  idle: "MIDI idle",
  connecting: "MIDI connecting…",
  connected: "MIDI connected",
  denied: "MIDI access denied",
};

const KEYBOARD_SPAN = 24; // two octaves on screen

export function Synth() {
  const {
    powered,
    powerOn,
    powerOff,
    patch,
    actions,
    activeNotes,
    noteOn,
    noteOff,
    panic,
    midiStatus,
    midiDevices,
  } = useSynth();

  const [octave, setOctave] = useState(3);
  const startNote = 12 * (octave + 1);

  const shiftOctave = useCallback((delta: number) => {
    setOctave((current) => Math.min(7, Math.max(0, current + delta)));
  }, []);

  useComputerKeyboard({
    enabled: powered,
    baseNote: startNote,
    onNoteOn: noteOn,
    onNoteOff: noteOff,
    onOctaveShift: shiftOctave,
  });

  return (
    <main className={styles.synth}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <h1>Polyphonic Web Synthesizer</h1>
          <p className={styles.status}>
            {MIDI_LABEL[midiStatus]}
            {midiDevices.length > 0 ? ` · ${midiDevices.join(", ")}` : ""}
            {` · ${activeNotes.length}/${POLYPHONY} voices`}
          </p>
        </div>

        <div className={styles.topControls}>
          <Slider
            label="Master"
            value={patch.master.volume}
            min={0}
            max={1}
            format={(value) => value.toFixed(2)}
            onChange={actions.setMasterVolume}
          />
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={powered ? styles.powerOn : styles.power}
            onClick={() => (powered ? powerOff() : void powerOn())}
          >
            {powered ? "Power Off" : "Power On"}
          </motion.button>
          <button type="button" className={styles.secondary} onClick={panic} disabled={!powered}>
            Panic
          </button>
          <button type="button" className={styles.secondary} onClick={actions.resetPatch}>
            Reset Patch
          </button>
        </div>
      </header>

      {!powered ? (
        <p className={styles.hint}>
          Audio starts on power on (browsers require a gesture). Play with the on-screen keys, your
          computer keyboard (A–L row, Z/X to change octave) or any connected MIDI controller.
        </p>
      ) : null}

      <div className={styles.rack}>
        <div className={styles.row}>
          {patch.oscillators.map((settings, index) => (
            <OscillatorPanel
              key={index}
              index={index}
              settings={settings}
              onChange={(changes) => actions.updateOscillator(index, changes)}
            />
          ))}
        </div>

        <div className={styles.row}>
          {patch.filters.map((settings, index) => (
            <FilterPanel
              key={index}
              index={index}
              settings={settings}
              onChange={(changes) => actions.updateFilter(index, changes)}
              onEnvelopeChange={(changes) => actions.updateFilterEnvelope(index, changes)}
            />
          ))}
        </div>

        <div className={styles.row}>
          {patch.amps.map((settings, index) => (
            <AmpPanel
              key={index}
              index={index}
              settings={settings}
              onChange={(changes) => actions.updateAmp(index, changes)}
              onEnvelopeChange={(changes) => actions.updateAmpEnvelope(index, changes)}
            />
          ))}
        </div>
      </div>

      <footer className={styles.keyboardBar}>
        <div className={styles.octaveControls}>
          <button type="button" className={styles.secondary} onClick={() => shiftOctave(-1)}>
            Octave −
          </button>
          <span className={styles.octaveLabel}>C{octave}</span>
          <button type="button" className={styles.secondary} onClick={() => shiftOctave(1)}>
            Octave +
          </button>
        </div>
        <Keyboard
          startNote={startNote}
          endNote={startNote + KEYBOARD_SPAN}
          activeNotes={activeNotes}
          onNoteOn={noteOn}
          onNoteOff={noteOff}
          disabled={!powered}
        />
      </footer>
    </main>
  );
}

export default Synth;
