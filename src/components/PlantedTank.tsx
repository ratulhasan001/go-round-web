// The scenery of the aquarium (components/aquarium): a planted aquascape in a rimless glass tank - iwagumi rocks,
// driftwood, stem plants with red tips, vallisneria, a sword plant and a carpet of small leaves over the whole floor -
// with the LED light above and the cabinet (canister filter, CO2) below. Pure SVG + CSS (classes pt-* in globals.css).
// Everything "random" comes from a seeded generator, so the server and the browser draw exactly the same picture.

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

/** Height of the floor (the leaf carpet's top edge) at x: higher at the back corners, a gentle valley in the middle. */
const soil = (x: number) => 768 - 30 * Math.sin((Math.PI * x) / W) + 9 * Math.sin(x / 160) + (x < 520 ? (520 - x) * -0.05 : 0);

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

/** The leafy top edge of the carpet. */
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

/** The filter's intake inside the tank: a clear pipe down the back glass, with a slotted strainer near the soil. */
function Intake({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 7} y={30} width={14} height={600} rx={6} fill="#ffffff" fillOpacity="0.35" stroke="#7fb3a9" strokeOpacity="0.8" strokeWidth="2" />
      <rect x={x - 2} y={34} width={3} height={590} fill="#ffffff" opacity="0.55" />
      <rect x={x - 11} y={612} width={22} height={86} rx={8} fill="#ffffff" fillOpacity="0.4" stroke="#7fb3a9" strokeWidth="2" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={x - 7} y={622 + i * 12} width={14} height={4} rx={2} fill="#7fb3a9" opacity="0.7" />
      ))}
    </g>
  );
}

/** The filter's outflow: a glass lily pipe hooked over the rim, its mouth turned into the tank. */
function LilyPipe({ x }: { x: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={`M${x} 26 L${x} 160 Q${x} 196 ${x - 34} 200`} stroke="#7fb3a9" strokeWidth="16" opacity="0.55" />
      <path d={`M${x} 26 L${x} 160 Q${x} 196 ${x - 34} 200`} stroke="#ffffff" strokeWidth="9" opacity="0.5" />
      <path d={`M${x - 30} 186 Q${x - 52} 190 ${x - 60} 210 Q${x - 44} 214 ${x - 30} 214`} fill="#ffffff" fillOpacity="0.4" stroke="#7fb3a9" strokeWidth="2" />
    </g>
  );
}

/** The CO2 diffuser on the back glass (a glass cup with a ceramic disc) and its thin tube up over the rim. */
function Diffuser({ x, y, airstone = false }: { x: number; y: number; airstone?: boolean }) {
  return (
    <g data-airstone={airstone || undefined}>
      <path d={`M${x + 18} 26 L${x + 18} ${y - 14}`} stroke="#ffffff" strokeWidth="3" opacity="0.7" />
      <path d={`M${x + 18} 26 L${x + 18} ${y - 14}`} stroke="#9cc2bb" strokeWidth="1.2" opacity="0.8" />
      <path d={`M${x + 18} ${y - 14} Q${x + 18} ${y - 4} ${x + 6} ${y + 4}`} stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.7" />
      <ellipse cx={x} cy={y + 14} rx={16} ry={12} fill="#ffffff" fillOpacity="0.45" stroke="#8fbab2" strokeWidth="2" />
      <ellipse cx={x} cy={y + 8} rx={12} ry={5} fill="#f1f4f2" stroke="#c9d6d2" strokeWidth="1.5" />
    </g>
  );
}

/** A CO2 drop checker on the glass: green liquid means the CO2 level is right. */
function DropChecker({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={15} fill="#ffffff" fillOpacity="0.45" stroke="#8fbab2" strokeWidth="2" />
      <path d={`M${x - 10} ${y + 4} Q${x} ${y + 15} ${x + 10} ${y + 4} Z`} fill="#6cc04a" opacity="0.9" />
      <rect x={x - 4} y={y - 34} width={8} height={22} rx={3} fill="#ffffff" fillOpacity="0.5" stroke="#8fbab2" strokeWidth="1.5" />
    </g>
  );
}

/** The LED light resting on the tank's rim, with its glow on the water below. */
export function Light({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 1600 64" preserveAspectRatio="none" className="pointer-events-none relative z-[1] -mb-[2px] block h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id="pt-led-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark ? "#3a4743" : "#2b3a35"} />
          <stop offset="1" stopColor={dark ? "#1d2522" : "#141d1a"} />
        </linearGradient>
      </defs>
      {/* the legs that sit on the rim */}
      <path d="M118 30 L96 64 M1482 30 L1504 64" stroke={dark ? "#9aa9a4" : "#55625e"} strokeWidth="7" strokeLinecap="round" />
      <rect x="80" y="10" width="1440" height="24" rx="12" fill="url(#pt-led-body)" />
      <rect x="96" y="14" width="1408" height="4" rx="2" fill="#ffffff" opacity="0.18" />
      {/* the LEDs along the underside */}
      <rect x="110" y="30" width="1380" height="6" rx="3" fill="#fff8dc" />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={140 + i * 56} cy="33" r="3.2" fill="#ffffff" />
      ))}
    </svg>
  );
}

/**
 * The cabinet the tank stands on, open to show what lives in it: the canister filter (its hoses run up into the tank)
 * and the CO2 cylinder with its regulator.
 */
export function Cabinet({ dark }: { dark: boolean }) {
  const wood = dark ? "#0b261d" : "#113A2D";
  return (
    <svg viewBox="0 0 1600 190" preserveAspectRatio="xMidYMin meet" className="mx-[3%] block h-auto w-[94%]" aria-hidden>
      <rect x="0" y="0" width="1600" height="190" rx="18" fill={wood} />
      <rect x="0" y="0" width="1600" height="16" fill="#000000" opacity="0.25" />
      {/* the open bay */}
      <rect x="70" y="30" width="760" height="140" rx="10" fill="#071711" />
      <rect x="70" y="30" width="760" height="140" rx="10" fill="#ffffff" opacity={dark ? 0.05 : 0.04} />
      {/* canister filter: body, ribs, lid with handle, hoses up to the tank */}
      <path d="M300 56 C 300 40, 300 34, 300 30 M346 56 C 346 40, 346 34, 346 30" stroke="#5c7c74" strokeWidth="10" fill="none" strokeLinecap="round" />
      <rect x="250" y="60" width="150" height="104" rx="14" fill="#3f5651" />
      <rect x="250" y="60" width="150" height="104" rx="14" fill="#ffffff" opacity="0.06" />
      {[86, 106, 126, 146].map((y) => (
        <rect key={y} x="258" y={y} width="134" height="3" rx="1.5" fill="#000000" opacity="0.3" />
      ))}
      <rect x="240" y="52" width="170" height="20" rx="8" fill="#3d514c" />
      <path d="M262 52 Q325 18 388 52" stroke="#4d6560" strokeWidth="7" fill="none" />
      <rect x="236" y="160" width="178" height="8" rx="4" fill="#1d2826" />
      {/* CO2 cylinder: bottle, shoulder, regulator with gauge and solenoid, tubing up */}
      <path d="M606 60 C 606 44, 606 36, 606 30" stroke="#c9d6d2" strokeWidth="3" fill="none" />
      <rect x="540" y="78" width="56" height="88" rx="16" fill="#7d8a87" />
      <rect x="548" y="84" width="9" height="74" rx="4" fill="#ffffff" opacity="0.35" />
      <path d="M546 84 Q568 60 590 84 Z" fill="#c0392b" />
      <rect x="560" y="58" width="16" height="16" rx="3" fill="#8f9b98" />
      <circle cx="584" cy="52" r="13" fill="#d7dedc" stroke="#7d8a87" strokeWidth="3" />
      <path d="M584 52 L590 44" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="598" y="58" width="16" height="14" rx="3" fill="#3a4a46" />
      <rect x="528" y="164" width="80" height="6" rx="3" fill="#1d2826" />
      {/* the closed door and its handle */}
      <rect x="870" y="30" width="660" height="140" rx="10" fill="#ffffff" opacity={dark ? 0.08 : 0.07} />
      <rect x="1180" y="88" width="40" height="8" rx="4" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

/**
 * The planted scene itself - water and light, plants, driftwood, stones, soil and the equipment on the glass - drawn
 * once, with nothing moving but the plants' sway. The static tank below and the interactive aquarium
 * (components/aquarium) both stand their fish on it. `interactive` marks the CO2 diffuser for the aquarium's engine,
 * which then sends its own bubbles up from it.
 */
export function PlantedScene({ id, interactive = false }: { id: string; interactive?: boolean }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className="pt-scene anim-zone absolute inset-0 size-full"
      role="img"
      aria-label="A planted aquarium under an LED light, with a canister filter and CO2 - rocks, driftwood and green plants over a carpet of small leaves"
    >
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
        <linearGradient id={`${id}-bed`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f9f34" />
          <stop offset="1" stopColor="#2c6624" />
        </linearGradient>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b4426" />
          <stop offset="1" stopColor="#94653a" />
        </linearGradient>
        <pattern id={`${id}-leaves`} width="44" height="34" patternUnits="userSpaceOnUse">
          <ellipse cx="4" cy="5" rx="6" ry="3.4" fill="#5fb83a" transform="rotate(-30 4 5)" />
          <ellipse cx="15" cy="3" rx="5.5" ry="3" fill="#7fcd4c" transform="rotate(25 15 3)" />
          <ellipse cx="27" cy="6" rx="6.2" ry="3.4" fill="#4a9d2f" transform="rotate(-15 27 6)" />
          <ellipse cx="38" cy="4" rx="5" ry="2.8" fill="#93d65a" transform="rotate(40 38 4)" />
          <ellipse cx="9" cy="14" rx="6" ry="3.2" fill="#3f8a2c" transform="rotate(20 9 14)" />
          <ellipse cx="21" cy="13" rx="5.6" ry="3.2" fill="#6cc04a" transform="rotate(-40 21 13)" />
          <ellipse cx="33" cy="15" rx="6.4" ry="3.4" fill="#7fcd4c" transform="rotate(10 33 15)" />
          <ellipse cx="43" cy="13" rx="5" ry="3" fill="#5fb83a" transform="rotate(-25 43 13)" />
          <ellipse cx="3" cy="23" rx="5.8" ry="3.2" fill="#4a9d2f" transform="rotate(35 3 23)" />
          <ellipse cx="15" cy="24" rx="6.2" ry="3.4" fill="#93d65a" transform="rotate(-10 15 24)" />
          <ellipse cx="27" cy="22" rx="5.4" ry="3" fill="#3f8a2c" transform="rotate(30 27 22)" />
          <ellipse cx="39" cy="25" rx="6" ry="3.4" fill="#6cc04a" transform="rotate(-35 39 25)" />
          <ellipse cx="10" cy="31" rx="5.6" ry="3" fill="#5fb83a" transform="rotate(15 10 31)" />
          <ellipse cx="22" cy="31" rx="6" ry="3.2" fill="#7fcd4c" transform="rotate(-20 22 31)" />
          <ellipse cx="34" cy="32" rx="5.2" ry="3" fill="#4a9d2f" transform="rotate(25 34 32)" />
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

      {/* the filter's intake and outflow, and the CO2 drop checker, on the back glass */}
      <Intake x={232} />
      <LilyPipe x={1408} />
      <DropChecker x={1486} y={330} />

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
      {/* the CO2 diffuser behind the small rock: its fine bubbles rise on the moving layer */}
      <Diffuser x={1346} y={668} airstone={interactive} />

      <Sword x={1500} seed={17} />

      {/* the floor: no soil showing - a carpet of small leaves over all of it, thicker along its top edge */}
      <path d={SOIL_PATH} fill={`url(#${id}-bed)`} />
      <path d={SOIL_PATH} fill={`url(#${id}-leaves)`} />
      <Tufts xs={[460, 560, 700, 820, 960, 1060, 1240, 1400]} seed={21} />
      <Carpet seed={23} />
    </svg>
  );
}
