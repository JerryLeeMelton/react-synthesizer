# Polyphonic Web Synthesizer

A 10-voice polyphonic synthesizer built as a self-contained React component on the
native Web Audio API. No Tone.js, no Howler, no audio wrappers.

See `SYNTH_DESIGN.md` for the product design and `CLAUDE.md` for the architectural
directives this implementation follows.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run typecheck
```

Click **Power On** first — browsers only allow an `AudioContext` to start from a
user gesture, so the engine is constructed on that click and never during SSR.

## Playing it

| Input | How |
| --- | --- |
| On-screen keys | Click or drag across the keyboard (dragging is legato) |
| Computer keyboard | `A W S E D F T G Y H U J K …` for notes, `Z` / `X` to change octave |
| MIDI controller | Plugged-in devices bind automatically once powered on |

MIDI `noteon` / `noteoff` (including note-on with velocity 0), sustain pedal
(CC 64) and all-notes-off (CC 120/123) are handled. Devices connected after
power-on are picked up via `statechange`.

## Signal flow

```
                 ┌ Osc 1 ┐            ┌ Filter 1 ┐          ┌ Amp 1 ┐
   note  ───────►│ Osc 2 │──routing──►│ Filter 2 │─routing─►│ Amp 2 │──► master ──► limiter ──► out
                 └ Osc 3 ┘            └ Filter 3 ┘          └ Amp 3 ┘
```

Each oscillator picks which filter it feeds; each filter picks which amp it
feeds; amps are hardwired to the master bus. **This entire chain exists once per
voice** (10 copies), which is what lets envelopes trigger per note instead of
globally.

* **Oscillators** — sine / square / saw / triangle / noise, octave, fine tune
  (cents), level, on-off.
* **Filters** — lowpass / highpass / bandpass, cutoff, resonance, bipolar
  envelope amount (±6 octaves around the cutoff), ADSR, bypass.
* **Amps** — level and ADSR.

## Code layout

| Path | Role |
| --- | --- |
| `lib/audio/types.ts` | The patch: plain serializable data, no AudioNodes |
| `lib/audio/Voice.ts` | One complete per-voice signal chain + its envelopes |
| `lib/audio/SynthEngine.ts` | AudioContext, master bus, voice pool, note map, stealing |
| `lib/audio/envelope.ts` | ADSR scheduling helpers on `AudioParam`s |
| `lib/audio/midi.ts` | `navigator.requestMIDIAccess()` binding |
| `components/synth/useSynth.ts` | React ↔ engine bridge |
| `components/synth/*.tsx` | Panels, keyboard, controls |

### Voice management

Oscillators run free from voice construction; a note is started and stopped
purely by the per-amp envelopes, so there is no node churn while playing. On
note-on the engine takes an idle voice, else the oldest releasing voice, else
steals the oldest sounding one. A released voice is returned to the pool only
once its amp envelope has actually reached zero, guarded by a generation counter
so a retrigger cannot be freed by a stale timer.

Editing any control pushes the patch into every live voice, so knob moves are
heard on notes that are already held.

## Status

Functionality first: the UI is deliberately plain (functional CSS Modules only)
while the audio engine is being dialed in. The glassmorphic, animation-rich
treatment described in the design docs is still to come — Motion is already
wired into the interactive controls.
