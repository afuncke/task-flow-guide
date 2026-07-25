import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { taskDialogStore } from "@/lib/tasks/dialog-store";

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

      // Leader sequence: g f, g p, g b, g c, g t
      if (leader === "g") {
        const map: Record<string, string> = {
          f: "/focus",
          p: "/plan",
          b: "/board",
          c: "/calendar",
          t: "/tasks",
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
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (leaderTimer) window.clearTimeout(leaderTimer);
    };
  }, [navigate, onShowHelp]);
}
