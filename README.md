# Particle Fluid Portrait

A real-time particle simulator powered by MediaPipe FaceMesh and Hands. Thousands of particles choreograph your face and hands with fluid motion, gesture-driven interactions, and a terminal-inspired UI.

<img width="984" height="600" alt="截屏2026-01-09 18 31 36" src="https://github.com/user-attachments/assets/6a744573-665e-4e8e-8928-cc93e99e3290" />

![534045941-764d767b-45d9-414c-bde6-ffc7bcc7cc5c](https://github.com/user-attachments/assets/08c80605-b044-4685-8b70-1134ecb8eb5d)



## Features

- Facial mesh (468 key points) + Hands (21 key points, up to two hands)
- 8k–15k particles with attraction/repulsion modes and trailing glow effects
- Gesture interaction: subtle surprises included
- Fist gesture to switch themes
- Terminal-style UI and guide text

## Demo

Run locally with a static server so the camera works.

```bash
npx serve .
```

## Controls

- `Enter` — enable camera
- `V` — toggle camera preview

## Notes

- Camera access requires `https` or `http://localhost`.
- MediaPipe models are loaded from CDN.

## License

MIT
