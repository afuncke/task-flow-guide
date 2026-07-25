import { useSyncExternalStore } from "react";
import { areaStore, type Area } from "@/lib/tasks/areas";

export function useAreas(): {
  areas: Area[];
  filter: string | null;
  areaById: (id?: string) => Area | undefined;
} {
  const state = useSyncExternalStore(
    areaStore.subscribe,
    areaStore.getSnapshot,
    areaStore.getServerSnapshot,
  );
  return {
    areas: state.areas,
    filter: state.filter,
    areaById: (id?: string) => (id ? state.areas.find((a) => a.id === id) : undefined),
  };
}
