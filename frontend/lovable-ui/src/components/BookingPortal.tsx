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
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
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
  createBooking,
  cancelBooking,
  inr,
  matchAndPrice,
  verifyAndSettle,
  type BookingConfirmation,
  type MatchResult,
  type SettlementResult,
  type Worker,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export function BookingPortal() {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [selected, setSelected] = useState<Worker | null>(null);
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [otp, setOtp] = useState("");
  const [settling, setSettling] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const discardActiveBooking = async () => {
    if (!booking) return;
    try {
      await cancelBooking(booking.bookingId);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not cancel the active booking.";
      setError(message);
      toast.error(message);
      throw cause;
    }
  };

  const search = async () => {
    setLoading(true);
    setError(null);
    if (booking) {
      try {
        await discardActiveBooking();
      } catch {
        setLoading(false);
        return;
      }
    }
    setBooking(null);
    setOtp("");
    setSettlement(null);
    try {
      const res = await matchAndPrice(category);
      setResult(res);
      setSelected(res.worker);
      if (!res.worker) setError("No verified cooperative worker is available within 5 km.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load nearby workers.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const book = async () => {
    if (!selected) return;
    setBookingLoading(true);
    setError(null);
    try {
      const created = await createBooking(category, selected);
      setBooking(created);
      setOtp("");
      toast.success("Booking confirmed and saved.");
      if (created.developmentOtp) {
        toast.info(`Demo completion OTP: ${created.developmentOtp}`, { duration: 10000 });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not create the booking.";
      setError(message);
      toast.error(message);
    } finally {
      setBookingLoading(false);
    }
  };

  const settle = async () => {
    if (!selected || !booking || otp.length !== 4) return;
    setSettling(true);
    setError(null);
    try {
      const res = await verifyAndSettle(
        otp,
        booking.bookingId,
        booking.grossAmount,
        selected.id,
        result?.clusterId ?? "coimbatore-gandhipuram",
      );
      setSettlement(res);
      toast.success("Settlement recorded in the cooperative ledger.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not verify the completion OTP.";
      setError(message);
      toast.error(message);
    } finally {
      setSettling(false);
    }
  };

  const savings = selected ? selected.aggregatorPrice - selected.coopPrice : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-5">
        <section className="surface-card p-5">
          <h2 className="text-base font-bold text-navy">Select Service Category</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Verified cooperative trades in the Coimbatore–Gandhipuram operating cluster.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((service) => (
              <button
                key={service}
                onClick={() => {
                  void discardActiveBooking().then(() => {
                    setCategory(service);
                    setResult(null);
                    setSelected(null);
                    setBooking(null);
                    setSettlement(null);
                    setError(null);
                  });
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                  category === service
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-navy-soft hover:bg-secondary",
                )}
              >
                {service}
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
          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {selected && result && (
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
                    {selected.rating.toFixed(2)} trust score
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
                <span className="text-sm font-bold text-trust">PACS &amp; SHG Verified Worker</span>
              </div>
            </div>

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
                    Zero middleman commission — you save {inr(savings)}
                  </span>
                </div>
              </div>

              <Button
                onClick={book}
                disabled={bookingLoading || !!booking}
                size="lg"
                className="mt-4 w-full text-base font-bold"
              >
                {bookingLoading && <Loader2 className="mr-1 h-5 w-5 animate-spin" />}
                {booking ? "Booking Confirmed" : "Confirm Booking"}
              </Button>

              <Accordion type="single" collapsible className="mt-3">
                <AccordionItem value="jury" className="border-b-0">
                  <AccordionTrigger className="rounded-lg border border-border bg-card px-3 text-sm font-semibold text-navy hover:no-underline">
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      Inspect fair-pool algorithm
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3">
                    <div className="space-y-3 rounded-lg border border-border bg-secondary/60 p-4">
                      {[
                        { label: "Proximity weight", value: result.breakdown.proximity },
                        { label: "Trust rating weight", value: result.breakdown.trust },
                        { label: "Idle-days equalizer", value: result.breakdown.idle },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-xs font-semibold text-navy-soft">
                            <span>{item.label}</span>
                            <span className="tabular">{item.value}%</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${item.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        The score combines distance, verified trust, and time since the worker’s
                        last paid job. Ties are resolved deterministically by distance and worker
                        ID.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>
        )}

        {booking && selected && (
          <section className="surface-card p-5">
            <h3 className="text-base font-bold text-navy">Work Completion OTP</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask {selected.name} for the 4-digit code in their worker app. This booking expires at{" "}
              {new Date(booking.otpExpiresAt).toLocaleTimeString()}.
            </p>
            {booking.developmentOtp && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Development mode only: the worker OTP is {booking.developmentOtp}. Never expose OTPs
                this way in production.
              </p>
            )}
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
              Verify OTP &amp; Record Settlement
            </Button>
          </section>
        )}
      </div>

      <MapPanel
        workers={result?.nearby ?? []}
        selectedId={selected?.id}
        onSelect={(worker) => {
          void discardActiveBooking().then(() => {
            setSelected(worker);
            setBooking(null);
            setOtp("");
            setSettlement(null);
            setError(null);
          });
        }}
      />

      <Dialog open={!!settlement} onOpenChange={(open) => !open && setSettlement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy">
              <CheckCircle2 className="h-5 w-5 text-trust" /> Settlement Ledger Recorded
            </DialogTitle>
          </DialogHeader>
          {settlement && (
            <div className="space-y-3">
              <div className="rounded-xl border border-trust/30 bg-trust-soft p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-trust">
                  Total recorded
                </p>
                <p className="tabular text-3xl font-extrabold text-trust">
                  {inr(settlement.total)}
                </p>
              </div>
              {[
                { label: "Worker ledger allocation", pct: "98%", value: settlement.workerPayout },
                {
                  label: "PACS cooperative maintenance",
                  pct: "1.5%",
                  value: settlement.pacsMaintenance,
                },
                {
                  label: "Emergency mutual aid fund",
                  pct: "0.5%",
                  value: settlement.mutualAidFund,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.pct} of invoice</p>
                  </div>
                  <span className="tabular shrink-0 text-base font-bold text-navy">
                    {inr(item.value)}
                  </span>
                </div>
              ))}
              <p className="text-center text-xs text-muted-foreground">
                Ledger reference {settlement.reference}. A production UPI transfer gateway must be
                connected before funds move.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
