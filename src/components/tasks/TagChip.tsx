import { cn } from "@/lib/utils";

export function TagChip({
  tag,
  active,
  onClick,
  onRemove,
}: {
  tag: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        onClick && "cursor-pointer hover:bg-accent",
        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
      )}
    >
      #{tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 text-muted-foreground hover:text-foreground"
          aria-label={`Remove tag ${tag}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
