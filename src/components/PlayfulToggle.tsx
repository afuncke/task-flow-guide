import { PartyPopper, Sparkles } from "lucide-react";
import { playfulStore, usePlayful } from "@/lib/playful/store";
import { celebrate, toast } from "@/lib/playful/celebrate";
import { soundSparkle } from "@/lib/playful/sound";
import { COPY } from "@/lib/playful/copy";

export function PlayfulToggle() {
  const playful = usePlayful();

  const flip = () => {
    const next = !playful;
    playfulStore.set(next);
    if (next) {
      soundSparkle();
      celebrate({ x: window.innerWidth - 60, y: 60 }, { praise: false });
      toast(COPY.playfulOn[1]);
    } else {
      toast(COPY.playfulOff[0]);
    }
  };

  return (
    <button
      onClick={flip}
      className={`rounded-md p-1.5 transition-colors ${
        playful ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
      aria-pressed={playful}
      aria-label={playful ? "Turn off playful mode" : "Turn on playful mode"}
      title={playful ? "Playful mode on (p)" : "Playful mode off (p)"}
    >
      {playful ? (
        <PartyPopper className="h-4 w-4" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
    </button>
  );
}
