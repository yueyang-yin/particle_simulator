# Particle Fluid Portrait

A real-time particle simulator driven by MediaPipe FaceMesh and Hands. Thousands of particles form your face and hands with fluid motion, gestures, and a terminal-style UI.

## Features

- Facial mesh (468 key points) + Hands (21 key points, up to two hands)
- 8k–15k particles with attraction/repulsion modes and trailing glow effects
- Gesture interaction: (I think you should discover this yourself)
- Fist gesture to switch themes
- Terminal-style UI and guide text

## Demo

Run locally with a static server so the camera works.

```bash
python3 -m http.server 8000
```

Open:

```
http://localhost:8000
```

## Controls

- `Enter` — enable camera
- `Space` — toggle mode (disabled during middle-finger penalty until you apologize)
- `V` — toggle camera preview

## Notes

- Camera access requires `https` or `http://localhost`.
- MediaPipe models are loaded from CDN.

## License

MIT
