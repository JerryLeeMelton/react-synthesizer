export interface MidiHandlers {
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
  onSustain?: (on: boolean) => void;
  onAllNotesOff?: () => void;
  /** called whenever the set of connected input devices changes */
  onDevices?: (names: string[]) => void;
}

export interface MidiConnection {
  dispose: () => void;
}

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;

const CC_SUSTAIN = 64;
const CC_ALL_SOUND_OFF = 120;
const CC_ALL_NOTES_OFF = 123;

export function isMidiSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

/**
 * Wire every MIDI input straight into the voice manager. Devices plugged in
 * later are picked up through `statechange`.
 */
export async function connectMidi(handlers: MidiHandlers): Promise<MidiConnection> {
  if (!isMidiSupported()) {
    throw new Error("Web MIDI is not supported in this browser.");
  }

  const access = await navigator.requestMIDIAccess({ sysex: false });

  const handleMessage = (event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data || data.length < 2) return;

    const command = data[0] & 0xf0;
    const first = data[1];
    const second = data.length > 2 ? data[2] : 0;

    switch (command) {
      case NOTE_ON:
        // Running-status keyboards send note-on with velocity 0 for note-off.
        if (second > 0) handlers.onNoteOn(first, second / 127);
        else handlers.onNoteOff(first);
        break;
      case NOTE_OFF:
        handlers.onNoteOff(first);
        break;
      case CONTROL_CHANGE:
        if (first === CC_SUSTAIN) handlers.onSustain?.(second >= 64);
        else if (first === CC_ALL_NOTES_OFF || first === CC_ALL_SOUND_OFF)
          handlers.onAllNotesOff?.();
        break;
      default:
        break;
    }
  };

  const bindInputs = () => {
    const names: string[] = [];
    access.inputs.forEach((input) => {
      input.onmidimessage = handleMessage;
      names.push(input.name ?? "Unknown device");
    });
    handlers.onDevices?.(names);
  };

  bindInputs();
  access.onstatechange = bindInputs;

  return {
    dispose: () => {
      access.onstatechange = null;
      access.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    },
  };
}
