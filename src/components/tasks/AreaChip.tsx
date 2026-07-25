import { areaColor, type Area } from "@/lib/tasks/areas";

export function AreaChip({ area, inherited = false }: { area?: Area; inherited?: boolean }) {
  if (!area) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        inherited ? "opacity-70" : ""
      }`}
      style={{
        color: areaColor(area.hue),
        backgroundColor: `hsl(${area.hue} 60% 45% / 0.12)`,
      }}
      title={inherited ? `${area.name} (from its project)` : area.name}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: areaColor(area.hue) }}
        aria-hidden
      />
      {area.name}
    </span>
  );
}
