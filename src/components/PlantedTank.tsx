import { useId } from "react";

// A planted aquascape in a rimless glass tank: black aqua soil, iwagumi rocks, driftwood, stem plants with red tips,
// vallisneria, a sword plant, a carpet along the front glass and a small school of neon tetras.
// Pure SVG + CSS (classes pt-* in globals.css). Everything "random" comes from a seeded generator, so the server
// and the browser draw exactly the same picture.

// no import from ./ui (a client module): the store renders this tank on the server
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

const W = 1600;
const H = 900;

/** Small seeded random number generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Height of the soil's top edge at x: higher at the back corners, a gentle valley in the middle. */
const soil = (x: number) => 768 - 30 * Math.sin((Math.PI * x) / W) + 9 * Math.sin(x / 160) + (x < 520 ? (520 - x) * -0.05 : 0);

const SOIL_TOP = (() => {
  let d = `M0 ${r1(soil(0))}`;
  for (let x = 20; x <= W; x += 20) d += ` L${x} ${r1(soil(x))}`;
  return d;
})();

const SOIL_PATH = (() => {
  let d = `M0 ${H} L0 ${r1(soil(0))}`;
  for (let x = 20; x <= W; x += 20) d += ` L${x} ${r1(soil(x))}`;
  return `${d} L${W} ${H} Z`;
})();

/** One stem plant: a gently bending stem with pairs of leaves, turning to `tip` near the top. */
function Stem({ x, h, bend, tip, greens, seed, delay }: { x: number; h: number; bend: number; tip: string; greens: [string, string]; seed: number; delay: number }) {
  const rand = rng(seed);
  const base = soil(x) + 6;
  const at = (t: number) => ({ x: x + bend * t * t, y: base - h * t });
  const leaves = [];
  const n = Math.round(h / 19);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = at(t);
    const size = 1 - t * 0.35;
    const fill = t > 0.8 ? tip : t > 0.55 ? (rand() > 0.5 ? greens[1] : tip) : greens[rand() > 0.5 ? 0 : 1];
    for (const side of [-1, 1]) {
      const ang = side > 0 ? -(24 + rand() * 26) : 24 + rand() * 26; // leaves point up and outwards
      leaves.push(
        <ellipse
          key={`${i}${side}`}
          cx={r1(p.x + side * 9 * size)}
          cy={r1(p.y)}
          rx={r1(11 * size)}
          ry={r1(3.6 * size)}
          fill={fill}
          transform={`rotate(${r1(ang)} ${r1(p.x + side * 9 * size)} ${r1(p.y)})`}
        />,
      );
    }
  }
  const top = at(1);
  const mid = at(0.5);
  return (
    <g className="pt-sway" style={{ animationDelay: `${delay}s` }}>
      <path d={`M${x} ${r1(base)} Q ${r1(mid.x - bend * 0.25)} ${r1(mid.y)} ${r1(top.x)} ${r1(top.y)}`} stroke={greens[0]} strokeWidth="2.2" fill="none" />
      {leaves}
    </g>
  );
}

/** A cluster of stem plants. */
function Stems({ x, n, spread, h, tip, greens, seed, opacity = 1 }: { x: number; n: number; spread: number; h: number; tip: string; greens: [string, string]; seed: number; opacity?: number }) {
  const rand = rng(seed);
  const stems = Array.from({ length: n }, (_, i) => {
    const sx = x + (i - (n - 1) / 2) * spread + (rand() - 0.5) * spread * 0.6;
    const center = 1 - Math.abs(i - (n - 1) / 2) / n; // taller in the middle of the bunch
    return { sx, h: h * (0.62 + 0.38 * center + (rand() - 0.5) * 0.18), bend: (sx - x) * 0.35 + (rand() - 0.5) * 30, seed: seed * 31 + i, delay: -rand() * 6 };
  });
  return (
    <g opacity={opacity}>
      {stems.map((s, i) => (
        <Stem key={i} x={r1(s.sx)} h={s.h} bend={s.bend} tip={tip} greens={greens} seed={s.seed} delay={r1(s.delay)} />
      ))}
    </g>
  );
}

/** Ribbon-like vallisneria / grass blades. */
function Blades({ from, to, n, hMin, hMax, seed, colors }: { from: number; to: number; n: number; hMin: number; hMax: number; seed: number; colors: string[] }) {
  const rand = rng(seed);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = from + ((to - from) * (i + rand() * 0.8)) / n;
        const base = soil(x) + 10;
        const h = hMin + rand() * (hMax - hMin);
        const bend = (rand() - 0.5) * 120;
        const w = 9 + rand() * 6;
        const d = `M${r1(x - w / 2)} ${r1(base)} Q ${r1(x + bend * 0.45 - w / 2)} ${r1(base - h * 0.55)} ${r1(x + bend)} ${r1(base - h)} Q ${r1(x + bend * 0.45 + w / 2)} ${r1(base - h * 0.55)} ${r1(x + w / 2)} ${r1(base)} Z`;
        return (
          <g key={i} className="pt-sway pt-sway-wide" style={{ animationDelay: `${r1(-rand() * 7)}s` }}>
            <path d={d} fill={colors[i % colors.length]} />
          </g>
        );
      })}
    </g>
  );
}

/** A broad-leaved sword plant. */
function Sword({ x, seed }: { x: number; seed: number }) {
  const rand = rng(seed);
  const base = soil(x) + 8;
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const a = -150 + (i * 120) / 8 + (rand() - 0.5) * 10; // fan out
    const len = 150 + rand() * 120 - Math.abs(i - 4) * 14;
    const rad = (a * Math.PI) / 180;
    const tx = x + Math.cos(rad) * len;
    const ty = base + Math.sin(rad) * len;
    const nx = -Math.sin(rad) * 34;
    const ny = Math.cos(rad) * 34;
    const mx = (x + tx) / 2;
    const my = (base + ty) / 2;
    return { d: `M${x} ${r1(base)} Q ${r1(mx + nx)} ${r1(my + ny)} ${r1(tx)} ${r1(ty)} Q ${r1(mx - nx)} ${r1(my - ny)} ${x} ${r1(base)} Z`, rib: `M${x} ${r1(base)} Q ${r1(mx + nx * 0.15)} ${r1(my + ny * 0.15)} ${r1(tx)} ${r1(ty)}`, fill: ["#3f8f3a", "#55a845", "#2f7a35", "#6dbb4f"][i % 4]!, delay: r1(-rand() * 6) };
  });
  return (
    <g>
      {leaves.map((l, i) => (
        <g key={i} className="pt-sway" style={{ animationDelay: `${l.delay}s` }}>
          <path d={l.d} fill={l.fill} />
          <path d={l.rib} stroke="#9fd77a" strokeOpacity="0.55" strokeWidth="1.6" fill="none" />
        </g>
      ))}
    </g>
  );
}

/** Anubias tied to a rock: a few broad, glossy leaves. */
function Anubias({ x, y }: { x: number; y: number }) {
  const leaves = [
    { a: -160, l: 70, f: "#2f7a35" },
    { a: -128, l: 86, f: "#3f9440" },
    { a: -95, l: 92, f: "#4fa64a" },
    { a: -62, l: 84, f: "#3a8a3c" },
    { a: -30, l: 68, f: "#2c7032" },
  ];
  return (
    <g className="pt-sway" style={{ animationDelay: "-2s" }}>
      <path d={`M${x - 30} ${y + 4} Q ${x} ${y - 6} ${x + 32} ${y + 4}`} stroke="#7d6a3f" strokeWidth="7" strokeLinecap="round" fill="none" />
      {leaves.map((l, i) => {
        const rad = (l.a * Math.PI) / 180;
        const sx = x + (i - 2) * 9;
        const tx = sx + Math.cos(rad) * l.l;
        const ty = y + Math.sin(rad) * l.l;
        const px = sx + Math.cos(rad) * l.l * 0.3;
        const py = y + Math.sin(rad) * l.l * 0.3;
        const cx0 = sx + Math.cos(rad) * l.l * 0.68;
        const cy0 = y + Math.sin(rad) * l.l * 0.68;
        const nx = -Math.sin(rad) * 17;
        const ny = Math.cos(rad) * 17;
        return (
          <g key={i}>
            <path d={`M${r1(sx)} ${y} L${r1(px)} ${r1(py)}`} stroke="#3f7a35" strokeWidth="3" />
            <path d={`M${r1(px)} ${r1(py)} Q ${r1(cx0 + nx)} ${r1(cy0 + ny)} ${r1(tx)} ${r1(ty)} Q ${r1(cx0 - nx)} ${r1(cy0 - ny)} ${r1(px)} ${r1(py)} Z`} fill={l.f} />
            <path d={`M${r1(px)} ${r1(py)} L${r1(tx)} ${r1(ty)}`} stroke="#a6dc84" strokeOpacity="0.6" strokeWidth="1.5" />
          </g>
        );
      })}
    </g>
  );
}

/** A dark, layered iwagumi stone. */
function Rock({ pts, face, lines, id }: { pts: string; face: string; lines: string[]; id: string }) {
  return (
    <g>
      <polygon points={pts} fill={`url(#${id}-rock)`} />
      <polygon points={face} fill="#7b8388" opacity="0.45" />
      <polygon points={pts} fill={`url(#${id}-rockshade)`} />
      {lines.map((d, i) => (
        <path key={i} d={d} stroke="#9aa2a6" strokeOpacity="0.4" strokeWidth="2" fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

/** The low carpet of tiny leaves along the front of the soil. */
function Carpet({ seed }: { seed: number }) {
  const rand = rng(seed);
  const leaves = [];
  const colors = ["#5fb83a", "#7fcd4c", "#4a9d2f", "#93d65a"];
  for (let x = -6; x < W + 6; x += 7) {
    const y = soil(x) + 4 + rand() * 10;
    for (let k = 0; k < 2; k++) {
      const lx = x + (rand() - 0.5) * 8;
      const ly = y + (rand() - 0.5) * 8 - k * 7;
      leaves.push(<ellipse key={`${x}-${k}`} cx={r1(lx)} cy={r1(ly)} rx={r1(5 + rand() * 3)} ry={r1(3 + rand() * 1.6)} fill={colors[Math.floor(rand() * colors.length)]} transform={`rotate(${Math.round((rand() - 0.5) * 70)} ${r1(lx)} ${r1(ly)})`} />);
    }
  }
  return <g>{leaves}</g>;
}

/** Short hairgrass tufts in front of the rocks. */
function Tufts({ xs, seed }: { xs: number[]; seed: number }) {
  const rand = rng(seed);
  return (
    <g>
      {xs.map((x, i) => (
        <g key={i} className="pt-sway" style={{ animationDelay: `${r1(-rand() * 5)}s` }}>
          {Array.from({ length: 9 }, (_, k) => {
            const bx = x + (k - 4) * 3;
            const base = soil(x) + 12;
            const h = 26 + rand() * 30;
            return <path key={k} d={`M${r1(bx)} ${r1(base)} Q ${r1(bx + (k - 4) * 2)} ${r1(base - h * 0.6)} ${r1(bx + (k - 4) * 4.5)} ${r1(base - h)}`} stroke={k % 2 ? "#6cc04a" : "#4f9f34"} strokeWidth="2.4" strokeLinecap="round" fill="none" />;
          })}
        </g>
      ))}
    </g>
  );
}

/** A neon tetra facing right, about 48 units long. */
function Tetra() {
  return (
    <g>
      <path d="M1 -6 L11 0 L1 6 Q4 0 1 -6 Z" fill="#e7eef0" opacity="0.75" />
      <ellipse cx="26" cy="0" rx="18" ry="6.6" fill="#dfe8ec" opacity="0.92" />
      <path d="M11 0.6 Q21 7.2 34 4.4 Q25 2 11 0.6 Z" fill="#e8434c" />
      <path d="M14 -1.4 Q28 -4.6 42 -1.6" stroke="#2bb8ff" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M14 -1.4 Q28 -4.6 42 -1.6" stroke="#9be3ff" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M22 -6 Q26 -10 30 -6" fill="#dfe8ec" opacity="0.8" />
      <circle cx="39" cy="-0.6" r="2.3" fill="#ffffff" />
      <circle cx="39.4" cy="-0.6" r="1.4" fill="#18242b" />
    </g>
  );
}

/** Where each tetra starts, how far it swims across and back, and how long that takes. */
const SCHOOL = [
  { x: 420, y: 250, s: 1.94, reach: 640, dur: 36, delay: 0, bob: 5 },
  { x: 470, y: 222, s: 1.78, reach: 650, dur: 36, delay: -0.6, bob: 6 },
  { x: 500, y: 268, s: 1.86, reach: 630, dur: 36, delay: -1.1, bob: 4.6 },
  { x: 380, y: 286, s: 1.71, reach: 660, dur: 37, delay: -0.3, bob: 5.4 },
  { x: 545, y: 240, s: 1.63, reach: 620, dur: 36.5, delay: -1.6, bob: 6.2 },
  { x: 440, y: 305, s: 1.78, reach: 650, dur: 37.5, delay: -0.9, bob: 5 },
  { x: 900, y: 430, s: 1.47, reach: 380, dur: 28, delay: -14, bob: 4.2 },
  { x: 950, y: 455, s: 1.4, reach: 360, dur: 28, delay: -14.7, bob: 5.2 },
  { x: 870, y: 470, s: 1.43, reach: 390, dur: 29, delay: -13.5, bob: 4.8 },
];

const BUBBLES = [
  { x: 1342, r: 4, delay: 0, dur: 7 },
  { x: 1350, r: 3, delay: -1.6, dur: 6.4 },
  { x: 1338, r: 5, delay: -3.1, dur: 7.6 },
  { x: 1347, r: 2.6, delay: -4.4, dur: 6.1 },
  { x: 1344, r: 3.6, delay: -5.7, dur: 7.2 },
];

export function PlantedTank({ className, dark = false, caption }: { className?: string; dark?: boolean; caption?: React.ReactNode }) {
  const id = "pt" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <figure className={cx("relative w-full", className)}>
      <div
        className={cx(
          "relative overflow-hidden rounded-[22px] border-[3px] border-t-[9px] aspect-[4/3] sm:aspect-[16/9]",
          dark ? "border-[#cfe6e2]/70 border-t-[#0b261d] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.65)]" : "border-[#d3e5e2] border-t-[#113A2D] shadow-[0_30px_60px_-34px_rgba(17,58,45,0.55)]",
        )}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="pt-scene anim-zone absolute inset-0 size-full" role="img" aria-label="A planted aquarium with rocks, driftwood, green plants and a school of neon tetras">
          <defs>
            <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f4fbfa" />
              <stop offset="0.45" stopColor="#e1f3f0" />
              <stop offset="1" stopColor="#c9e8e1" />
            </linearGradient>
            <linearGradient id={`${id}-ray`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${id}-rock`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5d6468" />
              <stop offset="0.55" stopColor="#3d4346" />
              <stop offset="1" stopColor="#2a2f31" />
            </linearGradient>
            <linearGradient id={`${id}-rockshade`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.45" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id={`${id}-soilshade`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#6b4426" />
              <stop offset="1" stopColor="#94653a" />
            </linearGradient>
            <pattern id={`${id}-soil`} width="36" height="36" patternUnits="userSpaceOnUse">
              <rect width="36" height="36" fill="#1c1e1e" />
              <circle cx="4" cy="5" r="3.2" fill="#2d3030" />
              <circle cx="15" cy="3" r="2.6" fill="#141515" />
              <circle cx="26" cy="7" r="3.4" fill="#343737" />
              <circle cx="9" cy="15" r="2.8" fill="#272a2a" />
              <circle cx="20" cy="17" r="3.6" fill="#101111" />
              <circle cx="31" cy="18" r="2.6" fill="#2f3232" />
              <circle cx="5" cy="27" r="3.4" fill="#141515" />
              <circle cx="16" cy="29" r="2.4" fill="#383b3b" />
              <circle cx="27" cy="29" r="3.2" fill="#232525" />
              <circle cx="34" cy="33" r="1.8" fill="#3a3d3d" />
            </pattern>
          </defs>

          {/* water, with soft light from the lamp above */}
          <rect width={W} height={H} fill={`url(#${id}-water)`} />
          <rect width={W} height="44" fill="#ffffff" opacity="0.55" />
          <path d={`M0 44 H${W}`} stroke="#ffffff" strokeWidth="3" />
          <path d={`M0 52 H${W}`} stroke="#bfe3dd" strokeWidth="1.5" strokeDasharray="60 40" opacity="0.6" />
          {[
            { d: "260,44 360,44 240,860 110,860", delay: 0 },
            { d: "640,44 700,44 680,860 560,860", delay: -2.5 },
            { d: "980,44 1060,44 1130,860 990,860", delay: -4.2 },
            { d: "1300,44 1350,44 1470,860 1380,860", delay: -1.4 },
          ].map((r, i) => (
            <polygon key={i} className="pt-ray" points={r.d} fill={`url(#${id}-ray)`} style={{ animationDelay: `${r.delay}s` }} />
          ))}

          {/* back row: soft, faded stem plants */}
          <Stems x={260} n={9} spread={22} h={430} tip="#8fcf63" greens={["#78b35b", "#8fc570"]} seed={3} opacity={0.5} />
          <Stems x={760} n={10} spread={22} h={470} tip="#9fd46e" greens={["#76b25a", "#8cc46d"]} seed={4} opacity={0.45} />
          <Stems x={1180} n={9} spread={22} h={440} tip="#e4895f" greens={["#79b45c", "#8ec66f"]} seed={5} opacity={0.5} />

          {/* tall vallisneria in the back corners */}
          <Blades from={0} to={200} n={18} hMin={420} hMax={640} seed={7} colors={["#4e9a3a", "#68b04a", "#3d8a33", "#7cc157"]} />
          <Blades from={1430} to={1600} n={16} hMin={400} hMax={620} seed={8} colors={["#4e9a3a", "#68b04a", "#3d8a33", "#7cc157"]} />

          {/* driftwood */}
          <g strokeLinecap="round" fill="none">
            <path d="M110 790 C 210 650, 300 565, 430 445 S 560 335, 610 300" stroke={`url(#${id}-wood)`} strokeWidth="46" />
            <path d="M385 495 C 345 435, 322 390, 296 322" stroke={`url(#${id}-wood)`} strokeWidth="24" />
            <path d="M300 330 C 285 300, 262 285, 240 280" stroke={`url(#${id}-wood)`} strokeWidth="12" />
            <path d="M520 365 C 565 322, 640 300, 712 292" stroke={`url(#${id}-wood)`} strokeWidth="18" />
            <path d="M650 298 C 680 270, 700 255, 730 248" stroke={`url(#${id}-wood)`} strokeWidth="9" />
            <path d="M140 748 C 240 625, 330 548, 446 440 S 560 340, 600 312" stroke="#c19060" strokeWidth="7" opacity="0.55" />
            <path d="M180 760 C 270 650, 350 575, 455 480" stroke="#4f3019" strokeWidth="6" opacity="0.5" />
          </g>

          {/* middle row: bushy stem plants, some with red tops */}
          <Stems x={330} n={11} spread={20} h={360} tip="#d9473a" greens={["#3f8f35", "#5aa847"]} seed={11} />
          <Stems x={880} n={9} spread={20} h={300} tip="#79c447" greens={["#3b8a33", "#56a645"]} seed={12} />
          <Stems x={1270} n={11} spread={20} h={380} tip="#e36a3b" greens={["#3f8f35", "#5aa847"]} seed={13} />

          {/* iwagumi stones */}
          <Rock
            id={id}
            pts="470,770 505,600 560,470 640,392 700,402 752,500 790,620 812,770"
            face="560,470 640,392 690,420 650,540 580,610 520,600"
            lines={["M520 640 L610 560 L700 520", "M545 700 L650 620 L770 600", "M600 460 L680 430"]}
          />
          <Rock
            id={id}
            pts="985,772 1005,640 1060,525 1115,478 1170,500 1222,600 1252,772"
            face="1060,525 1115,478 1150,494 1120,600 1060,650 1018,640"
            lines={["M1030 700 L1110 640 L1210 640", "M1060 600 L1150 560"]}
          />
          <Rock id={id} pts="826,772 846,712 890,684 930,700 950,772" face="846,712 890,684 905,700 870,740" lines={["M850 745 L920 725"]} />
          <Rock id={id} pts="1290,772 1310,726 1350,708 1382,734 1394,772" face="1310,726 1350,708 1360,724 1330,750" lines={[]} />
          <Rock id={id} pts="400,772 412,738 446,726 470,746 474,772" face="412,738 446,726 452,738 428,756" lines={[]} />
          <Anubias x={1112} y={484} />

          <Sword x={1500} seed={17} />

          {/* the soil, with the front glass showing its grains */}
          <path d={SOIL_PATH} fill={`url(#${id}-soil)`} />
          <path d={SOIL_PATH} fill={`url(#${id}-soilshade)`} />
          <path d={SOIL_TOP} stroke="#4a4f4f" strokeWidth="5" fill="none" opacity="0.8" />
          <Tufts xs={[460, 560, 700, 820, 960, 1060, 1240, 1400]} seed={21} />
          <Carpet seed={23} />
        </svg>

        {/* the fish, bubbles and glass on a layer of their own: on phones the planted scene underneath holds still
            (redrawing its thousands of leaves every frame made phones stutter), while these few shapes keep moving */}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="pt-fx anim-zone pointer-events-none absolute inset-0 size-full" aria-hidden>
          {/* neon tetras */}
          {SCHOOL.map((f, i) => (
            <g key={i} transform={`translate(${f.x} ${f.y}) scale(${f.s})`}>
              <g className="pt-swim" style={{ "--reach": `${f.reach / f.s}px`, "--dur": `${f.dur}s`, "--delay": `${f.delay}s` } as React.CSSProperties}>
                <g className="pt-bob" style={{ "--bob": `${f.bob}px`, animationDelay: `${-i * 0.7}s` } as React.CSSProperties}>
                  <g className="pt-flip">
                    <Tetra />
                  </g>
                </g>
              </g>
            </g>
          ))}

          {/* a few bubbles from behind the rocks */}
          {BUBBLES.map((b, i) => (
            <circle key={i} className="pt-bubble" cx={b.x} cy="720" r={b.r} fill="#ffffff" fillOpacity="0.35" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.2" style={{ animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }} />
          ))}

          {/* reflections on the front glass */}
          <polygon points="1210,0 1290,0 1060,700 990,700" fill="#ffffff" opacity="0.1" />
          <polygon points="1320,0 1345,0 1110,700 1088,700" fill="#ffffff" opacity="0.08" />
        </svg>
        {/* the glass edges */}
        <div className="pointer-events-none absolute inset-0 rounded-[19px] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.55),inset_0_-10px_18px_-12px_rgba(0,0,0,0.5)]" />
      </div>
      {/* the stand it sits on */}
      <div className={cx("mx-[3%] h-2.5 rounded-b-xl", dark ? "bg-black/30" : "bg-[#113A2D]/85")} />
      {caption && <figcaption className={cx("mt-4 text-center text-[13px] font-semibold", dark ? "text-white/80" : "opacity-70")}>{caption}</figcaption>}
    </figure>
  );
}
