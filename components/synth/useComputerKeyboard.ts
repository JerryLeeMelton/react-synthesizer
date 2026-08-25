"use client";

import { useEffect, useRef } from "react";

/** Tracker-style layout: home row is the white keys, top row the accidentals. */
const KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6,
  g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ";": 16,
};

interface Options {
  enabled: boolean;
  /** MIDI note the "a" key plays */
  baseNote: number;
  onNoteOn: (note: number, velocity?: number) => void;
  onNoteOff: (note: number) => void;
  onOctaveShift?: (delta: number) => void;
}

/** Lets the synth be played without a MIDI controller attached. */
export function useComputerKeyboard({
  enabled,
  baseNote,
  onNoteOn,
  onNoteOff,
  onOctaveShift,
}: Options) {
  const held = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled) return;

    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    const handleDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "z" || key === "x") {
        onOctaveShift?.(key === "z" ? -1 : 1);
        return;
      }

      const offset = KEY_MAP[key];
      if (offset === undefined || held.current.has(key)) return;
      const note = baseNote + offset;
      held.current.set(key, note);
      onNoteOn(note, 0.8);
    };

    const handleUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const note = held.current.get(key);
      if (note === undefined) return;
      held.current.delete(key);
      onNoteOff(note);
    };

    // Notes held while the tab loses focus would otherwise stick.
    const releaseAll = () => {
      for (const note of held.current.values()) onNoteOff(note);
      held.current.clear();
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [enabled, baseNote, onNoteOn, onNoteOff, onOctaveShift]);
}
