import { TagChip } from "./TagChip";

export function TagFilterBar({
  tags,
  active,
  onToggle,
  onClear,
}: {
  tags: string[];
  active: string[];
  onToggle: (t: string) => void;
  onClear: () => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip key={t} tag={t} active={active.includes(t)} onClick={() => onToggle(t)} />
      ))}
      {active.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          clear
        </button>
      )}
    </div>
  );
}
