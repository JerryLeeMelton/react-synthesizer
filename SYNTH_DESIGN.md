# Polyphonic Web Synthesizer - Design Document

## Overview
A self-contained, 10-voice polyphonic synthesizer built as a React component for a Next.js environment. The UI features a premium, animation-heavy, modern design. It operates entirely on the native Web Audio API and supports both mouse/touch and MIDI input.

## Core Architecture
*   **Audio Engine:** Native Web Audio API (`AudioContext`).
*   **Polyphony:** 10-voice concurrent limit. Each voice must instantiate its own complete signal chain (Oscillators -> Filters -> Amps) to allow independent envelope triggering per note.
*   **State Management:** React hooks (`useState`, `useReducer`, or `useRef` for audio nodes) to manage UI state and sync with the Audio API.

## Signal Flow & Routing Matrix
The signal path is semi-modular, flowing strictly left-to-right through three stages:
1.  **Oscillators (1, 2, 3):**
    *   Waveforms: Sine, Square, Sawtooth, Triangle, Noise.
    *   Controls: Octave, Tune (fine cents), Power (On/Off).
    *   Routing: Output selector to route to Filter 1, 2, or 3.
2.  **Filters (1, 2, 3):**
    *   Types: Lowpass, Highpass, Bandpass.
    *   Controls: Cutoff frequency, Resonance, ADSR Envelope.
    *   Routing: Output selector to route to Amp 1, 2, or 3.
3.  **Amplifiers (1, 2, 3):**
    *   Controls: Master volume per section, ADSR Envelope.
    *   Routing: Hardwired to Master Output / AudioContext Destination.

## UI / UX Design
*   **Aesthetic:** Clean, hardware-accelerated rendering, Apple-inspired interface. Use frosted glass effects, high-contrast typography, and smooth, tactile feedback.
*   **Styling:** Pure modern CSS3 (CSS Modules). Use CSS variables for easy theming of states (active/inactive).
*   **Animations (Motion):** Spring-physics for button presses, smooth knob rotations, fading LED indicators, and active-voice visualizers.
*   **Input Handling:** 
    *   Interactive on-screen piano keyboard with active state styling.
    *   Web MIDI API integration listening for `noteon` and `noteoff` messages.

## Technical Constraints
*   **Zero external audio dependencies:** No Tone.js or Howler.
*   **Next.js Compatibility:** AudioContext must be initialized only on the client side (inside a `useEffect` or upon first user interaction) to prevent SSR errors.