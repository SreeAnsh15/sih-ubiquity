import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, Loader2, Quote, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LANGUAGES, inr, registerWorker, voiceOnboard, type VoiceProfile } from "@/lib/api";
import { cn } from "@/lib/utils";

type RecordingState = "idle" | "listening" | "processing";

export function VoiceOnboarding() {
  const [lang, setLang] = useState<string>("ta");
  const [state, setState] = useState<RecordingState>("idle");
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  const startRecording = async () => {
    setError(null);
    setProfile(null);
    setMemberId(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(
        "This browser does not support microphone recording. Please use a recent Chrome, Edge, or Firefox browser.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The microphone recording failed. Please try again.");
        setState("idle");
        stopStream();
      };
      recorder.onstop = async () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stopStream();
        if (!audio.size) {
          setState("idle");
          setError("No audio was captured. Please hold the button while speaking.");
          return;
        }
        setState("processing");
        try {
          const extracted = await voiceOnboard(lang, audio);
          setProfile(extracted);
          toast.success("Voice profile extracted. Review it before registering.");
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : "Voice processing failed. Please try again.";
          setError(message);
          toast.error(message);
        } finally {
          setState("idle");
        }
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setState("listening");
    } catch (cause) {
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access and try again."
          : "Unable to start the microphone. Please check your device and try again.";
      setError(message);
      toast.error(message);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const toggleRecording = () => {
    if (state === "listening") stopRecording();
    else if (state === "idle") void startRecording();
  };

  const confirmRegistration = async () => {
    if (!profile) return;
    setRegistering(true);
    setError(null);
    try {
      const result = await registerWorker(profile);
      setMemberId(result.memberId);
      toast.success("PACS registration saved.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Registration failed. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setRegistering(false);
    }
  };

  const readBack = (current: VoiceProfile) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Text-to-speech is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${current.fullName}, ${current.skill}, ${current.experience} experience, base rate ${current.baseRate} rupees, service zone ${current.zone}.`,
    );
    window.speechSynthesis.speak(utterance);
  };

  const statusText =
    state === "listening"
      ? "Recording… tap again when you finish speaking"
      : state === "processing"
        ? "Uploading and understanding your voice…"
        : "Tap to record your experience, work area, and baseline rate in your native language";

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
      <section className="surface-card p-6">
        <h2 className="text-base font-bold text-navy">Choose Your Language</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Microphone audio is uploaded for transcription and profile extraction. Review the result
          before registration.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              disabled={state !== "idle"}
              onClick={() => setLang(language.code)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                lang === language.code
                  ? "border-trust bg-trust text-trust-foreground"
                  : "border-border bg-card text-navy-soft hover:bg-secondary",
              )}
            >
              {language.label}
            </button>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center">
          <button
            onClick={toggleRecording}
            disabled={state === "processing"}
            aria-label={state === "listening" ? "Stop recording" : "Start recording"}
            className={cn(
              "relative grid h-36 w-36 place-items-center rounded-full bg-trust text-trust-foreground shadow-[var(--shadow-lift)] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70",
              state === "listening" && "ripple-ring",
            )}
          >
            {state === "processing" ? (
              <Loader2 className="h-14 w-14 animate-spin" />
            ) : state === "listening" ? (
              <Square className="h-12 w-12 fill-current" />
            ) : (
              <Mic className="h-14 w-14" />
            )}
          </button>
          <p className="mt-5 max-w-sm text-center text-sm font-medium text-navy-soft">
            {statusText}
          </p>
          {state === "listening" && (
            <p className="mt-2 text-xs font-semibold text-trust">
              Keep the browser tab open while recording.
            </p>
          )}
        </div>
        {error && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      <section className="surface-card flex flex-col p-6">
        <h2 className="text-base font-bold text-navy">Extracted Worker Profile</h2>
        {!profile ? (
          <div className="flex flex-1 items-center justify-center py-14 text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              Your details will appear here after a real microphone recording is uploaded.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border bg-secondary/60 p-4">
              <Quote className="h-4 w-4 text-primary" />
              <p className="mt-2 text-sm leading-relaxed text-navy-soft">“{profile.transcript}”</p>
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
              ].map((field) => (
                <div
                  key={field.k}
                  className={cn(
                    "min-w-0 rounded-xl border border-border bg-card px-4 py-3",
                    field.wide && "col-span-2",
                  )}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {field.k}
                  </dt>
                  <dd className="truncate text-sm font-bold text-navy">{field.v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={confirmRegistration}
                disabled={registering || !!memberId}
                size="lg"
                className="flex-1 text-base font-bold"
              >
                {registering && <Loader2 className="mr-1 h-5 w-5 animate-spin" />}
                {memberId ? "PACS Registration Saved" : "Confirm & Register with Local PACS"}
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
            {memberId && (
              <div className="flex items-start gap-2 rounded-xl border border-trust/30 bg-trust-soft px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-trust" />
                <p className="text-sm font-bold text-trust">
                  Registered with local PACS. Member ID: {memberId}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
