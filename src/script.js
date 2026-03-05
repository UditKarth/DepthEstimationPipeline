import React, {
    useRef,
    useEffect,
    useState,
    useCallback,
    useMemo,
  } from 'react';
  import * as THREE from 'three';
  import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
  import { edgeTable, triTable } from './mc';
  
  // ---------- Utility: Simple Orbit Controls (no external imports) ----------
  class SimpleOrbitControls {
    constructor(camera, domElement) {
      this.camera = camera;
      this.domElement = domElement;
      this.enabled = true;
  
      this.target = new THREE.Vector3(0, 0, 0);
      this.spherical = new THREE.Spherical();
      this.sphericalDelta = new THREE.Spherical();
      this.zoomScale = 0.95;
  
      this.rotateSpeed = 1.0;
      this.zoomSpeed = 1.2;
      this.panSpeed = 0.3;
  
      this.state = 'none'; // 'rotate' | 'pan' | 'none'
      this.pointerOld = new THREE.Vector2();
  
      this._onMouseDown = this.onMouseDown.bind(this);
      this._onMouseMove = this.onMouseMove.bind(this);
      this._onMouseUp = this.onMouseUp.bind(this);
      this._onWheel = this.onWheel.bind(this);
  
      domElement.addEventListener('mousedown', this._onMouseDown);
      domElement.addEventListener('wheel', this._onWheel, { passive: false });
    }
  
    dispose() {
      this.domElement.removeEventListener('mousedown', this._onMouseDown);
      this.domElement.removeEventListener('wheel', this._onWheel);
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);
    }
  
    onMouseDown(e) {
      if (!this.enabled) return;
      e.preventDefault();
      if (e.button === 0) {
        this.state = 'rotate';
      } else if (e.button === 1 || e.button === 2) {
        this.state = 'pan';
      }
      this.pointerOld.set(e.clientX, e.clientY);
      window.addEventListener('mousemove', this._onMouseMove);
      window.addEventListener('mouseup', this._onMouseUp);
    }
  
    onMouseMove(e) {
      if (!this.enabled) return;
      e.preventDefault();
      const dx = e.clientX - this.pointerOld.x;
      const dy = e.clientY - this.pointerOld.y;
      this.pointerOld.set(e.clientX, e.clientY);
  
      if (this.state === 'rotate') {
        const element = this.domElement;
        this.rotateLeft((2 * Math.PI * dx) / element.clientWidth * this.rotateSpeed);
        this.rotateUp((2 * Math.PI * dy) / element.clientHeight * this.rotateSpeed);
      } else if (this.state === 'pan') {
        this.pan(dx, dy);
      }
    }
  
    onMouseUp() {
      this.state = 'none';
      window.removeEventListener('mousemove', this._onMouseMove);
      window.removeEventListener('mouseup', this._onMouseUp);
    }
  
    onWheel(e) {
      if (!this.enabled) return;
      e.preventDefault();
      if (e.deltaY < 0) {
        this.dollyOut(this.zoomSpeed);
      } else if (e.deltaY > 0) {
        this.dollyIn(this.zoomSpeed);
      }
    }
  
    rotateLeft(angle) {
      this.sphericalDelta.theta -= angle;
    }
  
    rotateUp(angle) {
      this.sphericalDelta.phi -= angle;
    }
  
    dollyIn(dollyScale) {
      this.spherical.radius = Math.max(0.1, this.spherical.radius / dollyScale);
    }
  
    dollyOut(dollyScale) {
      this.spherical.radius = Math.min(1000, this.spherical.radius * dollyScale);
    }
  
    pan(dx, dy) {
      const offset = new THREE.Vector3();
      offset.copy(this.camera.position).sub(this.target);
      const targetDistance = offset.length();
      targetDistance *= Math.tan(((this.camera.fov / 2) * Math.PI) / 180.0);
  
      const panX = (2 * dx * targetDistance) / this.domElement.clientHeight;
      const panY = (2 * dy * targetDistance) / this.domElement.clientHeight;
  
      const panOffset = new THREE.Vector3();
      panOffset.setFromMatrixColumn(this.camera.matrix, 0); // x
      panOffset.multiplyScalar(-panX);
  
      const panOffsetY = new THREE.Vector3();
      panOffsetY.setFromMatrixColumn(this.camera.matrix, 1); // y
      panOffsetY.multiplyScalar(panY);
  
      panOffset.add(panOffsetY);
      this.camera.position.add(panOffset);
      this.target.add(panOffset);
    }
  
    update() {
      const offset = new THREE.Vector3();
      offset.copy(this.camera.position).sub(this.target);
      this.spherical.setFromVector3(offset);
      this.spherical.theta += this.sphericalDelta.theta;
      this.spherical.phi += this.sphericalDelta.phi;
      this.spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this.spherical.phi));
  
      this.camera.position.setFromSpherical(this.spherical).add(this.target);
      this.camera.lookAt(this.target);
      this.sphericalDelta.set(0, 0, 0);
    }
  }
  
  // ---------- Math helpers ----------
  const deg2rad = (d) => (d * Math.PI) / 180.0;
  const randRange = (min, max) => min + Math.random() * (max - min);
  
  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  
  function createBoxMeshData(width, height, depth, segments = 1) {
    const geom = new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
    geom.computeVertexNormals();
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    const index = geom.index ? geom.index.array : null;
    return {
      vertices: new Float32Array(pos),
      normals: new Float32Array(norm),
      faces: index ? new Uint32Array(index) : null,
    };
  }
  
  function createSphereMeshData(radius, widthSegments = 16, heightSegments = 12) {
    const geom = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    geom.computeVertexNormals();
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    const index = geom.index ? geom.index.array : null;
    return {
      vertices: new Float32Array(pos),
      normals: new Float32Array(norm),
      faces: index ? new Uint32Array(index) : null,
    };
  }
  
  function createCylinderMeshData(radiusTop, radiusBottom, height, radialSegments = 16) {
    const geom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    geom.computeVertexNormals();
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    const index = geom.index ? geom.index.array : null;
    return {
      vertices: new Float32Array(pos),
      normals: new Float32Array(norm),
      faces: index ? new Uint32Array(index) : null,
    };
  }
  
  function createTorusMeshData(radius, tube = 0.2, radialSegments = 16, tubularSegments = 24) {
    const geom = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
    geom.computeVertexNormals();
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    const index = geom.index ? geom.index.array : null;
    return {
      vertices: new Float32Array(pos),
      normals: new Float32Array(norm),
      faces: index ? new Uint32Array(index) : null,
    };
  }
  
  function createConeMeshData(radius, height, radialSegments = 16) {
    const geom = new THREE.ConeGeometry(radius, height, radialSegments);
    geom.computeVertexNormals();
    const pos = geom.attributes.position.array;
    const norm = geom.attributes.normal.array;
    const index = geom.index ? geom.index.array : null;
    return {
      vertices: new Float32Array(pos),
      normals: new Float32Array(norm),
      faces: index ? new Uint32Array(index) : null,
    };
  }
  
  function applyTransformToMesh(mesh, position, rotation, scale) {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3(...position);
    const euler = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
    const scl = new THREE.Vector3(...scale);
    mat.compose(pos, new THREE.Quaternion().setFromEuler(euler), scl);
  
    const v = mesh.vertices;
    const n = mesh.normals;
    const v3 = new THREE.Vector3();
    const n3 = new THREE.Vector3();
    for (let i = 0; i < v.length; i += 3) {
      v3.set(v[i], v[i + 1], v[i + 2]).applyMatrix4(mat);
      v[i] = v3.x;
      v[i + 1] = v3.y;
      v[i + 2] = v3.z;
    }
    const normalMat = new THREE.Matrix3().getNormalMatrix(mat);
    for (let i = 0; i < n.length; i += 3) {
      n3.set(n[i], n[i + 1], n[i + 2]).applyMatrix3(normalMat).normalize();
      n[i] = n3.x;
      n[i + 1] = n3.y;
      n[i + 2] = n3.z;
    }
  }
  
  // Ray-triangle intersection (Möller–Trumbore)
  function intersectRayTriangle(orig, dir, v0, v1, v2) {
    const EPS = 1e-6;
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const h = new THREE.Vector3().crossVectors(dir, edge2);
    const a = edge1.dot(h);
    if (Math.abs(a) < EPS) return null;
    const f = 1.0 / a;
    const s = new THREE.Vector3().subVectors(orig, v0);
    const u = f * s.dot(h);
    if (u < 0 || u > 1) return null;
    const q = new THREE.Vector3().crossVectors(s, edge1);
    const v = f * dir.dot(q);
    if (v < 0 || u + v > 1) return null;
    const t = f * edge2.dot(q);
    if (t > EPS) {
      return { t, u, v };
    }
    return null;
  }
  
  // ---------- Marching Cubes tables (edgeTable, triTable) ----------
  // Imported from `mc.js` where the canonical lookup tables are defined.
  
  // ---------- Main Component ----------
  const ScenePerceptionApp = React.memo(function ScenePerceptionApp() {
    // Stage
    const [stage, setStage] = useState(1);
    const [maxUnlockedStage, setMaxUnlockedStage] = useState(1);
  
    // Scene generation
    const [seed, setSeed] = useState(1);
    const [primitiveCountRange] = useState([8, 15]);
    const [scenePrimitives, setScenePrimitives] = useState([]);
    const [sceneStats, setSceneStats] = useState({
      primitiveCount: 0,
      vertices: 0,
      triangles: 0,
      bbox: { min: [0, 0, 0], max: [0, 0, 0] },
    });
  
    // Camera rig
    const [cameraCount, setCameraCount] = useState(8);
    const [camResolution, setCamResolution] = useState(128);
    const [virtualCameras, setVirtualCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState(0);
    const [cameraStats, setCameraStats] = useState({});
    const [depthThumbnails, setDepthThumbnails] = useState([]);
  
    // Point cloud
    const [pointCloudsPerCamera, setPointCloudsPerCamera] = useState([]);
    const [fusedPointCloud, setFusedPointCloud] = useState(null);
    const [fusionStats, setFusionStats] = useState({
      perCameraCounts: [],
      fusedCount: 0,
      outlierCount: 0,
    });
  
    // ICP
    const [icpResults, setIcpResults] = useState([]);
    const [icpParams, setIcpParams] = useState({
      maxIterations: 30,
      convergenceThreshold: 1e-5,
      noiseTrans: 0.05,
      noiseRotDeg: 2.0,
    });
    const [icpRunning, setIcpRunning] = useState(false);
    const [icpErrorHistory, setIcpErrorHistory] = useState([]);
  
    // Reconstruction
    const [reconParams, setReconParams] = useState({
      gridResolution: 48,
      radius: 0.2,
      smoothIterations: 3,
    });
    const [reconstructedMesh, setReconstructedMesh] = useState(null);
  
    // Progress/compute state
    const [computeState, setComputeState] = useState({
      stage1: { running: false, progress: 0 },
      stage2: { running: false, progress: 0 },
      stage3: { running: false, progress: 0 },
      stage4: { running: false, progress: 0 },
      stage5: { running: false, progress: 0 },
    });
  
    // Three.js refs
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const animationFrameRef = useRef(null);
  
    // Scene layers
    const primitivesGroupRef = useRef(null);
    const camerasGroupRef = useRef(null);
    const pointCloudGroupRef = useRef(null);
    const reconMeshRef = useRef(null);
  
    // Hover / pick
    const [hoveredPointInfo, setHoveredPointInfo] = useState(null);
  
    // Keyboard shortcuts
    useEffect(() => {
      const onKey = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key >= '1' && e.key <= '5') {
          const s = parseInt(e.key, 10);
          if (s <= maxUnlockedStage) setStage(s);
        } else if (e.key === ' ') {
          e.preventDefault();
          handleRunStage(stage);
        } else if (e.key.toLowerCase() === 'r') {
          resetCamera();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [stage, maxUnlockedStage]);
  
    // Init Three.js
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;
  
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(width, height);
      renderer.setClearColor(0x0f1117, 1);
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;
  
      const scene = new THREE.Scene();
      sceneRef.current = scene;
  
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
      camera.position.set(4, 3, 6);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;
  
      const controls = new SimpleOrbitControls(camera, renderer.domElement);
      controls.target.set(0, 1, 0);
      controls.update();
      controlsRef.current = controls;
  
      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambient);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(5, 10, 7);
      scene.add(dir);
  
      // Grid + axes
      const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
      scene.add(grid);
      const axes = new THREE.AxesHelper(2);
      scene.add(axes);
  
      // Layer groups
      const primitivesGroup = new THREE.Group();
      const camerasGroup = new THREE.Group();
      const pointCloudGroup = new THREE.Group();
      const reconMeshGroup = new THREE.Group();
  
      scene.add(primitivesGroup);
      scene.add(camerasGroup);
      scene.add(pointCloudGroup);
      scene.add(reconMeshGroup);
  
      primitivesGroupRef.current = primitivesGroup;
      camerasGroupRef.current = camerasGroup;
      pointCloudGroupRef.current = pointCloudGroup;
      reconMeshRef.current = reconMeshGroup;
  
      const renderLoop = () => {
        controls.update();
        renderer.render(scene, camera);
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      };
      renderLoop();
  
      const onResize = () => {
        if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        rendererRef.current.setSize(w, h);
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
  
      return () => {
        cancelAnimationFrame(animationFrameRef.current);
        window.removeEventListener('resize', onResize);
        controls.dispose();
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    }, []);
  
    const resetCamera = useCallback(() => {
      if (!cameraRef.current || !controlsRef.current) return;
      cameraRef.current.position.set(4, 3, 6);
      controlsRef.current.target.set(0, 1, 0);
      controlsRef.current.update();
    }, []);
  
    // ---------- Stage 1: Procedural Scene ----------
    const regenerateScene = useCallback(() => {
      const prng = seededRandom(seed || 1);
      const primitives = [];
      let totalVerts = 0;
      let totalTris = 0;
      const min = new THREE.Vector3(Infinity, Infinity, Infinity);
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  
      const count =
        primitiveCountRange[0] +
        Math.floor(prng() * (primitiveCountRange[1] - primitiveCountRange[0] + 1));
  
      const types = ['box', 'sphere', 'cylinder', 'torus', 'cone'];
  
      for (let i = 0; i < count; i++) {
        const type = types[Math.floor(prng() * types.length)];
        const position = [
          (prng() - 0.5) * 6,
          Math.max(0.1, prng() * 2),
          (prng() - 0.5) * 6,
        ];
        const rotation = [prng() * Math.PI, prng() * Math.PI, prng() * Math.PI];
        const s = 0.3 + prng() * 0.8;
        const scale = [s, s, s];
        const color =
          '#' +
          [0, 0, 0]
            .map(() =>
              Math.floor(128 + prng() * 127)
                .toString(16)
                .padStart(2, '0')
            )
            .join('');
  
        let meshData;
        switch (type) {
          case 'box':
            meshData = createBoxMeshData(1, 1, 1);
            break;
          case 'sphere':
            meshData = createSphereMeshData(0.75);
            break;
          case 'cylinder':
            meshData = createCylinderMeshData(0.5, 0.5, 1.5);
            break;
          case 'torus':
            meshData = createTorusMeshData(0.8);
            break;
          case 'cone':
          default:
            meshData = createConeMeshData(0.7, 1.2);
            break;
        }
        applyTransformToMesh(meshData, position, rotation, scale);
  
        // bounding box + stats
        const v = meshData.vertices;
        for (let j = 0; j < v.length; j += 3) {
          const x = v[j];
          const y = v[j + 1];
          const z = v[j + 2];
          min.x = Math.min(min.x, x);
          min.y = Math.min(min.y, y);
          min.z = Math.min(min.z, z);
          max.x = Math.max(max.x, x);
          max.y = Math.max(max.y, y);
          max.z = Math.max(max.z, z);
        }
        const triCount = (meshData.faces ? meshData.faces.length : v.length) / 3;
        totalVerts += v.length / 3;
        totalTris += triCount;
  
        primitives.push({
          type,
          position,
          rotation,
          scale,
          color,
          vertices: meshData.vertices,
          faces: meshData.faces,
          normals: meshData.normals,
        });
      }
  
      // ground plane
      const groundMesh = createBoxMeshData(20, 0.1, 20);
      applyTransformToMesh(groundMesh, [0, -0.05, 0], [0, 0, 0], [1, 1, 1]);
      const gColor = '#222222';
      const gv = groundMesh.vertices;
      for (let j = 0; j < gv.length; j += 3) {
        const x = gv[j];
        const y = gv[j + 1];
        const z = gv[j + 2];
        min.x = Math.min(min.x, x);
        min.y = Math.min(min.y, y);
        min.z = Math.min(min.z, z);
        max.x = Math.max(max.x, x);
        max.y = Math.max(max.y, y);
        max.z = Math.max(max.z, z);
      }
      totalVerts += gv.length / 3;
      totalTris += (groundMesh.faces ? groundMesh.faces.length : gv.length) / 3;
  
      primitives.push({
        type: 'ground',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: gColor,
        vertices: groundMesh.vertices,
        faces: groundMesh.faces,
        normals: groundMesh.normals,
      });
  
      setScenePrimitives(primitives);
      setSceneStats({
        primitiveCount: count,
        vertices: totalVerts,
        triangles: totalTris,
        bbox: { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] },
      });
  
      // Update Three.js primitives
      if (primitivesGroupRef.current) {
        const group = primitivesGroupRef.current;
        while (group.children.length) {
          const obj = group.children.pop();
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        }
        primitives.forEach((p) => {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute(
            'position',
            new THREE.BufferAttribute(p.vertices, 3)
          );
          geom.setAttribute(
            'normal',
            new THREE.BufferAttribute(p.normals, 3)
          );
          if (p.faces) {
            geom.setIndex(new THREE.BufferAttribute(p.faces, 1));
          }
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(p.color),
            metalness: 0.1,
            roughness: 0.8,
          });
          const mesh = new THREE.Mesh(geom, mat);
          group.add(mesh);
        });
      }
    }, [seed, primitiveCountRange]);
  
    useEffect(() => {
      regenerateScene();
    }, [regenerateScene]);
  
    // ---------- Stage 2: Virtual Cameras + Raycasting ----------
    const buildCameraRig = useCallback(() => {
      const cams = [];
      const w = camResolution;
      const h = camResolution;
      const fov = 60;
      const near = 0.1;
      const far = 20;
      const aspect = w / h;
      const fy = 0.5 * h / Math.tan(0.5 * deg2rad(fov));
      const fx = fy * aspect;
      const cx = w / 2;
      const cy = h / 2;
  
      // place on hemisphere
      for (let i = 0; i < cameraCount; i++) {
        const theta = (i / cameraCount) * Math.PI * 2;
        const phi = deg2rad(50 + 20 * Math.sin(i));
        const radius = 8;
        const pos = new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.cos(phi),
          radius * Math.sin(theta) * Math.sin(phi)
        );
        const target = new THREE.Vector3(0, 1, 0);
        const up = new THREE.Vector3(0, 1, 0);
        const z = new THREE.Vector3().subVectors(pos, target).normalize();
        const x = new THREE.Vector3().crossVectors(up, z).normalize();
        const y = new THREE.Vector3().crossVectors(z, x).normalize();
  
        const pose = new Float64Array(16);
        pose[0] = x.x; pose[4] = x.y; pose[8] = x.z; pose[12] = pos.x;
        pose[1] = y.x; pose[5] = y.y; pose[9] = y.z; pose[13] = pos.y;
        pose[2] = z.x; pose[6] = z.y; pose[10] = z.z; pose[14] = pos.z;
        pose[3] = 0;   pose[7] = 0;   pose[11] = 0;  pose[15] = 1;
  
        cams.push({
          id: i,
          resolution: [w, h],
          fov,
          near,
          far,
          pose,
          intrinsics: { fx, fy, cx, cy },
          depthBuffer: new Float32Array(w * h).fill(far),
          normalBuffer: new Float32Array(w * h * 3).fill(0),
          colorBuffer: new Uint8Array(w * h * 3).fill(0),
        });
      }
      setVirtualCameras(cams);
  
      // update frustums in scene
      if (camerasGroupRef.current) {
        const group = camerasGroupRef.current;
        while (group.children.length) {
          const obj = group.children.pop();
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        }
        cams.forEach((cam) => {
          const helperCam = new THREE.PerspectiveCamera(cam.fov, 1, cam.near, cam.far);
          const pose = cam.pose;
          helperCam.matrix.fromArray(pose);
          helperCam.position.set(pose[12], pose[13], pose[14]);
          const m = new THREE.Matrix4().fromArray(pose);
          helperCam.lookAt(0, 1, 0);
          helperCam.updateProjectionMatrix();
          const frustumHelper = new THREE.CameraHelper(helperCam);
          group.add(frustumHelper);
        });
      }
    }, [cameraCount, camResolution]);
  
    const runRaycasting = useCallback(() => {
      if (!scenePrimitives.length || !virtualCameras.length) return;
      const cams = virtualCameras.map((c) => ({
        ...c,
        depthBuffer: new Float32Array(c.resolution[0] * c.resolution[1]).fill(c.far),
        normalBuffer: new Float32Array(c.resolution[0] * c.resolution[1] * 3).fill(0),
        colorBuffer: new Uint8Array(c.resolution[0] * c.resolution[1] * 3).fill(0),
      }));
  
      // flatten triangles
      const tris = [];
      scenePrimitives.forEach((p, idx) => {
        const verts = p.vertices;
        const norms = p.normals;
        const faces = p.faces;
        const col = new THREE.Color(p.color);
        if (faces) {
          for (let i = 0; i < faces.length; i += 3) {
            const i0 = faces[i] * 3;
            const i1 = faces[i + 1] * 3;
            const i2 = faces[i + 2] * 3;
            tris.push({
              v0: new THREE.Vector3(verts[i0], verts[i0 + 1], verts[i0 + 2]),
              v1: new THREE.Vector3(verts[i1], verts[i1 + 1], verts[i1 + 2]),
              v2: new THREE.Vector3(verts[i2], verts[i2 + 1], verts[i2 + 2]),
              n0: new THREE.Vector3(norms[i0], norms[i0 + 1], norms[i0 + 2]),
              n1: new THREE.Vector3(norms[i1], norms[i1 + 1], norms[i1 + 2]),
              n2: new THREE.Vector3(norms[i2], norms[i2 + 1], norms[i2 + 2]),
              color: col,
              primId: idx,
            });
          }
        } else {
          for (let i = 0; i < verts.length; i += 9) {
            tris.push({
              v0: new THREE.Vector3(verts[i], verts[i + 1], verts[i + 2]),
              v1: new THREE.Vector3(verts[i + 3], verts[i + 4], verts[i + 5]),
              v2: new THREE.Vector3(verts[i + 6], verts[i + 7], verts[i + 8]),
              n0: new THREE.Vector3(norms[i], norms[i + 1], norms[i + 2]),
              n1: new THREE.Vector3(norms[i + 3], norms[i + 4], norms[i + 5]),
              n2: new THREE.Vector3(norms[i + 6], norms[i + 7], norms[i + 8]),
              color: col,
              primId: idx,
            });
          }
        }
      });
  
      const totalPixels = cams.reduce(
        (acc, c) => acc + c.resolution[0] * c.resolution[1],
        0
      );
      let processed = 0;
      const batchSize = 4096;
  
      setComputeState((s) => ({
        ...s,
        stage2: { running: true, progress: 0 },
      }));
  
      const processBatch = () => {
        const start = processed;
        const end = Math.min(start + batchSize, totalPixels);
        for (let idx = start; idx < end; idx++) {
          let remaining = idx;
          let camIdx = 0;
          let cam = null;
          while (camIdx < cams.length) {
            const c = cams[camIdx];
            const pixels = c.resolution[0] * c.resolution[1];
            if (remaining < pixels) {
              cam = c;
              break;
            }
            remaining -= pixels;
            camIdx++;
          }
          if (!cam) continue;
          const w = cam.resolution[0];
          const h = cam.resolution[1];
          const px = remaining % w;
          const py = Math.floor(remaining / w);
          const { fx, fy, cx, cy } = cam.intrinsics;
          const nd = cam.depthBuffer;
  
          const pose = cam.pose;
          const camPos = new THREE.Vector3(pose[12], pose[13], pose[14]);
          const R = new THREE.Matrix3();
          R.set(
            pose[0], pose[4], pose[8],
            pose[1], pose[5], pose[9],
            pose[2], pose[6], pose[10]
          );
          // camera view direction -z in camera space
          const dirCam = new THREE.Vector3(
            (px - cx) / fx,
            (py - cy) / fy,
            -1
          ).normalize();
          const dirWorld = dirCam.applyMatrix3(R).normalize();
  
          let bestT = cam.far;
          let bestN = null;
          let bestC = null;
  
          for (let ti = 0; ti < tris.length; ti++) {
            const tri = tris[ti];
            const hit = intersectRayTriangle(
              camPos,
              dirWorld,
              tri.v0,
              tri.v1,
              tri.v2
            );
            if (!hit) continue;
            const t = hit.t;
            if (t < cam.near || t > cam.far) continue;
            if (t < bestT) {
              bestT = t;
              const w0 = 1 - hit.u - hit.v;
              const w1 = hit.u;
              const w2 = hit.v;
              const n = new THREE.Vector3()
                .addScaledVector(tri.n0, w0)
                .addScaledVector(tri.n1, w1)
                .addScaledVector(tri.n2, w2)
                .normalize();
              bestN = n;
              bestC = tri.color;
            }
          }
  
          const pIdx = py * w + px;
          if (bestT < cam.far) {
            nd[pIdx] = bestT;
            cam.normalBuffer[pIdx * 3 + 0] = bestN.x;
            cam.normalBuffer[pIdx * 3 + 1] = bestN.y;
            cam.normalBuffer[pIdx * 3 + 2] = bestN.z;
            cam.colorBuffer[pIdx * 3 + 0] = Math.round(bestC.r * 255);
            cam.colorBuffer[pIdx * 3 + 1] = Math.round(bestC.g * 255);
            cam.colorBuffer[pIdx * 3 + 2] = Math.round(bestC.b * 255);
          }
        }
        processed = end;
        const progress = processed / totalPixels;
        setComputeState((s) => ({
          ...s,
          stage2: { running: processed < totalPixels, progress },
        }));
        if (processed < totalPixels) {
          setTimeout(processBatch, 0);
        } else {
          // finalize
          setVirtualCameras(cams);
  
          // stats & thumbnails
          const stats = {};
          const thumbs = [];
          cams.forEach((c) => {
            const w = c.resolution[0];
            const h = c.resolution[1];
            let valid = 0;
            let minD = c.far;
            let maxD = 0;
            for (let i = 0; i < c.depthBuffer.length; i++) {
              const d = c.depthBuffer[i];
              if (d < c.far) {
                valid++;
                minD = Math.min(minD, d);
                maxD = Math.max(maxD, d);
              }
            }
            stats[c.id] = {
              validPercent: (valid / (w * h)) * 100,
              depthRange: [minD, maxD],
              coverageOverlap: 0, // placeholder
            };
  
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            const imgData = ctx.createImageData(w, h);
            for (let i = 0; i < w * h; i++) {
              const d = c.depthBuffer[i];
              let t = 0;
              if (d < c.far) {
                t = (d - minD) / (maxD - minD + 1e-6);
              }
              // simple colormap (inferno-like approximation)
              const r = Math.round(255 * t);
              const g = Math.round(255 * (1 - t) * 0.7);
              const b = Math.round(255 * (1 - t));
              imgData.data[i * 4 + 0] = r;
              imgData.data[i * 4 + 1] = g;
              imgData.data[i * 4 + 2] = b;
              imgData.data[i * 4 + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
            thumbs.push({ id: c.id, canvas });
          });
          setCameraStats(stats);
          setDepthThumbnails(thumbs);
          setMaxUnlockedStage((m) => Math.max(m, 2));
        }
      };
      processBatch();
    }, [scenePrimitives, virtualCameras]);
  
    // ---------- Stage 3: Point clouds & fusion ----------
    const runPointCloudFusion = useCallback(() => {
      if (!virtualCameras.length) return;
      const perCameraClouds = [];
      const allPoints = [];
      const allNormals = [];
      const allColors = [];
      const allConf = [];
      const allSource = [];
  
      virtualCameras.forEach((cam) => {
        const [w, h] = cam.resolution;
        const { fx, fy, cx, cy } = cam.intrinsics;
        const pose = cam.pose;
        const R = new THREE.Matrix3();
        R.set(
          pose[0], pose[4], pose[8],
          pose[1], pose[5], pose[9],
          pose[2], pose[6], pose[10]
        );
        const t = new THREE.Vector3(pose[12], pose[13], pose[14]);
        const Rinv = new THREE.Matrix3().copy(R).invert();
        const count = w * h;
  
        const camPositions = [];
        const camNormals = [];
        const camColors = [];
        const camConf = [];
  
        for (let i = 0; i < count; i++) {
          const d = cam.depthBuffer[i];
          if (d >= cam.far) continue;
          const px = i % w;
          const py = Math.floor(i / w);
          const x = ((px - cx) / fx) * d;
          const y = ((py - cy) / fy) * d;
          const z = -d;
          const Xcam = new THREE.Vector3(x, y, z);
          const Xworld = Xcam.applyMatrix3(R).add(t);
  
          const nx = cam.normalBuffer[i * 3 + 0];
          const ny = cam.normalBuffer[i * 3 + 1];
          const nz = cam.normalBuffer[i * 3 + 2];
          const nWorld = new THREE.Vector3(nx, ny, nz).applyMatrix3(R).normalize();
  
          const r = cam.colorBuffer[i * 3 + 0];
          const g = cam.colorBuffer[i * 3 + 1];
          const b = cam.colorBuffer[i * 3 + 2];
  
          // confidence based on angle with view direction
          const viewDir = new THREE.Vector3().subVectors(Xworld, t).normalize();
          const conf = Math.max(0, viewDir.dot(nWorld) * -1); // front-facing
  
          camPositions.push(...[Xworld.x, Xworld.y, Xworld.z]);
          camNormals.push(...[nWorld.x, nWorld.y, nWorld.z]);
          camColors.push(...[r, g, b]);
          camConf.push(conf);
  
          allPoints.push(Xworld.x, Xworld.y, Xworld.z);
          allNormals.push(nWorld.x, nWorld.y, nWorld.z);
          allColors.push(r, g, b);
          allConf.push(conf);
          allSource.push(cam.id);
        }
  
        perCameraClouds.push({
          positions: new Float32Array(camPositions),
          normals: new Float32Array(camNormals),
          colors: new Uint8Array(camColors),
          confidence: new Float32Array(camConf),
          sourceCamera: new Uint8Array(camConf.length),
          count: camConf.length,
        });
      });
  
      // voxel grid downsampling
      const voxelSize = 0.05;
      const voxels = new Map();
      for (let i = 0; i < allPoints.length; i += 3) {
        const x = allPoints[i];
        const y = allPoints[i + 1];
        const z = allPoints[i + 2];
        const key = [
          Math.floor(x / voxelSize),
          Math.floor(y / voxelSize),
          Math.floor(z / voxelSize),
        ].join(',');
        let v = voxels.get(key);
        if (!v) {
          v = {
            sumPos: [0, 0, 0],
            sumNorm: [0, 0, 0],
            sumColor: [0, 0, 0],
            sumConf: 0,
            sourceCounts: {},
            count: 0,
          };
          voxels.set(key, v);
        }
        v.sumPos[0] += x;
        v.sumPos[1] += y;
        v.sumPos[2] += z;
        v.sumNorm[0] += allNormals[i];
        v.sumNorm[1] += allNormals[i + 1];
        v.sumNorm[2] += allNormals[i + 2];
        v.sumColor[0] += allColors[i];
        v.sumColor[1] += allColors[i + 1];
        v.sumColor[2] += allColors[i + 2];
        const conf = allConf[i / 3];
        v.sumConf += conf;
        const src = allSource[i / 3];
        v.sourceCounts[src] = (v.sourceCounts[src] || 0) + 1;
        v.count++;
      }
  
      const fusedPos = [];
      const fusedNorm = [];
      const fusedCol = [];
      const fusedConf = [];
      const fusedSrc = [];
  
      voxels.forEach((v) => {
        const c = v.count || 1;
        const pos = v.sumPos.map((s) => s / c);
        const norm = new THREE.Vector3(
          v.sumNorm[0],
          v.sumNorm[1],
          v.sumNorm[2]
        ).normalize();
        const col = v.sumColor.map((s) => s / c);
        const conf = v.sumConf / c;
        let bestSrc = 0;
        let bestCount = -1;
        Object.entries(v.sourceCounts).forEach(([sid, cnt]) => {
          if (cnt > bestCount) {
            bestCount = cnt;
            bestSrc = parseInt(sid, 10);
          }
        });
        fusedPos.push(...pos);
        fusedNorm.push(norm.x, norm.y, norm.z);
        fusedCol.push(...col);
        fusedConf.push(conf);
        fusedSrc.push(bestSrc);
      });
  
      const fused = {
        positions: new Float32Array(fusedPos),
        normals: new Float32Array(fusedNorm),
        colors: new Uint8Array(fusedCol),
        confidence: new Float32Array(fusedConf),
        sourceCamera: new Uint8Array(fusedSrc),
        count: fusedPos.length / 3,
      };
  
      // simple statistical outlier removal using mean distance to neighbors (brute force)
      const k = 8;
      const N = fused.count;
      const meanDistances = new Float32Array(N);
      const tmpA = new THREE.Vector3();
      const tmpB = new THREE.Vector3();
  
      for (let i = 0; i < N; i++) {
        const xi = fused.positions[i * 3 + 0];
        const yi = fused.positions[i * 3 + 1];
        const zi = fused.positions[i * 3 + 2];
        tmpA.set(xi, yi, zi);
        const dists = [];
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const xj = fused.positions[j * 3 + 0];
          const yj = fused.positions[j * 3 + 1];
          const zj = fused.positions[j * 3 + 2];
          tmpB.set(xj, yj, zj);
          dists.push(tmpA.distanceTo(tmpB));
        }
        dists.sort((a, b) => a - b);
        const use = dists.slice(0, Math.min(k, dists.length));
        const md = use.reduce((s, v) => s + v, 0) / use.length;
        meanDistances[i] = md;
      }
      let mu = 0;
      for (let i = 0; i < N; i++) mu += meanDistances[i];
      mu /= N;
      let sigma = 0;
      for (let i = 0; i < N; i++) {
        const d = meanDistances[i] - mu;
        sigma += d * d;
      }
      sigma = Math.sqrt(sigma / N);
      const thresh = mu + 2 * sigma;
  
      const inlierMask = new Uint8Array(N);
      let outlierCount = 0;
      for (let i = 0; i < N; i++) {
        if (meanDistances[i] <= thresh) {
          inlierMask[i] = 1;
        } else {
          inlierMask[i] = 0;
          outlierCount++;
        }
      }
  
      const inPos = [];
      const inNorm = [];
      const inCol = [];
      const inConf = [];
      const inSrc = [];
      const outPos = [];
      for (let i = 0; i < N; i++) {
        const x = fused.positions[i * 3 + 0];
        const y = fused.positions[i * 3 + 1];
        const z = fused.positions[i * 3 + 2];
        if (inlierMask[i]) {
          inPos.push(x, y, z);
          inNorm.push(
            fused.normals[i * 3 + 0],
            fused.normals[i * 3 + 1],
            fused.normals[i * 3 + 2]
          );
          inCol.push(
            fused.colors[i * 3 + 0],
            fused.colors[i * 3 + 1],
            fused.colors[i * 3 + 2]
          );
          inConf.push(fused.confidence[i]);
          inSrc.push(fused.sourceCamera[i]);
        } else {
          outPos.push(x, y, z);
        }
      }
  
      const fusedInliers = {
        positions: new Float32Array(inPos),
        normals: new Float32Array(inNorm),
        colors: new Uint8Array(inCol),
        confidence: new Float32Array(inConf),
        sourceCamera: new Uint8Array(inSrc),
        count: inPos.length / 3,
      };
      setPointCloudsPerCamera(perCameraClouds);
      setFusedPointCloud(fusedInliers);
      setFusionStats({
        perCameraCounts: perCameraClouds.map((c) => c.count),
        fusedCount: fusedInliers.count,
        outlierCount,
      });
      setMaxUnlockedStage((m) => Math.max(m, 3));
  
      // update point clouds in scene (simple fused only, colored by source camera)
      if (pointCloudGroupRef.current) {
        const group = pointCloudGroupRef.current;
        while (group.children.length) {
          const obj = group.children.pop();
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
          'position',
          new THREE.BufferAttribute(fusedInliers.positions, 3)
        );
        const cols = new Float32Array(fusedInliers.count * 3);
        for (let i = 0; i < fusedInliers.count; i++) {
          const src = fusedInliers.sourceCamera[i];
          const t = src / Math.max(1, cameraCount - 1);
          const col = new THREE.Color().setHSL(0.6 * (1 - t), 0.8, 0.6);
          cols[i * 3 + 0] = col.r;
          cols[i * 3 + 1] = col.g;
          cols[i * 3 + 2] = col.b;
        }
        geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        const mat = new THREE.PointsMaterial({
          size: 0.03,
          vertexColors: true,
          sizeAttenuation: true,
        });
        const pts = new THREE.Points(geom, mat);
        group.add(pts);
  
        // outliers in red (optional)
        if (outPos.length) {
          const outGeom = new THREE.BufferGeometry();
          outGeom.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(outPos), 3)
          );
          const outCols = new Float32Array((outPos.length / 3) * 3);
          for (let i = 0; i < outPos.length / 3; i++) {
            outCols[i * 3 + 0] = 1;
            outCols[i * 3 + 1] = 0.3;
            outCols[i * 3 + 2] = 0.1;
          }
          outGeom.setAttribute('color', new THREE.BufferAttribute(outCols, 3));
          const outMat = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            sizeAttenuation: true,
          });
          const outPts = new THREE.Points(outGeom, outMat);
          group.add(outPts);
        }
      }
    }, [virtualCameras, cameraCount]);
  
    // ---------- Stage 4: ICP ----------
    const runICP = useCallback(() => {
      if (!pointCloudsPerCamera.length || !fusedPointCloud) return;
      setIcpRunning(true);
      const { maxIterations, convergenceThreshold, noiseTrans, noiseRotDeg } =
        icpParams;

      const target = fusedPointCloud;
      const results = [];
      const errorHistory = [];

      const targetPoints = [];
      for (let i = 0; i < target.count; i++) {
        targetPoints.push({
          x: target.positions[i * 3 + 0],
          y: target.positions[i * 3 + 1],
          z: target.positions[i * 3 + 2],
          nx: target.normals[i * 3 + 0],
          ny: target.normals[i * 3 + 1],
          nz: target.normals[i * 3 + 2],
        });
      }

      const sourceClouds = pointCloudsPerCamera.map((c) => {
        const pts = [];
        for (let i = 0; i < c.count; i++) {
          pts.push({
            x: c.positions[i * 3 + 0],
            y: c.positions[i * 3 + 1],
            z: c.positions[i * 3 + 2],
          });
        }
        return { raw: c, pts };
      });

      const applyNoise = (pts) => {
        const R = new THREE.Euler(
          deg2rad((Math.random() - 0.5) * 2 * noiseRotDeg),
          deg2rad((Math.random() - 0.5) * 2 * noiseRotDeg),
          deg2rad((Math.random() - 0.5) * 2 * noiseRotDeg)
        );
        const q = new THREE.Quaternion().setFromEuler(R);
        const t = new THREE.Vector3(
          (Math.random() - 0.5) * 2 * noiseTrans,
          (Math.random() - 0.5) * 2 * noiseTrans,
          (Math.random() - 0.5) * 2 * noiseTrans
        );
        const mat = new THREE.Matrix4().compose(
          t,
          q,
          new THREE.Vector3(1, 1, 1)
        );
        const out = pts.map((p) => {
          const v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(mat);
          return { x: v.x, y: v.y, z: v.z };
        });
        return { pts: out, mat };
      };

      const findClosest = (p, targets) => {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          const dx = p.x - t.x;
          const dy = p.y - t.y;
          const dz = p.z - t.z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        return bestIdx;
      };

      const runForCloud = (cloudIdx) => {
        if (cloudIdx >= sourceClouds.length) {
          setIcpResults(results);
          setIcpErrorHistory(errorHistory);
          setIcpRunning(false);
          setMaxUnlockedStage((m) => Math.max(m, 4));
          return;
        }

        const src = sourceClouds[cloudIdx];
        const noise = applyNoise(src.pts);
        let pts = noise.pts;
        let transform = noise.mat.clone();
        const history = [];

        for (let iter = 0; iter < maxIterations; iter++) {
          // correspondences
          const rows = [];
          const residuals = [];
          let rmse = 0;
          let inlierCount = 0;

          for (let i = 0; i < pts.length; i++) {
            const si = pts[i];
            const tiIdx = findClosest(si, targetPoints);
            const ti = targetPoints[tiIdx];
            const n = new THREE.Vector3(ti.nx, ti.ny, ti.nz);
            const sVec = new THREE.Vector3(si.x, si.y, si.z);
            const tVec = new THREE.Vector3(ti.x, ti.y, ti.z);

            const r = sVec.clone().sub(tVec).dot(n);
            residuals.push(r);
            rmse += r * r;
            inlierCount++;

            const cross = new THREE.Vector3().crossVectors(n, sVec);
            rows.push([
              cross.x,
              cross.y,
              cross.z,
              n.x,
              n.y,
              n.z,
            ]);
          }
          rmse = Math.sqrt(rmse / Math.max(1, inlierCount));
          history.push(rmse);
          errorHistory.push({ iter: history.length, error: rmse });

          if (iter > 0 && Math.abs(history[iter] - history[iter - 1]) < convergenceThreshold) {
            results.push({
              transform: transform.toArray(),
              iterations: iter + 1,
              converged: true,
              errorHistory: [...history],
              correspondences: inlierCount,
            });
            break;
          }

          // build JTJ and JTr
          const JTJ = Array(6)
            .fill(0)
            .map(() => Array(6).fill(0));
          const JTr = Array(6).fill(0);
          for (let i = 0; i < rows.length; i++) {
            const J = rows[i];
            const r = residuals[i];
            for (let r1 = 0; r1 < 6; r1++) {
              for (let c1 = 0; c1 < 6; c1++) {
                JTJ[r1][c1] += J[r1] * J[c1];
              }
              JTr[r1] += J[r1] * r;
            }
          }

          // solve JTJ * x = -JTr (simple Gaussian elimination)
          const A = JTJ.map((row, i) => [...row, -JTr[i]]);
          for (let k = 0; k < 6; k++) {
            let maxRow = k;
            for (let i = k + 1; i < 6; i++) {
              if (Math.abs(A[i][k]) > Math.abs(A[maxRow][k])) maxRow = i;
            }
            if (Math.abs(A[maxRow][k]) < 1e-8) continue;
            if (maxRow !== k) {
              const tmp = A[k];
              A[k] = A[maxRow];
              A[maxRow] = tmp;
            }
            const diag = A[k][k];
            for (let j = k; j < 7; j++) A[k][j] /= diag;
            for (let i = 0; i < 6; i++) {
              if (i === k) continue;
              const f = A[i][k];
              for (let j = k; j < 7; j++) A[i][j] -= f * A[k][j];
            }
          }
          const x = A.map((row) => row[6]);
          const wx = x[0];
          const wy = x[1];
          const wz = x[2];
          const tx = x[3];
          const ty = x[4];
          const tz = x[5];

          const dTheta = new THREE.Vector3(wx, wy, wz);
          const angle = dTheta.length();
          let dR = new THREE.Matrix4();
          if (angle > 1e-8) {
            const axis = dTheta.clone().normalize();
            const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
            dR = new THREE.Matrix4().makeRotationFromQuaternion(dq);
          }
          const dT = new THREE.Matrix4().makeTranslation(tx, ty, tz);
          const delta = new THREE.Matrix4().multiplyMatrices(dT, dR);
          transform = delta.multiply(transform);

          pts = pts.map((p) => {
            const v = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(delta);
            return { x: v.x, y: v.y, z: v.z };
          });
        }

        // If we reached the maximum iterations without early convergence, log the result.
        if (history.length === maxIterations) {
          results.push({
            transform: transform.toArray(),
            iterations: maxIterations,
            converged: false,
            errorHistory: [...history],
            correspondences: pts.length,
          });
        }

        // Visualize the final aligned cloud for this camera (overwrites previous ICP overlay).
        if (pointCloudGroupRef.current) {
          const group = pointCloudGroupRef.current;
          const geom = new THREE.BufferGeometry();
          const posArr = new Float32Array(pts.length * 3);
          for (let i = 0; i < pts.length; i++) {
            posArr[i * 3 + 0] = pts[i].x;
            posArr[i * 3 + 1] = pts[i].y;
            posArr[i * 3 + 2] = pts[i].z;
          }
          geom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
          const cols = new Float32Array(pts.length * 3);
          for (let i = 0; i < pts.length; i++) {
            cols[i * 3 + 0] = 0;
            cols[i * 3 + 1] = 1;
            cols[i * 3 + 2] = 1;
          }
          geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
          const mat = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            sizeAttenuation: true,
          });

          // remove previous ICP overlays, but keep the base fused cloud / outliers
          while (group.children.length > 2) {
            const obj = group.children.pop();
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
          }

          const ptsObj = new THREE.Points(geom, mat);
          group.add(ptsObj);
        }

        // Update stage 4 progress based on how many clouds have been processed.
        setComputeState((s) => ({
          ...s,
          stage4: {
            running: cloudIdx + 1 < sourceClouds.length,
            progress: (cloudIdx + 1) / sourceClouds.length,
          },
        }));

        // Move on to the next camera cloud asynchronously.
        setTimeout(() => runForCloud(cloudIdx + 1), 0);
      };

      runForCloud(0);
    }, [pointCloudsPerCamera, fusedPointCloud, icpParams, setComputeState]);

  // ---------- Stage 5: Surface Reconstruction (Marching Cubes) ----------
  const runReconstruction = useCallback(() => {
    if (!fusedPointCloud) return;

    const { gridResolution, radius, smoothIterations } = reconParams;
    const N = fusedPointCloud.count;
    if (!N) return;
    const points = [];
    for (let i = 0; i < N; i++) {
      points.push({
        x: fusedPointCloud.positions[i * 3 + 0],
        y: fusedPointCloud.positions[i * 3 + 1],
        z: fusedPointCloud.positions[i * 3 + 2],
        nx: fusedPointCloud.normals[i * 3 + 0],
        ny: fusedPointCloud.normals[i * 3 + 1],
        nz: fusedPointCloud.normals[i * 3 + 2],
        conf: fusedPointCloud.confidence[i],
      });
    }

    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    points.forEach((p) => {
      min.x = Math.min(min.x, p.x);
      min.y = Math.min(min.y, p.y);
      min.z = Math.min(min.z, p.z);
      max.x = Math.max(max.x, p.x);
      max.y = Math.max(max.y, p.y);
      max.z = Math.max(max.z, p.z);
    });
    const margin = radius * 1.5;
    min.addScalar(-margin);
    max.addScalar(margin);

    const nx = gridResolution;
    const ny = gridResolution;
    const nz = gridResolution;
    const sdf = new Float32Array(nx * ny * nz).fill(0);
    const cellSize = new THREE.Vector3(
      (max.x - min.x) / (nx - 1),
      (max.y - min.y) / (ny - 1),
      (max.z - min.z) / (nz - 1)
    );
    const idx3D = (i, j, k) => i + nx * (j + ny * k);

    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = min.x + i * cellSize.x;
          const y = min.y + j * cellSize.y;
          const z = min.z + k * cellSize.z;
          const p = new THREE.Vector3(x, y, z);
          let num = 0;
          let den = 0;
          points.forEach((pt) => {
            const q = new THREE.Vector3(pt.x, pt.y, pt.z);
            const n = new THREE.Vector3(pt.nx, pt.ny, pt.nz);
            const d = p.distanceTo(q);
            if (d > radius) return;
            const w = (pt.conf || 1) / (d + 1e-3);
            const sdfVal = p.clone().sub(q).dot(n);
            num += w * sdfVal;
            den += w;
          });
          sdf[idx3D(i, j, k)] = den > 0 ? num / den : 1.0;
        }
      }
    }

    const vertices = [];
    const faces = [];
    const isovalue = 0;
    const vertCache = {};
    const lerp = (p1, p2, v1, v2) => {
      const t = (isovalue - v1) / (v2 - v1 + 1e-8);
      return new THREE.Vector3(
        p1.x + t * (p2.x - p1.x),
        p1.y + t * (p2.y - p1.y),
        p1.z + t * (p2.z - p1.z)
      );
    };
    const getVertIndex = (v) => {
      const key = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
      if (vertCache[key] !== undefined) return vertCache[key];
      const idx = vertices.length / 3;
      vertices.push(v.x, v.y, v.z);
      vertCache[key] = idx;
      return idx;
    };

    const cornerPairs = [
      [0, 1], [1, 3], [2, 3], [0, 2], [4, 5], [5, 7], [6, 7], [4, 6],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    for (let k = 0; k < nz - 1; k++) {
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const cubeCorners = [];
          const cubeValues = [];
          for (let dz = 0; dz <= 1; dz++) {
            for (let dy = 0; dy <= 1; dy++) {
              for (let dx = 0; dx <= 1; dx++) {
                const xi = i + dx, yj = j + dy, zk = k + dz;
                cubeCorners.push(new THREE.Vector3(
                  min.x + xi * cellSize.x,
                  min.y + yj * cellSize.y,
                  min.z + zk * cellSize.z
                ));
                cubeValues.push(sdf[idx3D(xi, yj, zk)]);
              }
            }
          }
          let cubeIndex = 0;
          for (let n = 0; n < 8; n++) {
            if (cubeValues[n] < isovalue) cubeIndex |= 1 << n;
          }
          const edges = edgeTable[cubeIndex];
          if (edges === 0) continue;

          const edgeVerts = new Array(12);
          for (let e = 0; e < 12; e++) {
            if (edges & (1 << e)) {
              const [c1, c2] = cornerPairs[e];
              edgeVerts[e] = lerp(cubeCorners[c1], cubeCorners[c2], cubeValues[c1], cubeValues[c2]);
            }
          }
          for (let t = 0; t < 16; t += 3) {
            const a0 = triTable[cubeIndex][t];
            if (a0 === -1) break;
            const a1 = triTable[cubeIndex][t + 1];
            const a2 = triTable[cubeIndex][t + 2];
            const iA = getVertIndex(edgeVerts[a0]);
            const iB = getVertIndex(edgeVerts[a1]);
            const iC = getVertIndex(edgeVerts[a2]);
            faces.push(iA, iB, iC);
          }
        }
      }
    }

    const normals = new Float32Array((vertices.length / 3) * 3).fill(0);
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    for (let i = 0; i < faces.length; i += 3) {
      const ia = faces[i], ib = faces[i + 1], ic = faces[i + 2];
      vA.set(vertices[ia * 3], vertices[ia * 3 + 1], vertices[ia * 3 + 2]);
      vB.set(vertices[ib * 3], vertices[ib * 3 + 1], vertices[ib * 3 + 2]);
      vC.set(vertices[ic * 3], vertices[ic * 3 + 1], vertices[ic * 3 + 2]);
      const n = vB.clone().sub(vA).cross(vC.clone().sub(vA)).normalize();
      [ia, ib, ic].forEach((idx) => {
        normals[idx * 3] += n.x;
        normals[idx * 3 + 1] += n.y;
        normals[idx * 3 + 2] += n.z;
      });
    }
    for (let i = 0; i < normals.length; i += 3) {
      const n = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]).normalize();
      normals[i] = n.x;
      normals[i + 1] = n.y;
      normals[i + 2] = n.z;
    }

    const colors = new Uint8Array((vertices.length / 3) * 3);
    for (let i = 0; i < vertices.length; i += 3) {
      const vx = vertices[i], vy = vertices[i + 1], vz = vertices[i + 2];
      let bestIdx = 0, bestD = Infinity;
      for (let j = 0; j < fusedPointCloud.count; j++) {
        const px = fusedPointCloud.positions[j * 3];
        const py = fusedPointCloud.positions[j * 3 + 1];
        const pz = fusedPointCloud.positions[j * 3 + 2];
        const d = (vx - px) ** 2 + (vy - py) ** 2 + (vz - pz) ** 2;
        if (d < bestD) { bestD = d; bestIdx = j; }
      }
      colors[i] = fusedPointCloud.colors[bestIdx * 3];
      colors[i + 1] = fusedPointCloud.colors[bestIdx * 3 + 1];
      colors[i + 2] = fusedPointCloud.colors[bestIdx * 3 + 2];
    }

    const V = vertices.length / 3;
    const adjacency = Array(V).fill(0).map(() => new Set());
    for (let i = 0; i < faces.length; i += 3) {
      const [a, b, c] = [faces[i], faces[i + 1], faces[i + 2]];
      adjacency[a].add(b); adjacency[a].add(c);
      adjacency[b].add(a); adjacency[b].add(c);
      adjacency[c].add(a); adjacency[c].add(b);
    }
    const vArr = new Float32Array(vertices);
    const lambda = 0.5;
    for (let iter = 0; iter < smoothIterations; iter++) {
      const newV = new Float32Array(vArr.length);
      for (let i = 0; i < V; i++) {
        const neigh = [...adjacency[i]];
        if (!neigh.length) {
          newV[i * 3] = vArr[i * 3];
          newV[i * 3 + 1] = vArr[i * 3 + 1];
          newV[i * 3 + 2] = vArr[i * 3 + 2];
          continue;
        }
        let sx = 0, sy = 0, sz = 0;
        neigh.forEach((j) => {
          sx += vArr[j * 3]; sy += vArr[j * 3 + 1]; sz += vArr[j * 3 + 2];
        });
        sx /= neigh.length; sy /= neigh.length; sz /= neigh.length;
        newV[i * 3] = vArr[i * 3] + lambda * (sx - vArr[i * 3]);
        newV[i * 3 + 1] = vArr[i * 3 + 1] + lambda * (sy - vArr[i * 3 + 1]);
        newV[i * 3 + 2] = vArr[i * 3 + 2] + lambda * (sz - vArr[i * 3 + 2]);
      }
      vArr.set(newV);
    }

    const mesh = {
      vertices: vArr,
      faces: new Uint32Array(faces),
      normals,
      colors,
      vertexCount: vArr.length / 3,
      faceCount: faces.length / 3,
    };
    setReconstructedMesh(mesh);
    setMaxUnlockedStage((m) => Math.max(m, 5));

    if (reconMeshRef.current) {
      const group = reconMeshRef.current;
      while (group.children.length) {
        const obj = group.children.pop();
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
      geom.setIndex(new THREE.BufferAttribute(mesh.faces, 1));
      const colArr = new Float32Array(mesh.vertexCount * 3);
      for (let i = 0; i < mesh.vertexCount; i++) {
        colArr[i * 3] = mesh.colors[i * 3] / 255;
        colArr[i * 3 + 1] = mesh.colors[i * 3 + 1] / 255;
        colArr[i * 3 + 2] = mesh.colors[i * 3 + 2] / 255;
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.1,
        roughness: 0.6,
      });
      group.add(new THREE.Mesh(geom, mat));
    }
  }, [fusedPointCloud, reconParams]);

  const handleRunStage = (s) => {
    if (s === 1) {
      regenerateScene();
      setMaxUnlockedStage((m) => Math.max(m, 1));
    } else if (s === 2) {
      buildCameraRig();
      runRaycasting();
    } else if (s === 3) runPointCloudFusion();
    else if (s === 4) runICP();
    else if (s === 5) runReconstruction();
  };

  const stageNames = [
    'Scene Generation',
    'Multi-View Capture',
    'Point Cloud Fusion',
    'Registration (ICP)',
    'Surface Reconstruction',
  ];
  const globalStats = useMemo(() => ({
    totalPoints: fusedPointCloud ? fusedPointCloud.count : 0,
    totalTriangles: (reconstructedMesh && reconstructedMesh.faceCount) || sceneStats.triangles,
  }), [fusedPointCloud, reconstructedMesh, sceneStats]);

  return (
    <div className="w-full h-screen bg-[#0f1117] text-gray-100 flex flex-col font-sans">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/5 backdrop-blur-xl">
        <div className="flex flex-col">
          <span className="text-sm uppercase tracking-[0.3em] text-cyan-300">3D Scene Perception Pipeline</span>
          <span className="text-lg font-semibold text-white">Stage {stage} — {stageNames[stage - 1]}</span>
        </div>
        <div className="flex items-center gap-3">
          {stageNames.map((name, idx) => {
            const s = idx + 1;
            const completed = s < maxUnlockedStage;
            const active = s === stage;
            const reachable = s <= maxUnlockedStage;
            return (
              <button
                key={s}
                disabled={!reachable}
                onClick={() => setStage(s)}
                className={`relative flex items-center justify-center w-8 h-8 rounded-full border transition
                  ${active ? 'border-cyan-400 bg-cyan-500/20' : completed ? 'border-cyan-500/70 bg-cyan-500/10' : 'border-gray-600 bg-gray-800/60'}
                  ${reachable ? 'hover:scale-105' : 'opacity-40 cursor-not-allowed'}`}
              >
                <span className={`text-xs ${active || completed ? 'text-cyan-200' : 'text-gray-400'}`}>{s}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <div ref={mountRef} className="w-full h-full" style={{ outline: 'none' }} />
          {hoveredPointInfo && (
            <div className="absolute bottom-3 left-3 px-3 py-2 rounded-lg bg-black/70 text-xs text-gray-200 font-mono">
              xyz: {hoveredPointInfo.x?.toFixed(3)}, {hoveredPointInfo.y?.toFixed(3)}, {hoveredPointInfo.z?.toFixed(3)} | cam: {hoveredPointInfo.sourceCamera}
            </div>
          )}
        </div>

        <div className="w-96 border-l border-white/5 bg-white/5 backdrop-blur-2xl flex flex-col p-4 gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 uppercase tracking-[0.2em]">Current Stage</span>
              <span className="text-sm font-semibold text-cyan-300">{stageNames[stage - 1]}</span>
            </div>
            <button
              onClick={() => handleRunStage(stage)}
              className="px-4 py-2 rounded-full bg-cyan-500/90 text-sm font-semibold text-black hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/30"
            >
              Run
            </button>
          </div>
          <div className="h-1 w-full rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-cyan-200 transition-all"
              style={{ width: `${Math.round((computeState[`stage${stage}`]?.progress || 0) * 100)}%` }}
            />
          </div>

          {stage === 1 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase tracking-[0.25em] text-gray-400">Scene Controls</span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value || '1', 10))}
                    className="bg-black/60 border border-white/10 rounded px-2 py-1 w-20 text-xs text-gray-200"
                  />
                  <button onClick={regenerateScene} className="px-3 py-1 rounded-full bg-gray-800/80 text-xs border border-white/10 hover:border-cyan-400 hover:text-cyan-200">
                    Regenerate Scene
                  </button>
                </div>
              </div>
              <div className="border border-white/10 rounded-xl p-3 bg-black/40 text-xs font-mono text-gray-300 space-y-1">
                <div><span className="text-gray-500">Primitives:</span> <span className="text-cyan-300">{sceneStats.primitiveCount}</span></div>
                <div><span className="text-gray-500">Vertices:</span> <span className="text-cyan-300">{sceneStats.vertices.toLocaleString()}</span></div>
                <div><span className="text-gray-500">Triangles:</span> <span className="text-cyan-300">{sceneStats.triangles.toLocaleString()}</span></div>
                <div><span className="text-gray-500">Bounds:</span> <span className="text-cyan-300">[{sceneStats.bbox.min.map((v) => v.toFixed(2)).join(', ')}] → [{sceneStats.bbox.max.map((v) => v.toFixed(2)).join(', ')}]</span></div>
              </div>
            </div>
          )}

          {stage === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase tracking-[0.25em] text-gray-400">Camera Rig</span>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Camera Count</span>
                    <span className="font-mono text-cyan-300">{cameraCount}</span>
                  </div>
                  <input type="range" min={4} max={16} value={cameraCount} onChange={(e) => setCameraCount(parseInt(e.target.value, 10))} className="w-full" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Resolution</span>
                    <span className="font-mono text-cyan-300">{camResolution}²</span>
                  </div>
                  <input type="range" min={64} max={256} step={32} value={camResolution} onChange={(e) => setCamResolution(parseInt(e.target.value, 10))} className="w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-[0.25em] text-gray-400">Depth Maps</span>
                <div className="grid grid-cols-3 gap-2">
                  {depthThumbnails.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedCameraId(t.id)}
                      className={`relative border rounded-lg overflow-hidden ${selectedCameraId === t.id ? 'border-cyan-400' : 'border-white/10'}`}
                    >
                      <img src={t.canvas.toDataURL()} alt={`Depth ${t.id}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-center text-gray-200 font-mono">#{t.id}</span>
                    </button>
                  ))}
                </div>
              </div>
              {cameraStats[selectedCameraId] && (
                <div className="border border-white/10 rounded-xl p-3 bg-black/40 text-xs font-mono text-gray-300 space-y-1">
                  <div><span className="text-gray-500">Camera:</span> <span className="text-cyan-300">#{selectedCameraId}</span></div>
                  <div><span className="text-gray-500">Valid Pixels:</span> <span className="text-cyan-300">{cameraStats[selectedCameraId].validPercent.toFixed(1)}%</span></div>
                  <div><span className="text-gray-500">Depth Range:</span> <span className="text-cyan-300">{cameraStats[selectedCameraId].depthRange[0].toFixed(2)}–{cameraStats[selectedCameraId].depthRange[1].toFixed(2)}</span></div>
                </div>
              )}
            </div>
          )}

          {stage === 3 && (
            <div className="space-y-4">
              <div>
                <span className="text-xs uppercase tracking-[0.25em] text-gray-400">Point Cloud Fusion</span>
                <p className="mt-1 text-xs text-gray-400">Back-projects depth into world space, merges via voxel grid, prunes outliers.</p>
              </div>
              <div className="border border-white/10 rounded-xl p-3 bg-black/40 text-xs font-mono text-gray-300 space-y-1">
                <div><span className="text-gray-500">Points / Camera:</span> <span className="text-cyan-300">{fusionStats.perCameraCounts.map((c) => c.toLocaleString()).join(', ')}</span></div>
                <div><span className="text-gray-500">Fused Points:</span> <span className="text-cyan-300">{fusionStats.fusedCount.toLocaleString()}</span></div>
                <div><span className="text-gray-500">Outliers:</span> <span className="text-amber-300">{fusionStats.outlierCount.toLocaleString()}</span></div>
              </div>
            </div>
          )}

          {stage === 4 && (
            <div className="space-y-4">
              <div><span className="text-xs uppercase tracking-[0.25em] text-gray-400">ICP Registration</span></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Max Iterations</span>
                  <span className="font-mono text-cyan-300">{icpParams.maxIterations}</span>
                </div>
                <input type="range" min={5} max={60} value={icpParams.maxIterations} onChange={(e) => setIcpParams((p) => ({ ...p, maxIterations: parseInt(e.target.value, 10) }))} className="w-full" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Pose Noise (trans)</span>
                  <span className="font-mono text-cyan-300">{icpParams.noiseTrans.toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={0.2} step={0.01} value={icpParams.noiseTrans} onChange={(e) => setIcpParams((p) => ({ ...p, noiseTrans: parseFloat(e.target.value) }))} className="w-full" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Pose Noise (rot °)</span>
                  <span className="font-mono text-cyan-300">{icpParams.noiseRotDeg.toFixed(1)}</span>
                </div>
                <input type="range" min={0} max={10} step={0.5} value={icpParams.noiseRotDeg} onChange={(e) => setIcpParams((p) => ({ ...p, noiseRotDeg: parseFloat(e.target.value) }))} className="w-full" />
              </div>
              <div className="h-40 border border-white/10 rounded-xl bg-black/40 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={icpErrorHistory}>
                    <XAxis dataKey="iter" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(148,163,184,0.3)', fontSize: 10 }} />
                    <Line type="monotone" dataKey="error" stroke="#22d3ee" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-gray-500">{icpRunning ? 'ICP running.' : 'Run ICP to perturb and re-align each camera cloud.'}</p>
            </div>
          )}

          {stage === 5 && (
            <div className="space-y-4">
              <div><span className="text-xs uppercase tracking-[0.25em] text-gray-400">Surface Reconstruction</span></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Grid Resolution</span>
                  <span className="font-mono text-cyan-300">{reconParams.gridResolution}³</span>
                </div>
                <input type="range" min={32} max={80} step={8} value={reconParams.gridResolution} onChange={(e) => setReconParams((p) => ({ ...p, gridResolution: parseInt(e.target.value, 10) }))} className="w-full" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">SDF Radius</span>
                  <span className="font-mono text-cyan-300">{reconParams.radius.toFixed(2)}</span>
                </div>
                <input type="range" min={0.1} max={0.5} step={0.05} value={reconParams.radius} onChange={(e) => setReconParams((p) => ({ ...p, radius: parseFloat(e.target.value) }))} className="w-full" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Smooth Iterations</span>
                  <span className="font-mono text-cyan-300">{reconParams.smoothIterations}</span>
                </div>
                <input type="range" min={0} max={5} step={1} value={reconParams.smoothIterations} onChange={(e) => setReconParams((p) => ({ ...p, smoothIterations: parseInt(e.target.value, 10) }))} className="w-full" />
              </div>
              {reconstructedMesh && (
                <div className="border border-white/10 rounded-xl p-3 bg-black/40 text-xs font-mono text-gray-300 space-y-1">
                  <div><span className="text-gray-500">Vertices:</span> <span className="text-cyan-300">{reconstructedMesh.vertexCount.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Faces:</span> <span className="text-cyan-300">{reconstructedMesh.faceCount.toLocaleString()}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-12 border-t border-white/5 bg-black/60 backdrop-blur-xl flex items-center justify-between px-4 text-xs text-gray-300 font-mono">
        <div className="flex items-center gap-2">
          <button onClick={() => setStage((s) => Math.max(1, s - 1))} className="px-2 py-1 rounded-full border border-white/10 bg-white/5 hover:border-cyan-400">←</button>
          <div className="flex gap-1">
            {stageNames.map((name, idx) => {
              const s = idx + 1;
              return (
                <button
                  key={s}
                  onClick={() => s <= maxUnlockedStage && setStage(s)}
                  className={`px-2 py-1 rounded-full border text-[11px] ${s === stage ? 'border-cyan-400 text-cyan-200 bg-cyan-500/20' : s <= maxUnlockedStage ? 'border-white/10 text-gray-300 bg-white/5' : 'border-white/5 text-gray-500 bg-black/20'}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <button onClick={() => setStage((s) => Math.min(5, s + 1))} className="px-2 py-1 rounded-full border border-white/10 bg-white/5 hover:border-cyan-400">→</button>
        </div>
        <div className="flex items-center gap-4">
          <span>pts: <span className="text-cyan-300">{globalStats.totalPoints.toLocaleString()}</span></span>
          <span>tris: <span className="text-cyan-300">{globalStats.totalTriangles.toLocaleString()}</span></span>
          <span className="text-gray-500">[1–5] stages, [Space] run, [R] reset cam</span>
        </div>
      </div>
    </div>
  );
});
export default ScenePerceptionApp;