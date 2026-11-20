import { ART, type ArtKind, svg } from "./art";

/**
 * The aquarium's simulation: three schools - neon tetras, rummy-nose tetras and harlequin rasboras - swimming gently
 * in the planted tank. Every fish, bubble and food flake is a plain DOM element that this loop moves each frame (React
 * only renders the scenery and the controls around it). Coordinates are px inside the water.
 *
 * Fish wander their depth band and school with their own kind; they come for food, chase the play dot, startle away
 * from a tap on the glass, and drift with the current a swipe makes. In the shop's tank every receipt adds a neon tetra
 * and every customer a harlequin; on the customer form the customer's own fish is a rummy-nose.
 */

export type Tool = "explore" | "feed" | "play" | "clean";
export type Kind = ArtKind;

export interface FishInfo {
  key: string;
  kind: Kind;
  species: string;
  name: string;
  fact: string;
  adoptable: boolean;
}
export interface SchoolFish {
  key: string;
  name: string;
  fact: string;
}
export interface EngineOpts {
  onSelect: (info: FishInfo | null) => void;
  onWipe: (x: number, y: number, start: boolean) => void;
}

type Vec = { x: number; y: number };
interface Agent extends Vec {
  key: string;
  kind: Kind;
  el: HTMLDivElement;
  vx: number;
  vy: number;
  w: number; // base width (px, before depth scale)
  h: number;
  z: number; // 0 near … 1 far
  speed: number;
  goal: Vec;
  flip: number; // which way it faces (±1)
  turn: number; // what's drawn: eases from one side to the other, so a turn is a quick swing, not a snap
  lastFlip: number;
  phase: number;
  info: Omit<FishInfo, "key" | "kind">;
  loop?: Vec; // centre of the celebration loop
}
interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  el: HTMLElement;
}
interface Food extends Vec {
  el: HTMLElement;
  seed: number;
  settled: number; // time it reached the plants (0 = still falling)
}

type Spec = { species: string; name: string; fact: string; w: number; z: [number, number]; speed: number; band: [number, number] };
/** The three fish in the tank, and how each swims. */
const SPECIES: Record<Kind, Spec> = {
  neon: { species: "Neon tetra", name: "Neon", fact: "Its glowing blue stripe keeps the school together in dark water.", w: 32, z: [0.5, 0.8], speed: 48, band: [0.12, 0.55] },
  rummy: { species: "Rummy-nose tetra", name: "Ruby", fact: "Its red nose fades when the water isn't right - fishkeepers use it as a living water test.", w: 35, z: [0.3, 0.7], speed: 44, band: [0.18, 0.62] },
  harlequin: { species: "Harlequin rasbora", name: "Harley", fact: "Named after the black triangle on its side - like a harlequin's costume.", w: 35, z: [0.1, 0.55], speed: 38, band: [0.3, 0.72] },
};
const CAST: [Kind, number][] = [
  ["neon", 9],
  ["rummy", 8],
  ["harlequin", 7],
];
/** Which school the shop's fish join: a neon tetra for every receipt, a harlequin for every customer. */
const SCHOOL_KIND = { receipt: "neon", customer: "harlequin" } as const;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const len = (x: number, y: number) => Math.hypot(x, y) || 1;
const toward = (from: Vec, to: Vec, speed: number): Vec => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const l = len(dx, dy);
  return { x: (dx / l) * speed, y: (dy / l) * speed };
};

export function createEngine(root: HTMLElement, layers: { far: HTMLElement; near: HTMLElement; fx: HTMLElement; ui: HTMLElement }, opts: EngineOpts) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = root.clientWidth;
  let H = root.clientHeight;
  let k = clamp(W / 1000, 0.62, 1); // fish size for this tank width
  const floor = () => H - (W >= 640 ? 50 : 44); // just above the leaf carpet
  const surface = 12;

  const agents: Agent[] = [];
  const bubbles: Bubble[] = [];
  const food: Food[] = [];
  const tags = new Map<string, HTMLElement>();
  let names: Record<string, string> = {};
  let tool: Tool = "explore";
  let t = 0;
  let selected: string | null = null;
  const flow = { x: 0, y: 0 }; // the current, px/s
  let celebrateUntil = 0;
  let nextAir = 0;
  const laser = { x: 0, y: 0, on: false };

  // the CO2 diffuser in the scenery, where the bubbles rise from
  const findAir = (): Vec => {
    const el = root.querySelector("[data-airstone]");
    if (!el) return { x: W * 0.84, y: floor() - 20 };
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
  };
  let air = findAir();

  // ---------- fish ----------
  const bandPoint = (kind: Kind): Vec => {
    const [lo, hi] = SPECIES[kind].band;
    return { x: rand(W * 0.06, W * 0.94), y: clamp(rand(H * lo, H * hi), surface + 20, floor() - 24) };
  };
  const size = (a: Agent) => {
    const [vw, vh] = ART[a.kind];
    a.w = SPECIES[a.kind].w * k;
    a.h = (a.w * vh) / vw;
    a.el.style.width = `${a.w}px`;
    a.el.style.height = `${a.h}px`;
  };
  const measure = () => {
    W = root.clientWidth;
    H = root.clientHeight;
    k = clamp(W / 1000, 0.62, 1);
    air = findAir();
    for (const a of agents) size(a);
  };

  function spawn(kind: Kind, key: string, at?: Vec) {
    const sp = SPECIES[kind];
    const el = document.createElement("div");
    el.className = `tank-agent tank-${kind}`;
    el.innerHTML = svg(kind);
    const z = rand(sp.z[0], sp.z[1]);
    // depth: far fish are smaller, softer and paler
    if (z > 0.5) {
      el.style.filter = `blur(${((z - 0.5) * 2.2).toFixed(2)}px) saturate(${(1 - z * 0.35).toFixed(2)}) brightness(${(1 - z * 0.12).toFixed(2)})`;
      el.style.opacity = String(1 - z * 0.25);
    }
    (z > 0.55 ? layers.far : layers.near).appendChild(el);
    const idx = Number(key.split("-").pop()) || 0;
    const a: Agent = {
      key,
      kind,
      el,
      x: 0,
      y: 0,
      vx: rand(-10, 10),
      vy: 0,
      w: 0,
      h: 0,
      z,
      speed: sp.speed * rand(0.85, 1.15),
      goal: { x: 0, y: 0 },
      flip: 1,
      turn: 1,
      lastFlip: -9,
      phase: rand(0, 6.28),
      info: { species: sp.species, name: `${sp.name} ${idx + 1}`, fact: sp.fact, adoptable: true },
    };
    size(a);
    const p = at ?? bandPoint(kind);
    a.x = p.x;
    a.y = p.y;
    a.goal = bandPoint(kind);
    agents.push(a);
    return a;
  }
  const remove = (a: Agent) => {
    a.el.remove();
    tags.get(a.key)?.remove();
    tags.delete(a.key);
    const i = agents.indexOf(a);
    if (i >= 0) agents.splice(i, 1);
    if (selected === a.key) select(null);
  };

  // on a phone-sized tank the schools are smaller, so cheap phones keep a smooth frame rate
  const small = root.clientWidth < 640;
  for (const [kind, n] of CAST) for (let i = 0; i < (small ? Math.ceil(n / 2) : n); i++) spawn(kind, `${kind}-${i}`);

  // ---------- bubbles and food ----------
  const bubble = (x: number, y: number, r = rand(2.5, 5)) => {
    if (bubbles.length > 80) return;
    const el = document.createElement("span");
    el.className = "tank-bubble-dot";
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    layers.fx.appendChild(el);
    bubbles.push({ x, y, r, vy: rand(38, 60) * (r / 4), phase: rand(0, 6.28), el });
  };
  const ripple = (x: number, y: number) => {
    const el = document.createElement("span");
    el.className = "tank-ripple";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    layers.fx.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  };
  const dropFood = (x: number, y: number, n = 4) => {
    for (let i = 0; i < n && food.length < 50; i++) {
      const el = document.createElement("span");
      el.className = "tank-food";
      layers.fx.appendChild(el);
      food.push({ x: x + rand(-16, 16), y: y + rand(-6, 6), seed: rand(0, 6), el, settled: 0 });
    }
  };
  const tapGlass = (x: number, y: number) => {
    ripple(x, y);
    for (const a of agents) {
      const d = len(a.x - x, a.y - y);
      const R = 170 * k;
      if (d > R) continue;
      const push = 260 * (1 - d / R);
      a.vx += ((a.x - x) / d) * push;
      a.vy += ((a.y - y) / d) * push;
    }
  };

  // ---------- selection ----------
  function select(key: string | null) {
    root.querySelector(".is-picked")?.classList.remove("is-picked");
    selected = key;
    const a = key ? agents.find((x) => x.key === key) : null;
    a?.el.classList.add("is-picked");
    opts.onSelect(a ? { key: a.key, kind: a.kind, ...a.info, name: names[a.key] ?? a.info.name } : null);
  }
  const hit = (x: number, y: number): string | null => {
    // the nearest fish first; small fish get a slightly bigger target so they can be tapped on a phone
    for (const a of [...agents].sort((p, q) => p.z - q.z)) {
      const s = 1 - a.z * 0.4;
      const hw = Math.max((a.w * s) / 2, 14);
      const hh = Math.max((a.h * s) / 2, 14);
      if (Math.abs(x - a.x) < hw && Math.abs(y - a.y) < hh) return a.key;
    }
    return null;
  };

  // ---------- pointer ----------
  const drag = { down: false, x: 0, y: 0, lx: 0, ly: 0, lt: 0, moved: false, id: -1 };
  const local = (e: PointerEvent): Vec => {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest("[data-tank-ui]")) return;
    const p = local(e);
    Object.assign(drag, { down: true, x: p.x, y: p.y, lx: p.x, ly: p.y, lt: performance.now(), moved: false, id: e.pointerId });
    if (tool === "play") Object.assign(laser, p, { on: true });
    if (tool === "clean") {
      try {
        root.setPointerCapture(e.pointerId); // keep scrubbing even when the finger leaves the glass
      } catch {
        /* pointer already gone */
      }
      opts.onWipe(p.x, p.y, true);
    } else if (tool === "feed") dropFood(p.x, Math.min(p.y, floor() - 10));
  };
  const onMove = (e: PointerEvent) => {
    const p = local(e);
    if (tool === "play") Object.assign(laser, p, { on: true }); // the dot follows a hovering mouse too
    if (!drag.down || e.pointerId !== drag.id) return;
    if (tool === "clean") return opts.onWipe(p.x, p.y, false);
    if (tool !== "explore") return;
    const now = performance.now();
    const dt = Math.max(0.008, (now - drag.lt) / 1000);
    if (!drag.moved && len(p.x - drag.x, p.y - drag.y) > 10) drag.moved = true;
    if (drag.moved) {
      // a swipe stirs the water in its direction
      flow.x = clamp(flow.x * 0.7 + ((p.x - drag.lx) / dt) * 0.12, -240, 240);
      flow.y = clamp(flow.y * 0.7 + ((p.y - drag.ly) / dt) * 0.05, -70, 70);
    }
    Object.assign(drag, { lx: p.x, ly: p.y, lt: now });
  };
  const onUp = (e: PointerEvent) => {
    if (!drag.down || e.pointerId !== drag.id) return;
    drag.down = false;
    if (e.pointerType !== "mouse" && tool === "play") laser.on = false; // a finger lifting takes the dot away
    if (tool !== "explore" || drag.moved) return;
    const key = hit(drag.x, drag.y);
    if (key) select(key);
    else {
      select(null);
      tapGlass(drag.x, drag.y);
    }
  };
  const onLeave = () => {
    laser.on = false;
  };
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("pointerleave", onLeave);

  const laserEl = document.createElement("span");
  laserEl.className = "tank-laser";
  layers.ui.append(laserEl);

  // ---------- the shop's schools ----------
  const setSchool = (which: "receipt" | "customer", list: SchoolFish[], arrive: boolean) => {
    const prefix = `${which}-`;
    const want = new Map(list.map((f) => [f.key, f]));
    for (const a of agents.filter((x) => x.key.startsWith(prefix) && !want.has(x.key))) remove(a);
    for (const f of list) {
      const have = agents.find((x) => x.key === f.key);
      const info = { species: `${SPECIES[SCHOOL_KIND[which]].species} · ${which === "receipt" ? "receipt" : "customer"} fish`, name: f.name, fact: f.fact, adoptable: false };
      if (have) {
        have.info = info;
        continue;
      }
      // new members swim in from the side; the first load just places them
      const a = spawn(SCHOOL_KIND[which], f.key, arrive ? { x: Math.random() < 0.5 ? -20 : W + 20, y: rand(H * 0.2, H * 0.6) } : undefined);
      a.info = info;
    }
  };

  // ---------- frame ----------
  let raf = 0;
  let lastNow = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000);
    lastNow = now;
    t += dt;
    step(dt);
    render(dt);
    raf = requestAnimationFrame(frame);
  };

  function step(dt: number) {
    const fy = floor();
    const celebrating = t < celebrateUntil;

    // the current fades
    flow.x *= Math.exp(-dt * 1.1);
    flow.y *= Math.exp(-dt * 1.6);

    // CO2 bubbles from the diffuser
    if (t > nextAir) {
      nextAir = t + rand(0.25, 0.5);
      bubble(air.x + rand(-4, 4), air.y - 4);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]!;
      b.y -= b.vy * dt;
      b.x += Math.sin(t * 3 + b.phase) * 14 * dt + flow.x * 0.7 * dt;
      if (b.y < surface + b.r) {
        b.el.remove();
        bubbles.splice(i, 1);
      }
    }

    // food falls, drifts with the current, and rests on the plants for a while
    for (let i = food.length - 1; i >= 0; i--) {
      const f = food[i]!;
      if (!f.settled) {
        f.y += 24 * dt;
        f.x += (Math.sin(t * 2 + f.seed) * 8 + flow.x * 0.6) * dt;
        if (f.y >= fy - 4) f.settled = t;
      } else if (t - f.settled > 8) {
        f.el.remove();
        food.splice(i, 1);
      }
    }

    if (tool === "play" && laser.on) laserEl.style.transform = `translate3d(${laser.x}px, ${laser.y}px, 0) translate(-50%, -50%)`;
    laserEl.style.opacity = tool === "play" && laser.on ? "1" : "0";

    // where each school is and where it's heading
    const groups = new Map<Kind, { x: number; y: number; vx: number; vy: number; n: number }>();
    for (const a of agents) {
      const g = groups.get(a.kind) ?? { x: 0, y: 0, vx: 0, vy: 0, n: 0 };
      g.x += a.x;
      g.y += a.y;
      g.vx += a.vx;
      g.vy += a.vy;
      g.n++;
      groups.set(a.kind, g);
    }

    for (const a of agents) {
      const speed = a.speed * k;
      if (Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < 24) a.goal = bandPoint(a.kind);
      let want = toward(a, a.goal, speed);

      // schooling: stay with the group, swim its way, and keep a little room
      const g = groups.get(a.kind);
      if (g && g.n > 1) {
        want.x += (g.x / g.n - a.x) * 0.25 + (g.vx / g.n) * 0.3;
        want.y += (g.y / g.n - a.y) * 0.25 + (g.vy / g.n) * 0.3;
        for (const o of agents) {
          if (o === a || o.kind !== a.kind) continue;
          const d = len(a.x - o.x, a.y - o.y);
          if (d < 16 * k) {
            want.x += ((a.x - o.x) / d) * 40;
            want.y += ((a.y - o.y) / d) * 40;
          }
        }
      }
      // the play dot: they chase it
      if (tool === "play" && laser.on && len(laser.x - a.x, laser.y - a.y) < 380 * k) {
        want = toward(a, { x: laser.x + Math.sin(t * 5 + a.phase) * 18, y: laser.y + Math.cos(t * 4 + a.phase) * 14 }, speed * 2.4);
      }
      // food
      if (food.length) {
        let best = -1;
        let bd = 240 * k;
        food.forEach((f, i) => {
          const d = len(f.x - a.x, f.y - a.y);
          if (d < bd) [best, bd] = [i, d];
        });
        if (best >= 0) {
          want = toward(a, food[best]!, speed * 2.2);
          if (bd < 9 * k) {
            food[best]!.el.remove();
            food.splice(best, 1);
          }
        }
      }
      // celebration: a happy loop-the-loop
      if (celebrating) {
        a.loop ??= { x: a.x, y: a.y };
        const ang = t * 3.2 + a.phase;
        want = toward(a, { x: a.loop.x + Math.cos(ang) * 34 * k, y: a.loop.y + Math.sin(ang) * 34 * k }, speed * 3);
      } else a.loop = undefined;

      // walls, then steer
      if (a.y < surface + 24) want.y += 50;
      if (a.y > fy - 20) want.y -= 60;
      if (a.x < 12) want.x += 50;
      if (a.x > W - 12) want.x -= 50;
      const kk = Math.min(1, dt * 2.5);
      a.vx += (want.x - a.vx) * kk;
      a.vy += (want.y - a.vy) * kk;
      const drift = 0.8 * (1 - a.z * 0.3);
      a.x += (a.vx + flow.x * drift) * dt;
      a.y += (a.vy + flow.y * drift) * dt;
    }
  }

  function render(dt = 0) {
    for (const a of agents) {
      // turn around only when clearly swimming the other way, and not again straight after a turn -
      // otherwise a fish hovering at a spot flips left-right every frame
      const side = a.vx < 0 ? -1 : 1;
      if (side !== a.flip && Math.abs(a.vx) > 18 * k && t - a.lastFlip > 0.9) {
        a.flip = side;
        a.lastFlip = t;
      }
      a.turn = dt ? a.turn + (a.flip - a.turn) * Math.min(1, dt * 11) : a.flip;
      const s = 1 - a.z * 0.4;
      const tilt = clamp(Math.atan2(a.vy, Math.abs(a.vx) + 1), -0.45, 0.45) + Math.sin(t * 7 + a.phase) * 0.035;
      a.el.style.transform = `translate3d(${a.x - a.w / 2}px, ${a.y - a.h / 2}px, 0) scale(${a.turn * s}, ${s}) rotate(${tilt}rad)`;
      const tag = tags.get(a.key);
      if (tag) tag.style.transform = `translate3d(${a.x}px, ${a.y - (a.h * s) / 2 - 10}px, 0) translate(-50%, -100%)`;
    }
    for (const b of bubbles) b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0) translate(-50%, -50%)`;
    for (const f of food) f.el.style.transform = `translate3d(${f.x}px, ${f.y}px, 0)`;
  }

  // ---------- run only while visible ----------
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  window.setTimeout(measure, 50); // after the scenery has laid out
  const io = new IntersectionObserver(([e]) => {
    cancelAnimationFrame(raf);
    lastNow = 0;
    if (e?.isIntersecting && !reduce) raf = requestAnimationFrame(frame);
  });
  io.observe(root);
  if (reduce) window.setTimeout(() => render(), 60);

  return {
    setTool(next: Tool) {
      if (tool === "play" && next !== "play") laser.on = false;
      tool = next;
      root.dataset.tool = next;
    },
    /** Names given to adopted fish, shown on a tag above them. */
    setNames(next: Record<string, string>) {
      names = next;
      for (const [key, el] of tags) {
        if (names[key]) continue;
        el.remove();
        tags.delete(key);
      }
      for (const [key, name] of Object.entries(names)) {
        let el = tags.get(key);
        if (!el) {
          el = document.createElement("span");
          el.className = "tank-tag";
          layers.ui.appendChild(el);
          tags.set(key, el);
        }
        el.textContent = `♥ ${name}`;
      }
    },
    setSchool,
    /** The customer's own fish on the form page: a rummy-nose that swims in and joins the school. */
    addGuest(name: string) {
      if (agents.some((a) => a.key === "guest-you")) return;
      const a = spawn("rummy", "guest-you", { x: -40, y: H * 0.4 });
      a.info = { species: "Your fish · rummy-nose tetra", name, fact: "Joined the tank the moment you sent your details. Welcome aboard!", adoptable: false };
      a.goal = { x: W * 0.5, y: H * 0.4 };
      for (let i = 0; i < 12; i++) window.setTimeout(() => bubble(rand(20, 80), H * 0.4 + rand(-20, 20), rand(2, 4)), i * 60);
    },
    /** New receipts or a customer who has paid in full: the fish loop-the-loop and bubbles rise. */
    celebrate() {
      celebrateUntil = t + 4.5;
      for (let i = 0; i < 40; i++) window.setTimeout(() => bubble(rand(W * 0.05, W * 0.95), H - rand(30, 60)), i * 40);
    },
    measure,
    select,
    /** Where a fish is now, for the name card. */
    where(key: string): Vec | null {
      const a = agents.find((x) => x.key === key);
      return a ? { x: a.x, y: a.y - (a.h * (1 - a.z * 0.4)) / 2 } : null;
    },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("pointerleave", onLeave);
      for (const l of Object.values(layers)) l.replaceChildren();
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
