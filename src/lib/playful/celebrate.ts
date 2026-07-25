import { isPlayful } from "./store";

const PRAISE = [
  "Nice one! 🎉",
  "Boom. Done. 💥",
  "Look at you go! 🚀",
  "That's one less thing 🌤️",
  "Chef's kiss 😙",
  "Momentum unlocked ⚡",
  "You did the thing! 🏆",
  "Smooth. Very smooth. 🛼",
];

const CONFETTI_COLORS = ["#ff7ab8", "#ffd166", "#5ee7c4", "#8f7bff", "#ff9f5a", "#6ec6ff"];

export function praiseLine() {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

/**
 * Confetti burst + a floating praise line. No-op unless playful mode is on.
 * Uses the Web Animations API so no extra keyframes are needed.
 */
export function celebrate(
  origin?: { x: number; y: number },
  opts: { praise?: boolean } = {},
) {
  if (!isPlayful() || typeof document === "undefined") return;
  const praise = opts.praise ?? true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    if (praise) toast(praiseLine());
    return;
  }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.35;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);

  const count = 44;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("span");
    const size = 6 + Math.random() * 7;
    const round = Math.random() > 0.6;
    bit.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${
      size * (round ? 1 : 0.5)
    }px;background:${
      CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    };border-radius:${round ? "50%" : "2px"};will-change:transform,opacity`;
    layer.appendChild(bit);

    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 190;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist * 0.6 + 160 + Math.random() * 140;
    const dur = 900 + Math.random() * 700;

    bit.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx * 0.6}px,${dy * 0.25 - 60}px) rotate(${
            Math.random() * 240
          }deg)`,
          opacity: 1,
          offset: 0.35,
        },
        {
          transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720}deg)`,
          opacity: 0,
        },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
    );
  }

  window.setTimeout(() => layer.remove(), 1800);
  if (praise) toast(praiseLine());
}

/** Floating playful toast. */
export function toast(text: string) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.className = "playful-toast";
  document.body.appendChild(el);
  el.animate(
    [
      { transform: "translate(-50%, 20px) scale(.9)", opacity: 0 },
      { transform: "translate(-50%, 0) scale(1)", opacity: 1, offset: 0.15 },
      { transform: "translate(-50%, 0) scale(1)", opacity: 1, offset: 0.75 },
      { transform: "translate(-50%, -14px) scale(.96)", opacity: 0 },
    ],
    { duration: 2200, easing: "ease-out", fill: "forwards" },
  );
  window.setTimeout(() => el.remove(), 2300);
}
