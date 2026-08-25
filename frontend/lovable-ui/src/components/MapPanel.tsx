import { Suspense, lazy, useEffect, useState } from "react";
import { Signal, MapPin, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { inr, type Worker } from "@/lib/api";
import { cn } from "@/lib/utils";

const WorkerMapCanvas = lazy(() => import("./WorkerMapCanvas"));

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-secondary">
      <p className="text-sm text-muted-foreground">Loading road map tiles…</p>
    </div>
  );
}

export function MapPanel({
  workers,
  selectedId,
  onSelect,
}: {
  workers: Worker[];
  selectedId?: string | undefined;
  onSelect: (w: Worker) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);

  useEffect(() => setMounted(true), []);

  const sorted = [...workers].sort((a, b) => a.distanceKm - b.distanceKm);

  return (
    <section className="surface-card flex min-h-[560px] flex-col overflow-hidden lg:min-h-[720px]">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-navy">
            Live Cooperative Worker Map
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            OpenStreetMap · Coimbatore cluster · {workers.length} PACS members online
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
          <Signal className="h-3.5 w-3.5 text-navy-soft" />
          <span className="text-[11px] font-semibold text-navy-soft">2G Low-Bandwidth</span>
          <Switch checked={lowBandwidth} onCheckedChange={setLowBandwidth} />
        </label>
      </header>

      <div className="relative flex-1">
        {lowBandwidth ? (
          <div className="h-full space-y-2 overflow-y-auto p-4">
            <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Text-only mode · sorted by distance
            </p>
            {sorted.map((w) => (
              <button
                key={w.id}
                onClick={() => onSelect(w)}
                className={cn(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  w.id === selectedId
                    ? "border-primary bg-accent"
                    : "border-border bg-card hover:bg-secondary",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{w.name}</p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {w.distanceKm.toFixed(1)} km
                    <Star className="h-3 w-3 fill-gold text-gold" /> {w.rating.toFixed(1)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm font-bold text-trust">
                  {inr(w.coopPrice)}
                </span>
              </button>
            ))}
          </div>
        ) : mounted ? (
          <Suspense fallback={<MapSkeleton />}>
            <WorkerMapCanvas workers={workers} selectedId={selectedId} onSelect={onSelect} />
          </Suspense>
        ) : (
          <MapSkeleton />
        )}
      </div>
    </section>
  );
}
