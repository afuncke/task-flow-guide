import { usePlayful } from "./store";

/**
 * Playful ↔ plain copy pairs. Add here rather than inline so tone stays
 * consistent and switching modes flips every string at once.
 */
export const COPY = {
  brand: ["Shenas", "Shenas ✨"],
  newTask: ["New task", "Add a thing"],
  plan: ["Plan", "Today"],
  focus: ["Focus", "Now"],
  board: ["Board", "Stuff"],
  calendar: ["Calendar", "Ahead"],
  all: ["All", "Everything"],
  playfulOn: ["Playful mode on", "Playful mode: ON 🎈"],
  playfulOff: ["Playful mode off", "Back to plain mode"],
} as const;

type Key = keyof typeof COPY;

export function usePlayfulCopy() {
  const playful = usePlayful();
  return (key: Key) => COPY[key][playful ? 1 : 0];
}
