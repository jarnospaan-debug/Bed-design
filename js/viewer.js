// 3D-weergave van kamer, bestaande meubels, gescande ruimte en het bed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { wallFrame, bedFootprint, clearRect } from './room.js';

const FINISH = { olie: 0xd8b585, wit: 0xefebe3, zwart: 0x2e2c2a };

export class Viewer {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 10, 100000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 2.2));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.3);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.6);
    this.fill.position.set(-1, 0.6, 0.4);
    this.scene.add(this.fill);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.roomGroup = new THREE.Group();
    this.bedGroup = new THREE.Group();
    this.scanGroup = new THREE.Group();
    this.measureGroup = new THREE.Group();
    this.scene.add(this.roomGroup, this.bedGroup, this.scanGroup, this.measureGroup);

    this.scan = null;
    this.scanOpts = { unit: 1000, rot: 0, x: 0, z: 0 };
    this.measuring = false;
    this.points = [];
    this.onMeasure = () => {};
    this.setupPointer();

    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.el.offsetParent) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setDark(dark) {
    this.scene.background = new THREE.Color(dark ? 0x1b1f1e : 0xe9ece9);
  }

  update(room, bed, opts) {
    this.room = room; this.bed = bed;
    this.buildRoom(room, opts);
    this.buildBed(bed, room.bed, opts);
    const s = this.sun;
    s.position.set(room.w * 0.2, room.h * 2.2, room.l * 1.3);
    s.target.position.set(room.w / 2, 0, room.l / 2);
    const r = Math.max(room.w, room.l);
    Object.assign(s.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 100, far: r * 6 });
    s.shadow.camera.updateProjectionMatrix();
  }

  buildRoom(room, opts) {
    const g = this.roomGroup;
    g.clear();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(room.w, room.l), new THREE.MeshStandardMaterial({ color: 0xc9bba6, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(room.w / 2, 0, room.l / 2);
    floor.receiveShadow = true;
    floor.userData.measurable = true;
    g.add(floor);
    const gpos = [];
    for (let x = 500; x < room.w; x += 500) gpos.push(x, 1, 0, x, 1, room.l);
    for (let z = 500; z < room.l; z += 500) gpos.push(0, 1, z, room.w, 1, z);
    const ggeo = new THREE.BufferGeometry();
    ggeo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    g.add(new THREE.LineSegments(ggeo, new THREE.LineBasicMaterial({ color: 0x9c907e, transparent: true, opacity: 0.45 })));

    if (opts.walls) {
      const wallColors = { achter: 0x9aab78, voor: 0xf2f1ec, links: 0xf2f1ec, rechts: 0xe9e4d4 };
      for (const name of ['achter', 'voor', 'links', 'rechts']) {
        const f = wallFrame(room, name);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(f.len, room.h), new THREE.MeshStandardMaterial({ color: wallColors[name], roughness: 1 }));
        this.placeOnWall(m, f, f.len / 2, room.h / 2, 0);
        m.receiveShadow = true;
        m.userData.measurable = true;
        g.add(m);
      }
      for (const win of room.windows) {
        const f = wallFrame(room, win.wall);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.width, win.height), new THREE.MeshStandardMaterial({ color: 0xbcd6e6, roughness: 0.2, metalness: 0.1 }));
        this.placeOnWall(glass, f, win.offset + win.width / 2, win.sill + win.height / 2, 3);
        g.add(glass);
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(win.width + 60, win.height + 60), new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.6 }));
        this.placeOnWall(frame, f, win.offset + win.width / 2, win.sill + win.height / 2, 1.5);
        g.add(frame);
      }
      const d = room.door, f = wallFrame(room, d.wall);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(d.width, 2015), new THREE.MeshStandardMaterial({ color: 0xfbfbf8, roughness: 0.6 }));
      this.placeOnWall(door, f, d.offset + d.width / 2, 1007, 3);
      g.add(door);
      const dframe = new THREE.Mesh(new THREE.PlaneGeometry(d.width + 60, 2045), new THREE.MeshStandardMaterial({ color: 0xa9a59c, roughness: 0.6 }));
      this.placeOnWall(dframe, f, d.offset + d.width / 2, 1022, 1.5);
      g.add(dframe);
    }

    // Draaicirkel deur
    {
      const d = room.door, f = wallFrame(room, d.wall);
      const hinge = [f.o[0] + f.u[0] * d.offset, f.o[1] + f.u[1] * d.offset];
      const pos = [];
      const N = 24;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI / 2, a1 = ((i + 1) / N) * Math.PI / 2;
        const p = a => [hinge[0] + (Math.cos(a) * f.u[0] + Math.sin(a) * f.n[0]) * d.width, hinge[1] + (Math.cos(a) * f.u[1] + Math.sin(a) * f.n[1]) * d.width];
        const [x0, z0] = p(a0), [x1, z1] = p(a1);
        pos.push(hinge[0], 2, hinge[1], x1, 2, z1, x0, 2, z0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xd9a400, transparent: true, opacity: 0.25, side: THREE.DoubleSide })));
    }

    if (opts.furniture) {
      for (const f of room.furniture) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, f.d), new THREE.MeshStandardMaterial({ color: 0xf4f4f1, roughness: 0.8, transparent: true, opacity: 0.85 }));
        m.position.set(f.x + f.w / 2, f.h / 2, f.z + f.d / 2);
        m.castShadow = m.receiveShadow = true;
        m.userData.measurable = true;
        g.add(m);
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x8c8f8c }));
        e.position.copy(m.position);
        g.add(e);
        const c = clearRect(f);
        if (c) {
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(c.x1 - c.x0, c.z1 - c.z0), new THREE.MeshBasicMaterial({ color: 0x5b7fb8, transparent: true, opacity: 0.18 }));
          pl.rotation.x = -Math.PI / 2;
          pl.position.set((c.x0 + c.x1) / 2, 3, (c.z0 + c.z1) / 2);
          g.add(pl);
        }
      }
    }
  }

  placeOnWall(obj, f, along, y, inset) {
    obj.position.set(f.o[0] + f.u[0] * along + f.n[0] * inset, y, f.o[1] + f.u[1] * along + f.n[1] * inset);
    obj.lookAt(obj.position.x + f.n[0], y, obj.position.z + f.n[1]);
  }

  buildBed(bed, place, opts) {
    const outerG = this.bedGroup;
    outerG.clear();
    const inner = new THREE.Group();
    outerG.add(inner);
    const woodColor = new THREE.Color(FINISH[bed.cfg.finish] ?? FINISH.olie);
    let k = 0;
    for (const p of bed.parts) {
      const c = woodColor.clone().offsetHSL(0, 0, ((k++ * 37) % 7 - 3) * 0.008);
      const mat = new THREE.MeshStandardMaterial({ color: p.bought ? 0xc7a477 : c, roughness: 0.75 });
      inner.add(this.box(p, mat));
    }
    const steel = new THREE.MeshStandardMaterial({ color: 0x6d7275, metalness: 0.6, roughness: 0.4 });
    for (const h of bed.hw) inner.add(this.box(h, steel));
    if (opts.mattress) {
      const m = bed.byId.mattress;
      inner.add(this.box(m, new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 1 })));
    }
    inner.rotation.y = (place.rot * Math.PI) / 180;
    outerG.position.set(0, 0, 0);
    outerG.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(inner);
    const fp = bedFootprint(bed, place);
    outerG.position.set(fp.x0 - b.min.x, 0, fp.z0 - b.min.z);
  }

  box(p, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...p.size), mat);
    m.position.set(p.min[0] + p.size[0] / 2, p.min[1] + p.size[1] / 2, p.min[2] + p.size[2] / 2);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  view(mode) {
    const r = this.room;
    if (!r) return;
    if (mode === 'top') {
      this.camera.position.set(r.w / 2, Math.max(r.w, r.l) * 1.9, r.l / 2 + 1);
      this.controls.target.set(r.w / 2, 0, r.l / 2);
    } else if (mode === 'bed') {
      const b = new THREE.Box3().setFromObject(this.bedGroup);
      const c = b.getCenter(new THREE.Vector3());
      this.camera.position.set(c.x + 1900, 1700, c.z + 2300);
      this.controls.target.copy(c);
    } else {
      this.camera.position.set(r.w * 1.75, r.h * 2.1, r.l * 1.25);
      this.controls.target.set(r.w / 2, 600, r.l / 2);
    }
    this.controls.update();
  }

  // --- Scan -----------------------------------------------------------
  async loadScan(file) {
    const name = file.name.toLowerCase();
    const buf = await file.arrayBuffer();
    let obj;
    if (name.endsWith('.obj')) {
      obj = new OBJLoader().parse(new TextDecoder().decode(buf));
    } else {
      const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
      obj = gltf.scene;
    }
    obj.traverse(o => {
      if (o.isMesh) {
        o.userData.measurable = true;
        o.receiveShadow = true;
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.side = THREE.DoubleSide; });
      }
    });
    this.scan = obj;
    this.scanGroup.clear();
    this.scanGroup.add(obj);
    this.applyScan();
    return this.scanSize();
  }

  setScanOpts(o) { Object.assign(this.scanOpts, o); this.applyScan(); }

  applyScan() {
    if (!this.scan) return;
    const g = this.scanGroup, o = this.scanOpts;
    g.scale.setScalar(o.unit);
    g.rotation.y = (o.rot * Math.PI) / 180;
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(this.scan);
    g.position.set(-b.min.x + o.x, -b.min.y, -b.min.z + o.z);
  }

  scanSize() {
    if (!this.scan) return null;
    const b = new THREE.Box3().setFromObject(this.scan);
    const s = b.getSize(new THREE.Vector3());
    return { w: Math.round(s.x), l: Math.round(s.z), h: Math.round(s.y) };
  }

  clearScan() { this.scan = null; this.scanGroup.clear(); }

  // --- Meten -----------------------------------------------------------
  setupPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!this.measuring || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = el.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const targets = [];
      this.scene.traverse(o => { if (o.isMesh && o.userData.measurable) targets.push(o); });
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) return;
      if (this.points.length === 2) this.clearMeasure();
      this.points.push(hit.point.clone());
      const dot = new THREE.Mesh(new THREE.SphereGeometry(18), new THREE.MeshBasicMaterial({ color: 0xe0a800 }));
      dot.position.copy(hit.point);
      this.measureGroup.add(dot);
      if (this.points.length === 2) {
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.points), new THREE.LineBasicMaterial({ color: 0xe0a800, depthTest: false }));
        this.measureGroup.add(line);
        this.onMeasure(this.points[0].distanceTo(this.points[1]));
      } else this.onMeasure(null);
    });
  }

  clearMeasure() { this.points = []; this.measureGroup.clear(); }
}
