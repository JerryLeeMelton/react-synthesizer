"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SynthEngine } from "@/lib/audio/SynthEngine";
import { connectMidi, isMidiSupported, type MidiConnection } from "@/lib/audio/midi";
import {
  createDefaultPatch,
  type AmpSettings,
  type Envelope,
  type FilterSettings,
  type OscillatorSettings,
  type Patch,
} from "@/lib/audio/types";

export type MidiStatus = "unsupported" | "idle" | "connecting" | "connected" | "denied";

/**
 * Bridges React state (the patch) and the imperative audio engine.
 *
 * The engine is created on an explicit user gesture (power on) so the
 * AudioContext starts unsuspended and nothing audio-related runs during SSR.
 */
export function useSynth() {
  const engineRef = useRef<SynthEngine | null>(null);
  const [powered, setPowered] = useState(false);
  const [patch, setPatch] = useState<Patch>(createDefaultPatch);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [midiStatus, setMidiStatus] = useState<MidiStatus>("idle");
  const [midiDevices, setMidiDevices] = useState<string[]>([]);

  // The engine needs the newest patch at construction time.
  const patchRef = useRef(patch);
  patchRef.current = patch;

  useEffect(() => {
    setMidiStatus(isMidiSupported() ? "idle" : "unsupported");
  }, []);

  const powerOn = useCallback(async () => {
    if (engineRef.current) return;
    const engine = new SynthEngine(patchRef.current);
    engineRef.current = engine;
    engine.subscribe(setActiveNotes);
    await engine.resume();
    setPowered(true);
  }, []);

  const powerOff = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    setActiveNotes([]);
    setPowered(false);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Any patch edit is pushed straight into every live voice.
  useEffect(() => {
    engineRef.current?.setPatch(patch);
  }, [patch]);

  const noteOn = useCallback((note: number, velocity = 0.8) => {
    engineRef.current?.noteOn(note, velocity);
  }, []);

  const noteOff = useCallback((note: number) => {
    engineRef.current?.noteOff(note);
  }, []);

  const panic = useCallback(() => {
    engineRef.current?.panic();
  }, []);

  // --- MIDI ----------------------------------------------------------------

  useEffect(() => {
    if (!powered || !isMidiSupported()) return;

    let connection: MidiConnection | null = null;
    let cancelled = false;
    setMidiStatus("connecting");

    connectMidi({
      onNoteOn: (note, velocity) => engineRef.current?.noteOn(note, velocity),
      onNoteOff: (note) => engineRef.current?.noteOff(note),
      onSustain: (on) => engineRef.current?.setSustain(on),
      onAllNotesOff: () => engineRef.current?.allNotesOff(),
      onDevices: setMidiDevices,
    })
      .then((result) => {
        if (cancelled) {
          result.dispose();
          return;
        }
        connection = result;
        setMidiStatus("connected");
      })
      .catch(() => {
        if (!cancelled) setMidiStatus("denied");
      });

    return () => {
      cancelled = true;
      connection?.dispose();
      setMidiDevices([]);
      setMidiStatus("idle");
    };
  }, [powered]);

  // --- patch editing -------------------------------------------------------

  const actions = useMemo(
    () => ({
      updateOscillator(index: number, changes: Partial<OscillatorSettings>) {
        setPatch((current) => ({
          ...current,
          oscillators: current.oscillators.map((osc, i) =>
            i === index ? { ...osc, ...changes } : osc,
          ),
        }));
      },
      updateFilter(index: number, changes: Partial<FilterSettings>) {
        setPatch((current) => ({
          ...current,
          filters: current.filters.map((filter, i) =>
            i === index ? { ...filter, ...changes } : filter,
          ),
        }));
      },
      updateFilterEnvelope(index: number, changes: Partial<Envelope>) {
        setPatch((current) => ({
          ...current,
          filters: current.filters.map((filter, i) =>
            i === index ? { ...filter, envelope: { ...filter.envelope, ...changes } } : filter,
          ),
        }));
      },
      updateAmp(index: number, changes: Partial<AmpSettings>) {
        setPatch((current) => ({
          ...current,
          amps: current.amps.map((amp, i) => (i === index ? { ...amp, ...changes } : amp)),
        }));
      },
      updateAmpEnvelope(index: number, changes: Partial<Envelope>) {
        setPatch((current) => ({
          ...current,
          amps: current.amps.map((amp, i) =>
            i === index ? { ...amp, envelope: { ...amp.envelope, ...changes } } : amp,
          ),
        }));
      },
      setMasterVolume(volume: number) {
        setPatch((current) => ({ ...current, master: { ...current.master, volume } }));
      },
      resetPatch() {
        setPatch(createDefaultPatch());
      },
    }),
    [],
  );

  return {
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
  };
}
