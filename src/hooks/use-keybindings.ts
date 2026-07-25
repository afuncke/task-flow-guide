import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { taskDialogStore } from "@/lib/tasks/dialog-store";
import { captureStore } from "@/lib/tasks/capture-store";
import { areaStore } from "@/lib/tasks/areas";
import { undoStore } from "@/lib/tasks/undo";


import { playfulStore } from "@/lib/playful/store";
import { celebrate, toast } from "@/lib/playful/celebrate";
import { soundSparkle } from "@/lib/playful/sound";
import { COPY } from "@/lib/playful/copy";

const LEADER_TIMEOUT = 800;

/**
 * Global vi-flavored keybindings. Skipped when focus is in an input,
 * textarea, contenteditable, or select. `Esc` blurs any focused input.
 *
 * Route-specific shortcuts (like next/prev period) dispatch a window
 * event `shenas:key` with a detail string; routes listen and act.
 */
export function useKeybindings(onShowHelp: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    let leader: string | null = null;
    let leaderTimer: number | undefined;

    const clearLeader = () => {
      leader = null;
      if (leaderTimer) window.clearTimeout(leaderTimer);
      leaderTimer = undefined;
    };

    const dispatch = (kind: string) => {
      window.dispatchEvent(new CustomEvent("shenas:key", { detail: kind }));
    };

    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const handler = (e: KeyboardEvent) => {
      // Esc always: blur inputs & close dialogs
      if (e.key === "Escape") {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        clearLeader();
        return;
      }

      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Leader sequence: g f, g p, g b, g c, g t, g i, g r
      if (leader === "g") {
        const map: Record<string, string> = {
          f: "/focus",
          p: "/plan",
          b: "/board",
          c: "/calendar",
          t: "/tasks",
          i: "/inbox",
          r: "/projects",
        };
        const path = map[e.key];

        clearLeader();
        if (path) {
          e.preventDefault();
          navigate({ to: path });
        }
        return;
      }

      switch (e.key) {
        case "g":
          leader = "g";
          leaderTimer = window.setTimeout(clearLeader, LEADER_TIMEOUT);
          e.preventDefault();
          return;
        case "n":
          e.preventDefault();
          taskDialogStore.openNew();
          return;
        case "c":
          e.preventDefault();
          captureStore.open();
          return;
        case "u": {
          e.preventDefault();
          const undone = undoStore.undo();
          toast(undone ? `Undone · ${undone}` : "Nothing to undo");
          return;
        }
        case "a": {
          e.preventDefault();
          const next = areaStore.cycleFilter();
          const area = areaStore.getSnapshot().areas.find((x) => x.id === next);
          toast(area ? `Area: ${area.name}` : "All areas");
          return;
        }


        case "?":
          e.preventDefault();
          onShowHelp();
          return;
        case "[":
          e.preventDefault();
          dispatch("prev-period");
          return;
        case "]":
          e.preventDefault();
          dispatch("next-period");
          return;
        case "T":
          e.preventDefault();
          dispatch("today");
          return;
        case "R":
          e.preventDefault();
          dispatch("replan");
          return;
        case "s":
          e.preventDefault();
          dispatch("jump-scheduled");
          return;
        case "L":
          e.preventDefault();
          dispatch("soft-landing");
          return;
        case "p": {
          e.preventDefault();
          const on = playfulStore.toggle();
          if (on) {
            soundSparkle();
            celebrate({ x: window.innerWidth / 2, y: 80 }, { praise: false });
            toast(COPY.playfulOn[1]);
          } else {
            toast(COPY.playfulOff[0]);
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (leaderTimer) window.clearTimeout(leaderTimer);
    };
  }, [navigate, onShowHelp]);
}
