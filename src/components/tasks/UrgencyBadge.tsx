export function UrgencyBadge({ value }: { value: number }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
      u{value.toFixed(1)}
    </span>
  );
}
