import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap, Landmark } from "lucide-react";
import { BookingPortal } from "@/components/BookingPortal";
import { VoiceOnboarding } from "@/components/VoiceOnboarding";
import { checkBackend } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UBIQUITY — Cooperative Gig Services Network" },
      {
        name: "description",
        content:
          "Cooperative gig services network for India: fair-pool worker matching, zero middleman commission pricing, 98% worker payouts and voice-first onboarding.",
      },
      { property: "og:title", content: "UBIQUITY — Cooperative Gig Services Network" },
      {
        property: "og:description",
        content:
          "Fair-pool matching, transparent cooperative pricing and voice-first worker onboarding for India's gig economy.",
      },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "customer", label: "Customer Booking Portal" },
  { id: "worker", label: "Worker Voice Onboarding" },
] as const;

function Index() {
  const [tab, setTab] = useState<"customer" | "worker">("customer");
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const ping = async () => {
      const ok = await checkBackend();
      if (active) setOnline(ok);
    };
    ping();
    const id = setInterval(ping, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-primary-foreground">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-navy">UBIQUITY</h1>
                  <span className="rounded-full border border-trust/30 bg-trust-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-trust">
                    Co-op / Govt Affiliated
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Cooperative Gig Services Network (SIH26089 — Ministry of Cooperation)
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-navy-soft">
                Backend Engine: {online === false ? "Demo Mode" : "Connected"}
              </span>
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75",
                    online === false ? "bg-primary" : "animate-ping bg-trust",
                  )}
                />
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    online === false ? "bg-primary" : "bg-trust",
                  )}
                />
              </span>
            </div>
          </div>

          <nav className="mt-3 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t.id
                    ? "border-navy bg-navy text-primary-foreground"
                    : "border-border bg-card text-navy-soft hover:bg-secondary",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {tab === "customer" ? <BookingPortal /> : <VoiceOnboarding />}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Powered by PACS &amp; SHG cooperatives · 98% of every rupee reaches the worker
      </footer>
    </div>
  );
}
