import { useCallback, useEffect, useRef, useState } from "react";

import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";

const HOLD_TO_END_MS = 1200;

type WakeLockLike = { release: () => Promise<void> };

/** Spoken fallback for moments the coach itself can't talk (errors, mic access). */
function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(text));
  } catch {
    // Speech synthesis unavailable: nothing else to do without a screen.
  }
}

/** Short audio confirmation so the user knows a tap registered. */
function chime(kind: "start" | "end") {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = kind === "start" ? [523.25, 783.99] : [783.99, 392];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + index * 0.14;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.24);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    // Audio confirmation is optional.
  }
}

function spokenError(message: string) {
  if (/permission|notallowed|denied|microphone/i.test(message)) {
    return "I need your microphone to coach you. Allow microphone access, then tap anywhere to start.";
  }
  return "Sorry, I lost the connection to your coach. Tap anywhere to start again.";
}

export function VoiceCoach() {
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdFired = useRef(false);
  const wakeLock = useRef<WakeLockLike | null>(null);

  const onEvent = useCallback((event: LiveEvent) => {
    if (event.type === "app.coach.paused") setPaused(true);
    if (event.type === "app.coach.resumed") setPaused(false);
    if (event.type === "app.connected") setPaused(false);
  }, []);

  const voice = useLiveVoice({ onEvent });
  const canStart = voice.status === "idle" || voice.status === "closed";
  const inCall = voice.status === "connecting" || voice.status === "connected";

  // Speak errors aloud — the user isn't looking at the screen.
  useEffect(() => {
    if (voice.error) speak(spokenError(voice.error));
  }, [voice.error]);

  // Keep the phone awake during a workout so the call isn't suspended.
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
    };
    async function acquire() {
      if (!nav.wakeLock || wakeLock.current || document.visibilityState !== "visible") return;
      try {
        wakeLock.current = await nav.wakeLock.request("screen");
      } catch {
        wakeLock.current = null;
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        wakeLock.current = null;
        void acquire();
      }
    }
    if (voice.status === "connected") {
      void acquire();
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
    const lock = wakeLock.current;
    wakeLock.current = null;
    void lock?.release().catch(() => {});
    return undefined;
  }, [voice.status]);

  const cancelHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    setHolding(false);
  }, []);

  const endCall = useCallback(() => {
    chime("end");
    voice.stop();
  }, [voice]);

  function handlePointerDown() {
    if (!inCall) return;
    holdFired.current = false;
    setHolding(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      setHolding(false);
      endCall();
    }, HOLD_TO_END_MS);
  }

  function handleClick() {
    if (holdFired.current) {
      holdFired.current = false;
      return;
    }
    if (canStart) {
      chime("start");
      setPaused(false);
      voice.start();
    } else if (voice.playbackBlocked) {
      voice.resumePlayback();
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && inCall) endCall();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inCall, endCall]);

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  let orbState = "idle";
  let headline = "Tap to train";
  let subline = "Tap anywhere, then just talk. Tell Coach what you're working on.";
  let label = "Start your voice workout";

  if (voice.error && canStart) {
    orbState = "error";
    headline = "Tap to retry";
    subline = spokenError(voice.error);
    label = "Start your voice workout again";
  } else if (holding) {
    orbState = "holding";
    headline = "Keep holding";
    subline = "Release to keep training.";
    label = "Hold to end workout";
  } else if (voice.playbackBlocked) {
    orbState = "connecting";
    headline = "Tap to hear Coach";
    subline = "Your browser paused the sound.";
    label = "Turn on coach audio";
  } else if (voice.status === "connecting") {
    orbState = "connecting";
    headline = "Warming up";
    subline = "Connecting to your coach…";
    label = "Connecting. Hold to cancel";
  } else if (voice.status === "connected") {
    orbState = "live";
    headline = paused ? "Paused" : "Coach is listening";
    subline = paused
      ? "Say “next set” or “I'm ready” when you want to go."
      : "Say “pause”, “next set” or “end workout”. Hold the screen to end.";
    label = "Workout in progress. Hold to end";
  } else if (voice.status === "stopping") {
    orbState = "connecting";
    headline = "Cooling down";
    subline = "Wrapping up your session…";
    label = "Ending workout";
  } else if (voice.status === "closed" && voice.hasConnected) {
    headline = "Great work";
    subline = "Tap anywhere to train again.";
    label = "Start another voice workout";
  }

  return (
    <main className="coach-court relative flex min-h-[100dvh] w-full flex-col">
      {/* The coach's voice plays here; kept mounted for the whole call. */}
      <audio ref={voice.audioRef} controls className="sr-only" />

      <button
        type="button"
        aria-label={label}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(event) => event.preventDefault()}
        className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-16 outline-none focus-visible:ring-4 focus-visible:ring-ring"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.4em] text-muted-foreground">
          Coach
        </span>

        <span className="relative flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72">
          {orbState === "live" && (
            <>
              <span className="coach-ring absolute inset-0" aria-hidden />
              <span className="coach-ring coach-ring-delay absolute inset-0" aria-hidden />
            </>
          )}
          <span className="coach-orb absolute inset-0" data-state={orbState} aria-hidden />
        </span>

        <span className="flex max-w-md flex-col items-center gap-4 text-center" role="status" aria-live="polite">
          <span className="coach-headline text-6xl uppercase text-foreground sm:text-7xl">{headline}</span>
          <span className="text-lg text-muted-foreground">{subline}</span>
        </span>
      </button>

      <p className="pb-8 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Best with headphones
      </p>
    </main>
  );
}
