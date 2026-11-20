// SVG art for the aquarium's fish: the tank's three schools, all drawn 48 units long and facing right (the engine
// mirrors them). The tail carries "tank-tail", which beats in CSS.

export type ArtKind = "neon" | "rummy" | "harlequin";

/** [viewBox width, viewBox height, markup] */
export const ART: Record<ArtKind, [number, number, string]> = {
  // neon tetra: see-through silver body, an electric-blue stripe from the eye to the tail, red along the lower back half
  neon: [
    48,
    16,
    `<g transform="translate(0 8)">
      <path class="tank-tail" d="M1 -6.2 L12 0 L1 6.2 Q4.5 0 1 -6.2 Z" fill="#dce7ed" fill-opacity="0.75"/>
      <ellipse cx="27" cy="0" rx="17" ry="5.2" fill="#e4edf1"/>
      <path d="M12 1.2 Q22 1.5 31.5 1.4 Q30.5 4.4 26 5 Q18 5.2 12 2.8 Z" fill="#e1323c"/>
      <path d="M13 -1.4 Q27 -3.4 42 -1.8 L42 0.4 Q27 -0.8 13 0.9 Z" fill="#1fb6f2"/>
      <path d="M13 -0.9 Q27 -2.7 41 -1.2" stroke="#9ff0ff" stroke-width="0.6" fill="none"/>
      <path d="M22 -4.9 Q25 -8.8 29 -4.9" fill="#dce7ed"/>
      <circle cx="40" cy="-0.6" r="2" fill="#dfe9f1"/>
      <circle cx="40.3" cy="-0.6" r="1.2" fill="#111"/>
    </g>`,
  ],
  // rummy-nose tetra: silver body, bright red nose, black-and-white striped tail
  rummy: [
    48,
    18,
    `<g transform="translate(0 9)">
      <path class="tank-tail" d="M1 -7 L12 0 L1 7 Q4.5 0 1 -7 Z" fill="#f4f7f8" fill-opacity="0.92"/>
      <path d="M0.6 -1.3 L12 -0.5 L12 0.5 L0.6 1.3 Z" fill="#1c2124"/>
      <path d="M1.8 -6 L7 -3.4 L6.4 -2.4 L1.6 -4.4 Z" fill="#1c2124"/>
      <path d="M1.8 6 L7 3.4 L6.4 2.4 L1.6 4.4 Z" fill="#1c2124"/>
      <ellipse cx="27" cy="0" rx="17" ry="5.6" fill="#e3eaec"/>
      <path d="M13 -2.6 Q27 -6.2 40 -3" stroke="#c9d9c8" stroke-width="1.4" fill="none"/>
      <path d="M22 -5.4 Q25 -9.6 29 -5.4" fill="#e3eaec"/>
      <path d="M33 -5.2 Q42 -4.6 45 0 Q42 4.6 33 5.2 Q36.5 0 33 -5.2 Z" fill="#e2333b"/>
      <circle cx="40" cy="-0.8" r="2.1" fill="#ffd9d9"/>
      <circle cx="40.3" cy="-0.8" r="1.25" fill="#1b1416"/>
    </g>`,
  ],
  // harlequin rasbora: copper-pink body with the black wedge on its side
  harlequin: [
    48,
    20,
    `<g transform="translate(0 10)">
      <path class="tank-tail" d="M1 -7.6 L12 0 L1 7.6 Q4.5 0 1 -7.6 Z" fill="#f08c63" fill-opacity="0.75"/>
      <ellipse cx="27" cy="0" rx="17" ry="7.6" fill="#f2a27f"/>
      <path d="M13 1 Q27 9 41 2" fill="#f7c3a4" fill-opacity="0.7"/>
      <path d="M27 -5.6 L13 0.4 L27 6.2 Q29.5 0.6 27 -5.6 Z" fill="#231b1c"/>
      <path d="M20 -7.2 Q25 -12.6 31 -7.2" fill="#e8734d" fill-opacity="0.85"/>
      <path d="M24 7 Q27 11 31 7" fill="#e8734d" fill-opacity="0.7"/>
      <circle cx="39.5" cy="-1.4" r="2.2" fill="#fff4ee"/>
      <circle cx="39.8" cy="-1.4" r="1.3" fill="#1b1416"/>
    </g>`,
  ],
};

export const svg = (kind: ArtKind) => {
  const [w, h, body] = ART[kind];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="overflow:visible;display:block">${body}</svg>`;
};
