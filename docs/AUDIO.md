# Forge audio

Every sound on the site is synthesized in the browser with the Web Audio API. Nothing is sampled, downloaded, or taken from a recording. The generators live in `packages/forge-runtime/src/sound.ts`.

- The bed is two quiet sine tones through a low-pass filter.
- The Forge hum is a triangle oscillator. Its level rises as the camera gets closer to the sculpture and falls off by about 38 metres.
- A portal whoosh and a glass click are short bursts of generated noise through a sweeping band-pass filter.

Sound is off until the visitor turns it on. The choice is stored in `localStorage` under `forge-sound`. Quiet mode stops it. Reduced motion skips the whoosh and the click and keeps only the bed and the hum, and only if sound was turned on.
