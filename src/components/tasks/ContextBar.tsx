import { useContextState } from "@/hooks/use-context-state";
import {
  DURATIONS,
  DURATION_LABEL,
  ENERGIES,
  ENERGY_LABEL,
  LOCATIONS,
  LOCATION_LABEL,
  WORK_WINDOW_LABEL,
  type Duration,
  type Energy,
  type Location,
} from "@/lib/tasks/context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Briefcase, Coffee, MapPin, Timer, Zap } from "lucide-react";

export function ContextBar() {
  const {
    hydrated,
    stored,
    currentState,
    autoEnergy,
    setLocation,
    setEnergy,
    setAutoEnergy,
    setDuration,
    setHideMismatches,
  } = useContextState();

  if (!hydrated) {
    return <div className="h-10 border-b bg-muted/20" aria-hidden />;
  }

  return (
    <div className="border-b bg-muted/20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-xs">
        <span className="mr-1 text-muted-foreground">I'm</span>

        <TinySelect
          icon={<MapPin className="h-3 w-3" />}
          value={stored.location}
          onChange={(v) => setLocation(v as Location)}
          options={LOCATIONS.map((v) => ({ value: v, label: LOCATION_LABEL[v] }))}
        />

        <TinySelect
          icon={<Zap className="h-3 w-3" />}
          value={stored.autoEnergy ? "auto" : stored.energy}
          onChange={(v) => {
            if (v === "auto") setAutoEnergy(true);
            else setEnergy(v as Energy);
          }}
          options={[
            { value: "auto", label: `Auto (${ENERGY_LABEL[autoEnergy]})` },
            ...ENERGIES.map((v) => ({ value: v, label: ENERGY_LABEL[v] })),
          ]}
        />

        <TinySelect
          icon={<Timer className="h-3 w-3" />}
          value={stored.duration}
          onChange={(v) => setDuration(v as Duration)}
          options={DURATIONS.map((v) => ({ value: v, label: DURATION_LABEL[v] }))}
        />

        <span
          className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-muted-foreground"
          title="Detected from the clock and your work schedule"
        >
          {currentState.workWindow === "work" ? (
            <Briefcase className="h-3 w-3" />
          ) : (
            <Coffee className="h-3 w-3" />
          )}
          {WORK_WINDOW_LABEL[currentState.workWindow]}
        </span>

        <label className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Switch
            checked={stored.hideMismatches}
            onCheckedChange={setHideMismatches}
            aria-label="Only show tasks that fit"
          />
          <span className="hidden sm:inline">Only fitting</span>
        </label>
      </div>
    </div>
  );
}

function TinySelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 gap-1 border bg-background px-2 py-0 text-xs [&_svg]:h-3 [&_svg]:w-3">
        <span className="text-muted-foreground">{icon}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
