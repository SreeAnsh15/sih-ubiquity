import { useState } from "react";
import { Mic, Volume2, Loader2, Quote, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANGUAGES, inr, voiceOnboard, type VoiceProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

export function VoiceOnboarding() {
  const [lang, setLang] = useState<string>("ta");
  const [state, setState] = useState<"idle" | "listening" | "processing">("idle");
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [registered, setRegistered] = useState(false);

  const record = async () => {
    if (state !== "idle") return;
    setProfile(null);
    setRegistered(false);
    setState("listening");
    await new Promise((r) => setTimeout(r, 2200));
    setState("processing");
    const res = await voiceOnboard(lang);
    setProfile(res);
    setState("idle");
  };

  const readBack = (p: VoiceProfile) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(
      `${p.fullName}, ${p.skill}, ${p.experience} experience, base rate ${p.baseRate} rupees, service zone ${p.zone}.`,
    );
    window.speechSynthesis.speak(u);
  };

  const statusText =
    state === "listening"
      ? "Listening… speak naturally"
      : state === "processing"
        ? "Understanding your voice…"
        : "Tap to Speak your experience, work area, and baseline rate in your native language";

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      <section className="surface-card p-6">
        <h2 className="text-base font-bold text-navy">Choose Your Language</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          No typing, no reading required. Voice-first onboarding for daily-wage members.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                lang === l.code
                  ? "border-trust bg-trust text-trust-foreground"
                  : "border-border bg-card text-navy-soft hover:bg-secondary",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center">
          <button
            onClick={record}
            aria-label="Tap to speak"
            className={cn(
              "relative grid h-36 w-36 place-items-center rounded-full bg-trust text-trust-foreground shadow-[var(--shadow-lift)] transition-transform active:scale-95",
              state === "listening" && "ripple-ring",
            )}
          >
            {state === "processing" ? (
              <Loader2 className="h-14 w-14 animate-spin" />
            ) : (
              <Mic className="h-14 w-14" />
            )}
          </button>
          <p className="mt-5 max-w-sm text-center text-sm font-medium text-navy-soft">
            {statusText}
          </p>
        </div>
      </section>

      <section className="surface-card flex flex-col p-6">
        <h2 className="text-base font-bold text-navy">Extracted Worker Profile</h2>
        {!profile ? (
          <div className="flex flex-1 items-center justify-center py-14 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Your details will appear here automatically after you speak.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border bg-secondary/60 p-4">
              <Quote className="h-4 w-4 text-primary" />
              <p className="mt-2 text-sm leading-relaxed text-navy-soft">
                “{profile.transcript}”
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detected language · {profile.language}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              {[
                { k: "Full Name", v: profile.fullName },
                { k: "Primary Skill", v: profile.skill },
                { k: "Experience", v: profile.experience },
                { k: "Base Rate", v: `${inr(profile.baseRate)} / day` },
                { k: "Service Zone", v: profile.zone, wide: true },
              ].map((f) => (
                <div
                  key={f.k}
                  className={cn(
                    "min-w-0 rounded-xl border border-border bg-card px-4 py-3",
                    f.wide && "col-span-2",
                  )}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.k}
                  </dt>
                  <dd className="truncate text-sm font-bold text-navy">{f.v}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setRegistered(true)}
                size="lg"
                className="flex-1 text-base font-bold"
              >
                Confirm &amp; Register with Local PACS
              </Button>
              <Button
                onClick={() => readBack(profile)}
                variant="outline"
                size="lg"
                aria-label="Read profile aloud"
                className="border-trust text-trust"
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            </div>

            {registered && (
              <div className="flex items-center gap-2 rounded-xl border border-trust/30 bg-trust-soft px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-trust" />
                <p className="text-sm font-bold text-trust">
                  Registered with local PACS. Member ID issued and read aloud.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
