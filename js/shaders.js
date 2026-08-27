// GLSL sources for the living entity.
// A single fullscreen triangle raymarches a noise-displaced sphere.
// No geometry buffers, no external libraries.

export const VERT_SRC = `#version 300 es
precision highp float;

// Fullscreen triangle generated from gl_VertexID: no attributes, no buffers.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAG_SRC = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uRes;        // drawing buffer size in pixels
uniform float uTime;       // seconds
uniform vec2  uPointer;    // pointer in uv space, aspect corrected
uniform float uPointerAmt; // 0 = pointer absent, 1 = pointer present
uniform vec2  uCenter;     // entity offset in uv space
uniform float uScale;      // apparent size multiplier
uniform float uWake;       // 0 = asleep, 1 = fully awake
uniform float uCharge;     // 0..1 hold-to-wake progress
uniform float uPulseT;     // 0..1 progress of the current pulse
uniform float uPulseAmp;   // strength of the current pulse
uniform float uDroop;      // 0..1 idle sag
uniform float uCalm;       // 0 = restless, 1 = settled
uniform vec3  uColA;       // shell colour, linear
uniform vec3  uColB;       // rim colour, linear
uniform vec3  uColC;       // interior colour, linear — the warm part
uniform float uSeed;

const float BASE_R = 0.9;
const float CAM_Z  = 2.6;
const float FOCAL  = 1.6;

// Simplex noise 3D, Ashima Arts / Stefan Gustavson (MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Two octaves, not three: the third one crinkles the silhouette into
// something rocky, and a rocky companion is not a welcoming one.
float fbm(vec3 p) {
  return snoise(p) * 0.5 + snoise(p * 2.03) * 0.25;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Breathing never repeats on an obvious beat: two slow rates that do not divide.
float breath(float t) {
  return 0.030 * sin(t * 0.90) + 0.020 * sin(t * 1.37 + 1.7);
}

float noiseAmp() {
  // Charging focuses the surface; sleep flattens it; settling calms it.
  return mix(0.200, 0.070, uCharge) * (0.35 + 0.65 * uWake) * (1.0 - 0.22 * uCalm);
}

float surface(vec3 p) {
  float t = uTime * 0.26;
  float r = BASE_R * (1.0 + breath(t) * (0.35 + 0.65 * uWake));

  vec3 q = p;
  // Idle sag: the lower half hangs when it is being ignored.
  q.y += uDroop * 0.10 * (1.0 - smoothstep(-1.0, 0.6, p.y));

  float n = fbm(q * 1.02 + vec3(uSeed, uSeed * 0.7, t * (0.55 - 0.25 * uCalm)));
  return length(q) - r - n * noiseAmp();
}

vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float h = 0.0025;
  return normalize(
    k.xyy * surface(p + k.xyy * h) +
    k.yyx * surface(p + k.yyx * h) +
    k.yxy * surface(p + k.yxy * h) +
    k.xxx * surface(p + k.xxx * h)
  );
}

// Analytic ray/sphere intersection used as a cheap bounding volume.
bool boundHit(vec3 ro, vec3 rd, float radius, out float t0, out float t1) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  t0 = -b - s;
  t1 = -b + s;
  return t1 > 0.0;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  uv = uv / max(uScale, 0.001) - uCenter;

  vec3 ro = vec3(0.0, 0.0, CAM_Z);
  vec3 rd = normalize(vec3(uv, -FOCAL));

  float boundR = BASE_R * 1.06 + noiseAmp() * 1.6;

  vec3 col = vec3(0.0);
  float dc = length(uv);

  // Halo: a soft presence that reads even where the body is not hit.
  float haloR = boundR * 0.62;
  float halo = exp(-max(dc - haloR, 0.0) * 5.0);
  // The halo carries a little of the interior warmth outwards.
  col += mix(uColB, uColC, 0.30) * halo * (0.012 + 0.080 * uWake + 0.13 * uCharge);

  // Pulse: an expanding ring released when it wakes or when it is touched.
  if (uPulseAmp > 0.001 && uPulseT < 1.0) {
    float ringR = haloR + uPulseT * 1.35;
    float edge = (dc - ringR) * 7.0;
    float ring = exp(-edge * edge);
    col += uColB * ring * uPulseAmp * (1.0 - uPulseT) * 0.85;
  }

  float t0, t1;
  if (boundHit(ro, rd, boundR, t0, t1)) {
    float t = max(t0, 0.0);
    float d = 0.0;
    bool hit = false;
    float glow = 0.0;

    for (int i = 0; i < 48; i++) {
      vec3 p = ro + rd * t;
      d = surface(p);
      glow += 0.020 / (1.0 + d * d * 130.0);
      if (d < 0.0016) { hit = true; break; }
      t += d * 0.62;
      if (t > t1) break;
    }

    col += uColB * glow * (0.06 + 0.16 * uWake);

    if (hit) {
      vec3 p = ro + rd * t;
      vec3 n = calcNormal(p);

      vec3 lightDir = normalize(vec3(0.42, 0.66, 0.62));
      float diff = clamp(dot(n, lightDir), 0.0, 1.0);
      float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.2);

      // Where the pointer is, the skin lifts a little towards it.
      vec3 toPointer = normalize(vec3(uPointer - uCenter, 1.1));
      float attention = pow(clamp(dot(n, toPointer), 0.0, 1.0), 3.0) * uPointerAmt;

      // The shell is thin and cool; most of the light comes from inside it.
      vec3 body = mix(uColA, uColB, 0.5 + 0.5 * n.y);
      col += body * (0.015 + 0.14 * diff * diff) * (0.20 + 0.80 * uWake);
      col += uColB * fres * (0.80 + 1.50 * uCharge) * (0.22 + 0.78 * uWake);
      col += uColB * attention * 0.18 * uWake;

      // A single soft highlight keeps it from reading as a flat disc.
      vec3 halfDir = normalize(lightDir - rd);
      float spec = pow(clamp(dot(n, halfDir), 0.0, 1.0), 22.0);
      col += uColB * spec * 0.20 * (0.2 + 0.8 * uWake);

      // Keep going through the body and gather what is drifting in there.
      // Eight cheap samples: the shell is translucent, so the interior is
      // where the shape actually lives.
      float interior = 0.0;
      float veins = 0.0;
      float stepIn = max((t1 - t) / 8.0, 0.015);
      float ti = t;
      for (int i = 0; i < 8; i++) {
        ti += stepIn;
        vec3 ip = ro + rd * ti;
        float depth = 1.0 - smoothstep(BASE_R * 0.10, BASE_R * 1.02, length(ip));
        if (depth > 0.0) {
          // Squashed sampling turns the drift into slow horizontal currents
          // rather than an even fog: that is what gives the inside a shape.
          vec3 sp = ip * vec3(1.55, 0.95, 1.55) + vec3(uSeed, uTime * 0.09, uTime * 0.05);
          float dens = fbm(sp);
          // Soft falloff, not squared: the glow should fill the body rather
          // than sit in it as a hard nucleus.
          float d2 = depth * (0.35 + 0.65 * depth);
          interior += d2 * (0.5 + 0.5 * dens);
          // Where the currents fold on themselves they brighten into veins.
          veins += d2 * pow(clamp(1.0 - abs(dens) * 2.4, 0.0, 1.0), 3.0);
        }
      }
      interior /= 8.0;
      veins /= 8.0;

      // Asleep it is a banked ember; the warmth arrives as it wakes.
      col += uColC * interior * (0.24 + 1.75 * uWake) * (0.85 + 0.5 * uCharge);
      col += mix(uColC, uColB, 0.30) * veins * (0.16 + 1.10 * uWake);
    }
  }

  // Background: almost black, with a slow lift towards the top of the frame.
  // Background: warm dusk rather than black. A plum sky with an amber bloom
  // resting on the horizon, so the page is lit before anything happens in it.
  vec2 sn = gl_FragCoord.xy / uRes;
  vec3 bgTop = vec3(0.0105, 0.0074, 0.0172);
  vec3 bgFloor = vec3(0.0215, 0.0128, 0.0170);
  vec3 bg = mix(bgFloor, bgTop, smoothstep(0.0, 1.0, sn.y));
  float bloom = pow(1.0 - sn.y, 2.4);
  bloom *= 0.62 + 0.38 * (1.0 - smoothstep(0.0, 1.1, abs(sn.x - 0.5) * 2.0));
  bg += vec3(0.0300, 0.0126, 0.0108) * bloom;
  float vignette = 1.0 - smoothstep(0.25, 1.35, length(sn * 2.0 - 1.0));
  col += bg * (0.70 + 0.30 * vignette);

  // Tone map, gamma, then grain to kill banding on dark gradients.
  col = col / (1.0 + col);
  col = pow(max(col, 0.0), vec3(0.4545));
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * 0.013;

  fragColor = vec4(col, 1.0);
}
`;
