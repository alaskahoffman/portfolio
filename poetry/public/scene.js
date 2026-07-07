// ============================================================
// POEM·MATIC — the handheld itself. A cel-shaded flat-toon body
// (no outlines) lit almost entirely by its own screen: the LCD
// canvas app.js draws is re-used here as an emissive texture AND
// sampled to drive a blue point light, so typing makes real light
// move on the plastic. Bloom does the dark-room glow. The camera
// drifts faintly; the DOM face (textarea/LCD/labels) rides a
// CSS3DObject with the same camera, so text stays clickable.
// Coordinates: face div 1000×1320px == 100×132 units (scale 0.1),
// x_u=(px-500)/10, y_u=(660-py)/10. app.js talks through window.PM.
// ============================================================
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

const faceEl = document.getElementById("device");

// ---- renderers ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000); // true black void — the DEVICE carries the detail,
// never the wall (any non-black clear color ends up brighter than the plastic)
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("webgl").appendChild(renderer.domElement);

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(innerWidth, innerHeight);
document.getElementById("css3d").appendChild(cssRenderer.domElement);
cssRenderer.domElement.style.pointerEvents = "none";

const scene = new THREE.Scene();
const cssScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 1, 1200);
// back the camera off far enough that the whole device (±58 × ±74 with
// margin) fits whichever axis is tighter
let camZ = 252;
function frameCamera() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const th = tv * camera.aspect;
  camZ = Math.max(76 / tv, 58 / th) + 14;
}
frameCamera();

// ---- materials --------------------------------------------------------------------
// MeshStandardMaterial (matte plastic) so the screen can be a true RectAreaLight —
// rectangular, even light instead of point-light circles.
// aged yellow-grey plastic (Sharp/Otaki putty tones, kept dark); the red key is
// plain pigmented plastic — no emissive
const std = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.03 });

const MAT = {
  body:  std(0x353024),
  frame: std(0x211d14),
  knob:  std(0x3d382b),
  knobFace: std(0x302b21),
  key:   std(0x4a4536),
  red:   std(0x9a2a22),
  glass: new THREE.MeshBasicMaterial({ color: 0x04070a }),
};

// ---- the body -------------------------------------------------------------------
const device = new THREE.Group();
scene.add(device);

// the body: a back slab whose front face (z 5) is the key-recess floor, and
// ONE seamless fascia extruded from a single outline with a notch cut out of
// its bottom edge (x ±28.5, up to y −46) — no part lines radiating from the
// slot, no lip below it. The keys themselves finish the bottom edge.
const backSlab = new THREE.Mesh(new RoundedBoxGeometry(104, 136, 21, 5, 6), MAT.body);
backSlab.position.set(0, 0, -5.5); // z −16…5
device.add(backSlab);
{
  // the key notch sits OFFSET LEFT like a cassette deck's transport block;
  // the right side keeps solid fascia for the dial cluster
  const W = 52, H = 68, R = 6, NL = -47, NR = 17, NY = -42;
  const s = new THREE.Shape();
  s.moveTo(-W + R, -H);
  s.lineTo(NL, -H);
  s.lineTo(NL, NY); // up the notch's left wall
  s.lineTo(NR, NY); // across, under the printed labels
  s.lineTo(NR, -H); // down the right wall
  s.lineTo(W - R, -H);
  s.absarc(W - R, -H + R, R, -Math.PI / 2, 0, false);
  s.lineTo(W, H - R);
  s.absarc(W - R, H - R, R, 0, Math.PI / 2, false);
  s.lineTo(-W + R, H);
  s.absarc(-W + R, H - R, R, Math.PI / 2, Math.PI, false);
  s.lineTo(-W, -H + R);
  s.absarc(-W + R, -H + R, R, Math.PI, Math.PI * 1.5, false);

  // speaker grille: REAL holes drilled through the fascia extrusion, with a
  // shallow floor plate behind them (below). L-shaped field (per the user's
  // sketch): a wide strip under the glass running to the right edge, and a
  // block beside the logo, stepped where they meet.
  for (let r = 0; r < 7; r++) {
    const y = -18 - r * 2.2;
    const xmax = r < 4 ? 45 : 15 - (r - 4) * 1.2;
    for (let x = -2 + (r % 2) * 1.1; x <= xmax; x += 2.2) {
      const p = new THREE.Path();
      p.absarc(x, y, 0.62, 0, Math.PI * 2, true); // clockwise = hole
      s.holes.push(p);
    }
  }

  const fascia = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: false }),
    MAT.body,
  );
  fascia.position.z = 5; // front face flush at z 13
  device.add(fascia);

  // grille floor: a plate just behind the perforations so the holes read
  // SHALLOW (≈1.6 deep) instead of dropping 8 units to the back slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(52, 22, 1), MAT.frame);
  floor.position.set(21.5, -25, 10.9); // front face at z 11.4
  device.add(floor);
}

// the display frame is a REAL frame — four bars around an open hole, so the
// emissive LCD plane behind it is actually visible (a solid box front face
// would occlude it and eat the glow)
{
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), MAT.frame);
    m.position.set(x, y, 12); // spans z 9..15, glass recessed at 14.2
    device.add(m);
  };
  bar(92, 3, 0, 60.5);   // top
  bar(92, 3, 0, -11.5);  // bottom — the glass runs 12 units deeper now
  bar(3, 70, -44.5, 24); // left
  bar(3, 70, 44.5, 24);  // right
}

const glassPlane = new THREE.Mesh(new THREE.PlaneGeometry(87, 71), MAT.glass);
glassPlane.position.set(0, 24, 14.2);
device.add(glassPlane);

// the LCD canvas as an emissive surface — this is what blooms and "lights the room"
const lcdTex = new THREE.CanvasTexture(PM.lcd);
lcdTex.colorSpace = THREE.SRGBColorSpace;
lcdTex.minFilter = THREE.LinearFilter;
lcdTex.magFilter = THREE.LinearFilter;
const lcdMat = new THREE.MeshBasicMaterial({ map: lcdTex, transparent: true });
const lcdPlane = new THREE.Mesh(new THREE.PlaneGeometry(84, 68), lcdMat);
lcdPlane.position.set(0, 24, 14.3); // DOM face rides at 14.35, pixel-registered
device.add(lcdPlane);

// ---- maker's mark: ARcH Squire, silkscreened on the fascia ------------------------
// the PNG is dark art on white — converted at load to pale ink on transparency,
// then applied as a LIT decal plane (StandardMaterial), so the print shades
// with the screen light and room ambient like real paint on plastic
{
  const img = new Image();
  img.src = "/squire/archsquire-01.png";
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const lum = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
      // ink = where the source is both present (alpha) AND dark — handles
      // dark-on-transparent and dark-on-white art alike
      d.data[i + 3] = (d.data[i + 3] * (255 - lum)) / 255;
      d.data[i] = 216; d.data[i + 1] = 207; d.data[i + 2] = 188; // putty ink
    }
    x.putImageData(d, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(54, 54 * img.height / img.width),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.92, metalness: 0 }),
    );
    decal.position.set(-17, -26, 13.05); // the blank strip between glass and levers
    device.add(decal);
  };
}

// ---- knobs: a small 2×2 dial cluster on the right-side fascia --------------------
const KNOB_POS = [
  [27, -34], [43, -34],  // METER  RHYME
  [27, -52], [43, -52],  // TERSE  LENGTH
];
const KNOB_R = 5.5;
const knobGroups = [];
PM.KNOBS.forEach((k, i) => {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(KNOB_R, KNOB_R, 7, 18, 1).rotateX(Math.PI / 2),
    MAT.knob,
  );
  barrel.material = MAT.knob.clone();
  barrel.material.flatShading = true; // faceted sides catch the stepped light
  const cap = new THREE.Mesh(new THREE.CircleGeometry(KNOB_R - 0.5, 24), MAT.knobFace);
  cap.position.z = 3.55;
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 2.6, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x3f88b8 }),
  );
  needle.position.set(0, 3.5, 3.8);
  g.add(barrel, cap, needle);
  g.position.set(KNOB_POS[i][0], KNOB_POS[i][1], 16.5); // barrel front at z 20
  g.userData = { act: "knob", k };
  device.add(g);
  knobGroups.push(g);
});

// ---- piano keys: teeth that ARE the bottom edge ------------------------------------
// 13 wide on a 14 pitch (1-unit gaps), spanning the notch from under its lip
// (y −46) all the way to the device's bottom line (y −68) — no plastic below
// them. Buried to 1 unit proud of the fascia. Hinged at the top edge;
// pressing swings the bottom back into the slot. UNDO / COPY / CLR / red WRITE.
const keyGeo = new RoundedBoxGeometry(15, 26, 8, 3, 0.6);
const KEYS = [
  { x: -39, act: "undo" },
  { x: -23, act: "copy" },
  { x: -7,  act: "clear" },
];
const HINGE_Y = -42, HINGE_Z = 9, KEY_DROP = 13; // key spans y −42…−68, z 5…13: face flush with the fascia
const makeLever = (x, mat, act) => {
  const pivot = new THREE.Group();
  pivot.position.set(x, HINGE_Y, HINGE_Z);
  const m = new THREE.Mesh(keyGeo, mat);
  m.position.set(0, -KEY_DROP, 0);
  pivot.add(m);
  pivot.userData = { act, restRX: 0, pressRX: 0.18 };
  device.add(pivot);
  return pivot;
};
const keyMeshes = KEYS.map(({ x, act }) => makeLever(x, MAT.key, act));
const redBtn = makeLever(9, MAT.red, "fire");

// ---- lights: ONLY the screen's LEDs — no ambient, no fill, no cheating -----------
// the screen is a true area light: three RectAreaLight strips stacked down the
// glass (one per LCD band, each driven by its band's lit-cell density), so the
// light is RECTANGULAR like the panel itself — no point-light circles. Each
// strip is angled slightly downward so the face below the screen catches it.
// pale blue rather than saturated: a yellow-grey body under pure-blue light
// can only ever reflect blue
// ...plus the ROOM itself: a barely-warm ambient, nighttime spill from
// somewhere off-frame. Not tied to the device's power — it's always there.
scene.add(new THREE.AmbientLight(0xe9ddcd, 0.11));

RectAreaLightUniformsLib.init();
// the three strips FAN like a real radiating panel: the top one tilts up
// (so the plastic above the glass catches its spill), the middle fires
// straight out, the bottom washes down over the controls
const bandLights = [
  { y: 47, aim: +32 },
  { y: 24, aim: -6 },
  { y: 1,  aim: -32 },
].map(({ y, aim }) => {
  const l = new THREE.RectAreaLight(0x8ec4ea, 0, 84, 19);
  l.position.set(0, y, 16);
  l.lookAt(0, y + aim, 110);
  scene.add(l);
  return l;
});
// and two narrow strips along the glass edges, angled outward, so the side
// margins of the fascia catch a little spill too (dimmer than the bottom —
// the UX lives down there — but never dead black)
const sideLights = [-1, 1].map((dir) => {
  const l = new THREE.RectAreaLight(0x8ec4ea, 0, 18, 68);
  l.position.set(dir * 38, 24, 16);
  l.lookAt(dir * 74, 24, 110);
  scene.add(l);
  return l;
});
// RectAreaLight cannot cast shadows in three.js — so a wide soft SpotLight
// sits AT the screen carrying part of the same light, purely to give the
// knobs and keys real occlusion (shadows thrown down the fascia)
// first-bounce fill: the screen's light returning off the room/viewer in
// front of the device — this is why knob faces are never pitch black in real
// life. Intensity tracks the screen (it IS screen light, once removed).
const bounce = new THREE.DirectionalLight(0xafc3d2, 0);
bounce.position.set(30, -40, 220); // from the viewer's side, slightly low
scene.add(bounce);

const shadowSpot = new THREE.SpotLight(0x8ec4ea, 0, 0, Math.PI / 2.3, 1, 2);
shadowSpot.position.set(0, 28, 26);
shadowSpot.target.position.set(0, -60, 12);
shadowSpot.castShadow = true;
shadowSpot.shadow.mapSize.set(1024, 1024);
shadowSpot.shadow.camera.near = 5;
shadowSpot.shadow.camera.far = 260;
shadowSpot.shadow.bias = -0.0004;
scene.add(shadowSpot, shadowSpot.target);
device.traverse((o) => {
  if (o.isMesh && o.material !== MAT.glass && o !== lcdPlane) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});

// ---- bloom (the dark-room glow) --------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.7, 0.28);
composer.addPass(bloom);
// dirty light: animated grain that scales with luminance (dark stays dark)
composer.addPass(new FilmPass(0.55));
composer.addPass(new OutputPass());

// ---- the DOM face rides the same camera ------------------------------------------
const faceObj = new CSS3DObject(faceEl);
faceObj.scale.setScalar(0.1);
faceObj.position.set(0, 0, 14.35);
cssScene.add(faceObj);
// CSS3DObject force-sets pointerEvents:auto inline — undo it, or the face
// plane swallows every click meant for the knobs/buttons beneath it
faceEl.style.pointerEvents = "none";

// ---- interaction: raycast into PM -------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const targets = [...knobGroups, ...keyMeshes, redBtn];

function hitAt(ev) {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(targets, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.act) o = o.parent;
    if (o) return o;
  }
  return null;
}
const overFace = (ev) => ev.target && ev.target.closest && ev.target.closest(".face");

let drag = null; // { k, startY, startV }
const pressed = new Map(); // mesh -> release timestamp

addEventListener("pointerdown", (ev) => {
  if (overFace(ev)) return;
  const o = hitAt(ev);
  if (!o) return;
  const { act } = o.userData;
  if (act === "knob") {
    drag = { k: o.userData.k, startY: ev.clientY, startV: o.userData.k.value };
  } else if (act === "fire") {
    pressed.set(o, performance.now() + 160);
    PM.fire();
  } else {
    pressed.set(o, performance.now() + 120);
    PM.keySnd(act);
    if (act === "undo") PM.doUndo();
    else if (act === "copy") PM.doCopy();
    else if (act === "clear") PM.doClear();
  }
});
addEventListener("pointermove", (ev) => {
  if (drag) {
    const k = drag.k;
    PM.knobSet(k, drag.startV + (drag.startY - ev.clientY) * ((k.max - k.min) / 220));
    return;
  }
  if (overFace(ev)) { document.body.style.cursor = ""; return; }
  const o = hitAt(ev);
  document.body.style.cursor = o ? (o.userData.act === "knob" ? "ns-resize" : "pointer") : "";
});
addEventListener("pointerup", () => { drag = null; });
addEventListener("wheel", (ev) => {
  if (overFace(ev)) return;
  const o = hitAt(ev);
  if (o && o.userData.act === "knob") {
    ev.preventDefault();
    const k = o.userData.k;
    PM.knobSet(k, k.value + (ev.deltaY < 0 ? k.step : -k.step) * 2);
  }
}, { passive: false });
addEventListener("dblclick", (ev) => {
  if (overFace(ev)) return;
  const o = hitAt(ev);
  if (o && o.userData.act === "knob") PM.knobSet(o.userData.k, o.userData.k.def);
});

// ---- screen brightness → light intensity ------------------------------------------
const probe = document.createElement("canvas");
probe.width = probe.height = 8;
const probeCtx = probe.getContext("2d", { willReadFrequently: true });
const bands = [0.1, 0.1, 0.1]; // lit-cell density: top / middle / bottom of the glass
let lastProbe = 0;
function sampleBrightness(now) {
  if (now - lastProbe < 150) return;
  lastProbe = now;
  try {
    probeCtx.clearRect(0, 0, 8, 8);
    probeCtx.drawImage(PM.lcd, 0, 0, 8, 8);
    const d = probeCtx.getImageData(0, 0, 8, 8).data;
    const rows = new Array(8).fill(0);
    for (let i = 0; i < d.length; i += 4) {
      rows[(i / 4 / 8) | 0] += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] / 255);
    }
    const band = (a, b) => {
      let s = 0;
      for (let r = a; r <= b; r++) s += rows[r];
      return Math.min(1, (s / ((b - a + 1) * 8 * 765)) * 6);
    };
    bands[0] = band(0, 2);
    bands[1] = band(3, 4);
    bands[2] = band(5, 7);
  } catch { /* canvas not ready */ }
}

// ---- boot level: everything electrical ramps with the phosphor --------------------
let level = 0;
function bootLevel(t) {
  const cls = faceEl.classList;
  if (cls.contains("booting")) { level = 0; return 0; }
  if (level < 1) level = Math.min(1, level + 0.022);
  // steppy warm-up flicker until fully lit
  return level < 0.99 ? level * (Math.sin(t * 41) > -0.2 ? 1 : 0.3) : 1;
}

// ---- loop --------------------------------------------------------------------------
const t0 = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const t = (now - t0) / 1000;
  const st = PM.status();

  // faint camera drift — breathing, never enough to smear the text
  camera.position.x = Math.sin(t * 0.11) * 2.4;
  camera.position.y = Math.cos(t * 0.083) * 1.6;
  camera.position.z = camZ;
  camera.lookAt(0, 0, 0);

  sampleBrightness(now);
  const lvl = bootLevel(t);

  // the screen's LEDs are the only light in the room; each band of the glass
  // casts what its own lit cells add up to
  // barely-there instability while writing — a murmur, not a strobe
  const busyFlick = st.busy ? 0.96 + 0.03 * Math.sin(t * 23) : 1;
  // the up-tilted top strip gets a modest gain: the bottom half also enjoys
  // the shadow spot, so without it the plastic above the glass reads dead
  const bandGain = [1.3, 1, 1];
  bandLights.forEach((l, i) => {
    l.intensity = lvl * busyFlick * (2.4 + bands[i] * 60) * bandGain[i];
  });
  const avgBand = (bands[0] + bands[1] + bands[2]) / 3;
  PM.glow = lvl * avgBand; // feeds the panel-whine loudness in app.js
  // side spill: dimmer than the control zone, never black
  sideLights.forEach((l) => {
    l.intensity = lvl * busyFlick * (2.4 + avgBand * 60) * 0.6;
  });
  // the shadow-casting share of the screen's light
  shadowSpot.intensity = lvl * busyFlick * (300 + avgBand * 3600);
  // and its first bounce off the room, coming back at the device
  bounce.intensity = lvl * busyFlick * (0.01 + avgBand * 0.1);
  lcdMat.opacity = lvl;

  // knobs track their values (ribs + needle really rotate)
  knobGroups.forEach((g) => {
    const k = g.userData.k;
    const ang = -THREE.MathUtils.degToRad(-135 + 270 * ((k.value - k.min) / (k.max - k.min)));
    g.rotation.z += (ang - g.rotation.z) * 0.35;
  });

  // lever press springs: keys swing on their hidden top hinge.
  // WRITE latches down for the whole job, like PLAY on a real deck.
  for (const m of [redBtn, ...keyMeshes]) {
    const down = pressed.get(m) > now || (m === redBtn && st.busy);
    const target = down ? m.userData.pressRX : m.userData.restRX;
    m.rotation.x += (target - m.rotation.x) * 0.4;
  }

  if (PM.lcdDirty) { lcdTex.needsUpdate = true; PM.lcdDirty = false; }

  composer.render();
  cssRenderer.render(cssScene, camera);
}
animate();

addEventListener("resize", () => {
  frameCamera();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  cssRenderer.setSize(innerWidth, innerHeight);
});
