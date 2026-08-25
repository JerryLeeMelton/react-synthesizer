# Synthesizer Component Directives

## Tech Stack
*   React (Next.js compatible)
*   Web Audio API (Native, no external audio wrappers)
*   Motion (Framer Motion) for animations
*   Tailwind CSS for styling

## Architectural Rules
*   **Client-Side Only:** Web Audio API `AudioContext` cannot run on the server. Ensure all audio engine initialization happens inside `useEffect` or on an explicit user interaction (like a "Power On" button) to comply with browser autoplay policies and Next.js SSR.
*   **Voice Management:** Implement a 10-voice polyphony manager. When a MIDI note or UI key is pressed, allocate a free voice. When released, trigger the release phase of the ADSR envelopes for that specific voice, then free it up once the amp envelope reaches zero.
*   **Per-Voice Instantiation:** Because this is polyphonic, the signal chain (Oscillators -> Filters -> Amps) must be instantiated *per voice*. Do not build a single global signal chain, otherwise envelopes will retrigger globally for every new note.

## UI & Styling Guidelines
*   The component must be fully self-contained. 
*   Use Tailwind for a modern, "Apple-like" aesthetic: heavy use of `backdrop-blur`, subtle borders (`border-white/10`), smooth shadows, and rounded corners (`rounded-2xl`).
*   Wrap interactive controls (knobs, buttons, keys) in Motion components (`motion.div`, `motion.button`) using spring physics (`type: "spring"`) for tactile feedback.

## Routing Logic implementation
*   Create a clean data structure for the routing state.
*   Example: `osc1.connect(filterState.osc1Target)` where target is a reference to the specific filter node in that voice's signal chain.
*   Filter nodes must chain into Amp nodes based on user selection before connecting to the main destination.

## Input APIs
*   Bind the on-screen keyboard to the voice manager.
*   Implement `navigator.requestMIDIAccess()` inside a `useEffect` to map physical MIDI controller `noteon`/`noteoff` events directly to the same voice manager.