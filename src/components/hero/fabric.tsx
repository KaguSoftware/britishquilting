"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

/**
 * The unfurling bolt.
 *
 * One continuous length of cloth, split into three vertical strips (three
 * meshes) so the final beat can pull it apart into the category cards
 * without stretching triangles. All deformation happens in the vertex
 * shader, driven by a single scroll-progress value, so it's deterministic
 * and cheap, with no physics solver.
 *
 *   s < uLen  → hanging sheet with a travelling drape
 *   s ≥ uLen  → wrapped round a spiral (the remaining bolt)
 */

const W = 3.6; // fabric width (world units)
const H = 8.0; // fabric length
const STRIPS = 3;

// Fabric looks per scroll chapter: ivory sateen, natural bump, champagne silk
const LOOKS = [
  { color: new THREE.Color("#f1e7d3"), sheen: new THREE.Color("#fff8ea"), rough: 0.42 },
  { color: new THREE.Color("#d6c29c"), sheen: new THREE.Color("#f6e6c4"), rough: 0.72 },
  { color: new THREE.Color("#caa566"), sheen: new THREE.Color("#fff1c9"), rough: 0.3 },
];
// During the split each strip settles into its own category colour (matches the DOM cards)
const STRIP_LOOKS: Record<number, (typeof LOOKS)[number]> = { [-1]: LOOKS[0], [0]: LOOKS[1], [1]: LOOKS[2] };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Procedural twill weave → tangent-space normal map + tiling colour grain. */
function makeWeaveTextures() {
  const size = 256;
  const height = new Float32Array(size * size);
  const threads = 32;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = (x / size) * threads;
      const cy = (y / size) * threads;
      const ix = Math.floor(cx);
      const iy = Math.floor(cy);
      const fx = cx - ix;
      const fy = cy - iy;
      // 2/1 twill: warp over two, under one, shifting each row
      const warpOnTop = (ix + iy) % 3 !== 0;
      const warp = Math.sin(fx * Math.PI); // rounded thread profile
      const weft = Math.sin(fy * Math.PI);
      const hgt = warpOnTop ? 0.55 + 0.45 * warp * (0.6 + 0.4 * Math.sin(fy * Math.PI)) : 0.55 + 0.45 * weft * (0.6 + 0.4 * Math.sin(fx * Math.PI));
      height[y * size + x] = hgt + (Math.random() - 0.5) * 0.06;
    }
  }
  const normal = new Uint8Array(size * size * 4);
  const grain = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * size + x) * 4;
      normal[i] = (n.x * 0.5 + 0.5) * 255;
      normal[i + 1] = (n.y * 0.5 + 0.5) * 255;
      normal[i + 2] = (n.z * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
      const g = 225 + at(x, y) * 30;
      grain[i] = grain[i + 1] = grain[i + 2] = Math.min(255, g);
      grain[i + 3] = 255;
    }
  }
  const mk = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 22);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { normal: mk(normal, false), grain: mk(grain, true) };
}

const shaderHead = /* glsl */ `
uniform float uLen;
uniform float uTop;
uniform float uR;
uniform float uWave;
uniform float uTime;
uniform float uSplit;
uniform float uStrip;   // -1, 0, 1
uniform float uW;
uniform float uH;

vec3 fabricPos(vec2 uv0) {
  float u = (uv0.x + uStrip + 1.0) / 3.0;         // 0..1 across the full width
  float x = (u - 0.5) * uW;
  float s = (1.0 - uv0.y) * uH;                    // 0 at the top edge
  vec3 p;
  if (s < uLen) {
    p = vec3(x, uTop - s, 0.0);
    float hang = smoothstep(0.0, 1.2, s) * smoothstep(0.0, 0.8, uLen - s);
    // Curtain pleats: deep vertical folds that gather as the cloth falls
    float gather = smoothstep(0.2, 3.5, s);
    float pleat = sin(x * 5.2 + sin(s * 0.35 + uTime * 0.25) * 0.8) * 0.16
                + sin(x * 11.0 + 1.3) * 0.035;
    // Travelling drape: a slow breeze moving down the length
    float drape =
        sin(x * 2.1 + uTime * 0.55 + s * 0.55) * 0.14
      + sin(x * 4.7 - uTime * 0.9 + s * 1.2) * 0.05
      + sin(s * 2.4 - uTime * 0.7) * 0.05;
    p.z += (drape + pleat * gather) * hang * uWave;
    // folds gather slightly toward the centre as it drapes
    p.x *= 1.0 - 0.035 * hang * uWave * (0.5 + 0.5 * sin(s * 1.3 + uTime * 0.4));
  } else {
    float d = s - uLen;
    float r = max(uR - d * 0.0045, 0.05);          // tightening spiral
    float th = d / r;
    vec3 c = vec3(x, uTop - uLen, r);
    p = c + vec3(0.0, -sin(th) * r, -cos(th) * r);
  }
  // Final beat: strips separate, lift and bow like three cards being dealt
  float k = uSplit;
  p.x += uStrip * k * 0.55;
  p.z += -abs(uStrip) * k * 0.35 + sin((u * 3.0 - floor(u * 3.0)) * 3.14159) * k * 0.12;
  p.y += (1.0 - abs(uStrip)) * k * 0.12;
  return p;
}
`;

function useFabricMaterial(strip: number, tex: ReturnType<typeof makeWeaveTextures>) {
  return useMemo(() => {
    const uniforms = {
      uLen: { value: 0.02 },
      uTop: { value: -0.55 },
      uR: { value: 0.34 },
      uWave: { value: 0 },
      uTime: { value: 0 },
      uSplit: { value: 0 },
      uStrip: { value: strip },
      uW: { value: W },
      uH: { value: H },
    };
    const mat = new THREE.MeshPhysicalMaterial({
      color: LOOKS[0].color.clone(),
      map: tex.grain,
      normalMap: tex.normal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: LOOKS[0].rough,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.28,
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
      sheenColor: LOOKS[0].sheen.clone(),
      side: THREE.DoubleSide,
      transparent: true,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", `${shaderHead}\nvoid main() {`)
        .replace(
          "#include <beginnormal_vertex>",
          /* glsl */ `
          vec3 fp0 = fabricPos(uv);
          vec3 fpu = fabricPos(uv + vec2(0.002, 0.0));
          vec3 fpv = fabricPos(uv + vec2(0.0, 0.002));
          vec3 objectNormal = normalize(cross(fpu - fp0, fpv - fp0));
          #ifdef USE_TANGENT
            vec3 objectTangent = normalize(fpu - fp0);
          #endif
          `,
        )
        .replace("#include <begin_vertex>", "vec3 transformed = fp0;");
    };
    // Unique key per strip so three.js doesn't share one compiled program with stale uniforms
    mat.customProgramCacheKey = () => "bq-fabric";
    return { mat, uniforms };
  }, [strip, tex]);
}

function Strip({ strip, tex, progress }: { strip: number; tex: ReturnType<typeof makeWeaveTextures>; progress: RefObject<number> }) {
  const { mat, uniforms } = useFabricMaterial(strip, tex);
  const geo = useMemo(() => new THREE.PlaneGeometry(W / STRIPS, H, 40, 320), []);
  const smoothed = useRef(0);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpSheen = useMemo(() => new THREE.Color(), []);

  useFrame((state, dt) => {
    // critically-damped follow so fast wheel flicks still look like silk
    const target = progress.current ?? 0;
    smoothed.current += (target - smoothed.current) * (1 - Math.exp(-dt * 6));
    const p = smoothed.current;
    const t = state.clock.elapsedTime;

    const unroll = smooth(0.02, 0.42, p);
    uniforms.uLen.value = mix(0.02, H - 0.6, unroll);
    // idle "breathing" on the resting bolt before anyone scrolls
    uniforms.uTop.value = mix(-0.55 + Math.sin(t * 0.8) * 0.02, 3.1, unroll);
    uniforms.uWave.value = smooth(0.18, 0.55, p) * (1 - smooth(0.78, 0.95, p) * 0.7);
    uniforms.uTime.value = t;
    uniforms.uSplit.value = smooth(0.72, 0.94, p);

    // colour chapters
    const a = smooth(0.42, 0.52, p);
    const b = smooth(0.56, 0.66, p);
    tmpColor.copy(LOOKS[0].color).lerp(LOOKS[1].color, a).lerp(LOOKS[2].color, b);
    tmpSheen.copy(LOOKS[0].sheen).lerp(LOOKS[1].sheen, a).lerp(LOOKS[2].sheen, b);
    const own = STRIP_LOOKS[strip];
    const k = smooth(0.7, 0.86, p);
    mat.color.copy(tmpColor).lerp(own.color, k);
    mat.sheenColor.copy(tmpSheen).lerp(own.sheen, k);
    mat.roughness = mix(mix(mix(LOOKS[0].rough, LOOKS[1].rough, a), LOOKS[2].rough, b), own.rough, k);
    // hand off to the DOM cards, which carry the same colours
    mat.opacity = 1 - smooth(0.9, 0.97, p);
  });

  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

export function Fabric({ progress }: { progress: RefObject<number> }) {
  const tex = useMemo(() => makeWeaveTextures(), []);
  const group = useRef<THREE.Group>(null);
  const { camera, pointer, size } = useThree();
  // Fit the bolt to narrow (portrait) screens: visible width at z=0 from a 35° fov at distance 7
  const aspect = size.width / size.height;
  const fit = Math.min(1, (2 * 7 * Math.tan((35 * Math.PI) / 360) * aspect * 0.86) / W);
  const cam = useRef(0);

  useFrame((state, dt) => {
    const target = progress.current ?? 0;
    cam.current += (target - cam.current) * (1 - Math.exp(-dt * 4));
    const p = cam.current;
    // dolly in on the weave during the middle chapter, then pull back for the split
    const dolly = smooth(0.4, 0.66, p) * (1 - smooth(0.72, 0.9, p));
    camera.position.z = mix(7, 3.4, dolly);
    camera.position.y = mix(0.1, 0.9, smooth(0.05, 0.4, p)) - dolly * 0.4;
    camera.position.x += (pointer.x * 0.25 - camera.position.x) * (1 - Math.exp(-dt * 2));
    camera.lookAt(0, mix(0.2, 0.7, smooth(0.05, 0.4, p)) - dolly * 0.3, 0);
    if (group.current) {
      group.current.rotation.x = mix(-0.08, 0.12, smooth(0.0, 0.4, p)) - smooth(0.72, 0.94, p) * 0.1;
      group.current.rotation.y = pointer.x * 0.05 + Math.sin(state.clock.elapsedTime * 0.3) * 0.02;
    }
  });

  return (
    <group ref={group} scale={fit}>
      {[-1, 0, 1].map((s) => (
        <Strip key={s} strip={s} tex={tex} progress={progress} />
      ))}
    </group>
  );
}
