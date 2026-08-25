"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { isBlackKey, noteLabel } from "@/lib/audio/notes";
import styles from "./synth.module.css";

interface Props {
  startNote: number;
  endNote: number;
  activeNotes: number[];
  onNoteOn: (note: number, velocity?: number) => void;
  onNoteOff: (note: number) => void;
  disabled?: boolean;
}

/**
 * Pointer-driven piano. Dragging across keys is legato: a key sounds on enter
 * while the pointer is down, and stops on leave, which mirrors how the MIDI
 * path feeds the same voice manager.
 */
export function Keyboard({
  startNote,
  endNote,
  activeNotes,
  onNoteOn,
  onNoteOff,
  disabled = false,
}: Props) {
  const pointerDown = useRef(false);
  const sounding = useRef(new Set<number>());

  const active = new Set(activeNotes);
  const notes: number[] = [];
  for (let note = startNote; note <= endNote; note += 1) notes.push(note);

  const whiteNotes = notes.filter((note) => !isBlackKey(note));
  const whiteWidth = 100 / whiteNotes.length;

  const press = useCallback(
    (note: number) => {
      if (disabled || sounding.current.has(note)) return;
      sounding.current.add(note);
      onNoteOn(note, 0.8);
    },
    [disabled, onNoteOn],
  );

  const release = useCallback(
    (note: number) => {
      if (!sounding.current.delete(note)) return;
      onNoteOff(note);
    },
    [onNoteOff],
  );

  // A pointer released outside the keyboard must still stop the note.
  useEffect(() => {
    const stopAll = () => {
      pointerDown.current = false;
      for (const note of Array.from(sounding.current)) release(note);
    };
    window.addEventListener("pointerup", stopAll);
    window.addEventListener("pointercancel", stopAll);
    return () => {
      window.removeEventListener("pointerup", stopAll);
      window.removeEventListener("pointercancel", stopAll);
    };
  }, [release]);

  const keyProps = (note: number) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      pointerDown.current = true;
      press(note);
    },
    onPointerEnter: () => {
      if (pointerDown.current) press(note);
    },
    onPointerLeave: () => release(note),
    onPointerUp: () => release(note),
  });

  return (
    <div className={styles.keyboard} aria-label="Keyboard" role="group">
      <div className={styles.whiteKeys}>
        {whiteNotes.map((note) => (
          <motion.div
            key={note}
            className={styles.whiteKey}
            data-active={active.has(note)}
            whileTap={{ scaleY: 0.98 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
            aria-label={noteLabel(note)}
            {...keyProps(note)}
          >
            <span>{noteLabel(note)}</span>
          </motion.div>
        ))}
      </div>

      {notes
        .filter(isBlackKey)
        .map((note) => {
          const whitesBefore = notes.filter((n) => n < note && !isBlackKey(n)).length;
          return (
            <motion.div
              key={note}
              className={styles.blackKey}
              data-active={active.has(note)}
              whileTap={{ scaleY: 0.97 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              style={{
                left: `${whitesBefore * whiteWidth - whiteWidth * 0.3}%`,
                width: `${whiteWidth * 0.6}%`,
              }}
              aria-label={noteLabel(note)}
              {...keyProps(note)}
            />
          );
        })}
    </div>
  );
}
