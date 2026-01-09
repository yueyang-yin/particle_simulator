# Particle Fluid Portrait

A real-time particle simulator powered by MediaPipe FaceMesh and Hands. Thousands of particles choreograph your face and hands with fluid motion, gesture-driven interactions, and a terminal-inspired UI.

<img width="984" height="600" alt="截屏2026-01-09 18 31 36" src="https://github.com/user-attachments/assets/6a744573-665e-4e8e-8928-cc93e99e3290" />

<img width="983" height="599" alt="截屏2026-01-09 18 32 30" src="https://github.com/user-attachments/assets/764d767b-45d9-414c-bde6-ffc7bcc7cc5c" />


## Features

- Facial mesh (468 key points) + Hands (21 key points, up to two hands)
- 8k–15k particles with attraction/repulsion modes and trailing glow effects
- Gesture interaction: subtle surprises included
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
