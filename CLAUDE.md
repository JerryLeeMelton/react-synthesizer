# Synthesizer Component Directives

## Tech Stack
*   React (Next.js compatible)
*   Web Audio API (Native, no external audio wrappers)
*   Motion (Framer Motion) for animations
*   Modern CSS3 (CSS Modules)

## Architectural Rules
*   **Client-Side Only:** Web Audio API `AudioContext` cannot run on the server. Ensure all audio engine initialization happens inside `useEffect` or on an explicit user interaction (like a "Power On" button) to comply with browser autoplay policies and Next.js SSR.
*   **Voice Management:** Implement a 10-voice polyphony manager. When a MIDI note or UI key is pressed, allocate a free voice. When released, trigger the release phase of the ADSR envelopes for that specific voice, then free it up once the amp envelope reaches zero.
*   **Per-Voice Instantiation:** Because this is polyphonic, the signal chain (Oscillators -> Filters -> Amps) must be instantiated *per voice*. Do not build a single global signal chain, otherwise envelopes will retrigger globally for every new note.

## UI & Styling Guidelines
*   The component must be fully self-contained. 
*   **CSS Requirements:** Do NOT use Tailwind or other utility frameworks. Use pure CSS3 (via CSS Modules like `synth.module.css`). 
*   **Aesthetic Details:** Achieve an "Apple-like" premium UI using native CSS properties. Utilize `backdrop-filter: blur()` for glassmorphism, `box-shadow` for subtle depth, CSS custom properties (`var(--accent-color)`) for routing indicators, and semantic HTML.
*   **Animations:** Wrap interactive controls (knobs, buttons, keys) in Motion components (`motion.div`, `motion.button`) using spring physics (`type: "spring"`) for tactile feedback.

## Routing Logic implementation
*   Create a clean data structure for the routing state.
*   Example: `osc1.connect(filterState.osc1Target)` where target is a reference to the specific filter node in that voice's signal chain.
*   Filter nodes must chain into Amp nodes based on user selection before connecting to the main destination.

## Input APIs
*   Bind the on-screen keyboard to the voice manager.
*   Implement `navigator.requestMIDIAccess()` inside a `useEffect` to map physical MIDI controller `noteon`/`noteoff` events directly to the same voice manager.