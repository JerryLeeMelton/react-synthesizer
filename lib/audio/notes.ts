const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Equal temperament, A4 (MIDI 69) = 440 Hz. */
export function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function noteName(note: number): string {
  return NOTE_NAMES[((note % 12) + 12) % 12];
}

export function noteLabel(note: number): string {
  return `${noteName(note)}${Math.floor(note / 12) - 1}`;
}

export function isBlackKey(note: number): boolean {
  return noteName(note).includes("#");
}
