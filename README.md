# 3D Scene Perception & Point Cloud Pipeline

This is a minimal Vite + React + Three.js app that implements a multi-stage 3D scene perception pipeline:

1. **Scene Generation** – Procedural primitives + ground plane
2. **Multi-View Capture** – Virtual camera rig + raycasted depth maps
3. **Point Cloud Fusion** – Back-projection, voxel downsampling, outlier removal
4. **Registration (ICP)** – Point-to-plane ICP with pose noise
5. **Surface Reconstruction** – Marching Cubes over an SDF grid

## Getting started

```bash
npm install
npm run dev
```

Then open the printed localhost URL in your browser.

## Notes

- Tailwind CSS is enabled and used via utility classes only.
- Marching Cubes uses the standard edge/triangle lookup tables (to be filled into `ScenePerceptionApp.jsx` as described in the source).

