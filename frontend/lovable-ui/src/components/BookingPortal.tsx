import { useState } from "react";
import {
  Search,
  ShieldCheck,
  Star,
  Sparkles,
  PartyPopper,
  SlidersHorizontal,
  Loader2,
  CheckCircle2,
  BadgeIndianRupee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MapPanel } from "@/components/MapPanel";
import {
  CATEGORIES,
  inr,
  matchAndPrice,
  verifyAndSettle,
  type MatchResult,
  type SettlementResult,
  type Worker,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function BookingPortal() {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [selected, setSelected] = useState<Worker | null>(null);
  const [booked, setBooked] = useState(false);
  const [otp, setOtp] = useState("");
  const [settling, setSettling] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);

  const search = async () => {
    setLoading(true);
    setBooked(false);
    setOtp("");
    setSettlement(null);
    const res = await matchAndPrice(category);
    setResult(res);
    setSelected(res.worker);
    setLoading(false);
  };

  const settle = async () => {
    if (!selected || otp.length !== 4) return;
    setSettling(true);
    const res = await verifyAndSettle(otp, selected.coopPrice, selected.id);
    setSettlement(res);
    setSettling(false);
  };

  const savings = selected ? selected.aggregatorPrice - selected.coopPrice : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* LEFT: booking panel */}
      <div className="space-y-5">
        <section className="surface-card p-5">
          <h2 className="text-base font-bold text-navy">Select Service Category</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Registered cooperative trades under the Ministry of Cooperation
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-navy-soft hover:bg-secondary",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <Button
            onClick={search}
            disabled={loading}
            size="lg"
            className="mt-5 w-full text-base font-bold shadow-[var(--shadow-panel)]"
          >
            {loading ? (
              <Loader2 className="mr-1 h-5 w-5 animate-spin" />
            ) : (
              <Search className="mr-1 h-5 w-5" />
            )}
            Search Nearby Cooperative Workers
          </Button>
        </section>

        {selected && (
          <section className="surface-card overflow-hidden">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border p-5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-navy text-lg font-bold text-primary-foreground">
                {selected.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-navy">{selected.name}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold text-navy-soft">
                    <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                    {selected.rating.toFixed(1)} ★
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
                    <Sparkles className="h-3 w-3" /> {selected.matchLabel}
                  </span>
                </p>
              </div>
            </div>

            <div className="px-5 pt-4">
              <div className="flex items-center gap-2 rounded-xl border border-trust/30 bg-trust-soft px-3 py-2.5">
                <ShieldCheck className="h-5 w-5 shrink-0 text-trust" />
                <span className="text-sm font-bold text-trust">
                  PACS &amp; SHG Verified Worker
                </span>
              </div>
            </div>

            {/* Invoice-style price comparison */}
            <div className="p-5">
              <div className="rounded-xl border border-border bg-secondary/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cooperative Fair Price
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-3">
                  <span className="tabular text-3xl font-extrabold text-trust">
                    {inr(selected.coopPrice)}
                  </span>
                  <span className="tabular pb-1 text-sm text-muted-foreground line-through">
                    Aggregator: {inr(selected.aggregatorPrice)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-trust px-3 py-2">
                  <PartyPopper className="h-4 w-4 shrink-0 text-trust-foreground" />
                  <span className="text-xs font-bold text-trust-foreground">
                    Zero Middleman Commission — You save {inr(savings)}
                  </span>
                </div>
              </div>

              <Button
                onClick={() => setBooked(true)}
                size="lg"
                className="mt-4 w-full text-base font-bold"
              >
                Book Service Now
              </Button>

              <Accordion type="single" collapsible className="mt-3">
                <AccordionItem value="jury" className="border-b-0">
                  <AccordionTrigger className="rounded-lg border border-border bg-card px-3 text-sm font-semibold text-navy hover:no-underline">
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      Inspect Fair-Pool Algorithm (Jury Mode)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3">
                    <div className="space-y-3 rounded-lg border border-border bg-secondary/60 p-4">
                      {[
                        { label: "Proximity weight", value: result?.breakdown.proximity ?? 40 },
                        { label: "Trust rating weight", value: result?.breakdown.trust ?? 30 },
                        { label: "Idle-days equalizer", value: result?.breakdown.idle ?? 30 },
                      ].map((r) => (
                        <div key={r.label}>
                          <div className="flex items-center justify-between text-xs font-semibold text-navy-soft">
                            <span>{r.label}</span>
                            <span className="tabular">{r.value}%</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${r.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Idle-days equalizer rotates work to members with the longest gap since
                        their last paid job ({selected.idleDays} idle days for {selected.name}),
                        preventing rating monopolies inside the cooperative pool.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>
        )}

        {booked && selected && (
          <section className="surface-card p-5">
            <h3 className="text-base font-bold text-navy">Work Completion OTP</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask {selected.name} for the 4-digit code shown in their worker app.
            </p>
            <div className="mt-4 flex justify-center">
              <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="tabular h-14 w-14 rounded-xl border border-border bg-card text-2xl font-bold text-navy shadow-[var(--shadow-panel)]"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              onClick={settle}
              disabled={otp.length !== 4 || settling}
              size="lg"
              className="mt-4 w-full text-base font-bold"
            >
              {settling ? (
                <Loader2 className="mr-1 h-5 w-5 animate-spin" />
              ) : (
                <BadgeIndianRupee className="mr-1 h-5 w-5" />
              )}
              Verify &amp; Release 98% Worker Payout
            </Button>
          </section>
        )}
      </div>

      {/* RIGHT: map canvas */}
      <MapPanel
        workers={result?.nearby ?? []}
        selectedId={selected?.id}
        onSelect={(w) => {
          setSelected(w);
          setBooked(false);
          setOtp("");
          setSettlement(null);
        }}
      />

      <Dialog open={!!settlement} onOpenChange={(o) => !o && setSettlement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy">
              <CheckCircle2 className="h-5 w-5 text-trust" /> Settlement Released
            </DialogTitle>
          </DialogHeader>
          {settlement && (
            <div className="space-y-3">
              <div className="rounded-xl border border-trust/30 bg-trust-soft p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-trust">
                  Total collected
                </p>
                <p className="tabular text-3xl font-extrabold text-trust">
                  {inr(settlement.total)}
                </p>
              </div>
              {[
                { label: "Worker UPI payout", pct: "98%", value: settlement.workerPayout },
                {
                  label: "PACS server maintenance",
                  pct: "1.5%",
                  value: settlement.pacsMaintenance,
                },
                {
                  label: "Emergency Mutual Aid Fund",
                  pct: "0.5%",
                  value: settlement.mutualAidFund,
                },
              ].map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.pct} of invoice</p>
                  </div>
                  <span className="tabular shrink-0 text-base font-bold text-navy">
                    {inr(r.value)}
                  </span>
                </div>
              ))}
              <p className="text-center text-xs text-muted-foreground">
                UPI reference {settlement.reference}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
