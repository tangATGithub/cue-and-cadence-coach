import { createOpenAI } from "@ai-sdk/openai";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import process from "node:process";
import { z } from "zod";

import { CUE_IDLE_SECONDS, detectCoachCommand } from "./coach-commands";
import { EXERCISES, findExercise } from "./exercise-cues";
import { COACH_VOICES, detectVoiceChoice, isWorkoutCompletion, type CoachVoice } from "./workout-journal";
import { deviceHash, readWorkouts, saveWorkout } from "./workout-journal.server";

export type LiveConfig = {
  baseURL: string;
  key: string;
  liveModel: string;
  backendModel: string;
  openingInstructions?: string;
};

// Fill from co-loaded knowledge: the gateway URL, the Live model and the resolved chat model.
const liveSettings = {
  baseURL: "https://ai.gateway.lovable.dev",
  liveModel: "openai/gpt-live-1",
  backendModel: "openai/gpt-6-astra",
};

const openingInstructions =
  "Start now in English. Greet the user briefly as their hands-free trainer. Say they can request a male or female coach for their next workout, and that saying end workout saves their session. Ask what they are training today, then listen.";

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };
export type LiveConnector = (url: string, headers: Record<string, string>, signal: AbortSignal) => Promise<LiveSocket>;

type WorkerSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerSocket; 1: WorkerSocket } };
type Transcript = {
  role: "user" | "assistant";
  text: string;
  start_ms: number;
  end_ms: number;
  listeningSound: boolean;
};
type ProviderEvent = {
  type: string;
  client_event_id?: string;
  error?: { client_event_id?: string; message?: string };
  session?: { id: string };
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  offset_ms?: number;
  delegation?: { id: string; target: string };
};

export function getLiveConfig(): LiveConfig {
  const config: LiveConfig = {
    ...liveSettings,
    openingInstructions,
    key: process.env["LOVABLE_API_KEY"] ?? "",
  };
  if ([config.baseURL, config.key, config.liveModel, config.backendModel].some((value) => !value)) {
    throw new Error("Missing Live relay configuration");
  }
  return config;
}

function gatewayAPIBase(baseURL: string) {
  return `${baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;
}

async function gatewayRejection(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";
  return new Error(message || `Voice gateway rejected the connection (${response.status})`);
}

export function validateLiveUpgrade(request: Request, options: { allowMissingOrigin?: boolean } = {}): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}

export function handleLiveRequest(request: Request): Response {
  const waitUntil = (request as Request & Partial<LiveExecutionContext>).waitUntil;
  if (!waitUntil) return new Response("Live runtime unavailable", { status: 503 });
  const config = getLiveConfig();
  const rejected = validateLiveUpgrade(request);
  if (rejected) return rejected;
  const pair = new WebSocketPair();
  pair[1].accept();
  bindLiveConnection(workerSocket(pair[1]), config, { waitUntil }, async (url, headers, signal) => {
    const response = await fetch(url, { headers: { ...headers, Upgrade: "websocket" }, signal });
    const socket = (response as Response & { webSocket?: WorkerSocket | null }).webSocket;
    if (!socket) throw await gatewayRejection(response);
    socket.accept();
    return workerSocket(socket);
  });
  const response: ResponseInit & { webSocket: WebSocket } = { status: 101, webSocket: pair[0] };
  return new Response(null, response);
}

const conversationInstructions = `You are Coach, an energetic, warm personal trainer who works entirely by voice.
The user cannot see or touch a screen while training. Never refer to anything visual, a screen, or buttons.
Speak English in short, punchy sentences, like a trainer standing next to them. One idea at a time.
When the user tells you their workout or focus, confirm it in a few words and start coaching right away:
cue the breathing rhythm (when to breathe in and out), where they should feel the work or burn,
core bracing, posture and alignment, and the details people forget. Count reps or seconds when useful.
Rotate cues so you are not repetitive. Answer their questions briefly, then get back to coaching.
When they rest, give a recovery breathing cue and ask when they're ready for the next set.
Safety: if they mention sharp pain, joint pain, dizziness, chest pain, or trouble breathing, tell them to stop and rest,
and suggest seeing a professional if it continues. Never diagnose.
If they say pause or ask you to be quiet, acknowledge in three words or fewer and stay quiet until they talk again.
If they say end the workout, give one short encouraging goodbye.
The app saves the workout on explicit completion or end, and reports whether the save succeeded. Never claim a save before the app confirms it.
The coach voice is fixed for this call. A request for a male or female coach sets the next workout's voice; do not claim to change it mid-call.
Users can ask to hear their workout history. The app supplies verified saved sessions; never invent workout history, reps, weights, or sets.
Backchannel policy: Use occasional short encouragement like "good", "nice", "keep it up" without taking over.
Interruption policy: Stop talking immediately and listen when the user speaks.
Delegation policy:
Backend tools: A coaching library with precise breathing, muscle, core, posture, and common-mistake cues per exercise, plus careful reasoning for form questions and building a workout.
Delegate to the backend when: The user asks a detailed technique or form question, asks what muscles an exercise works,
asks for modifications for an injury or limitation, or asks you to build a workout routine.
Do not delegate to the backend when: Greeting, giving routine in-set cues, counting, encouraging, confirming the workout,
or repeating a still-current answer. Wait for the backend result before presenting its answer.`;

const exerciseCuesInput = z
  .object({
    exercise: z.string().min(1).max(80),
  })
  .strict();

function isListeningSound(text: string) {
  const normalized = text.toLowerCase().replace(/[\s\p{Pd}]/gu, "");
  return /^(?:m+hm+|uhhuh)[.,!]*$/.test(normalized);
}

async function answerQuestion(
  messages: ModelMessage[],
  config: LiveConfig,
  correlation: { runID: string; sessionID: string | undefined; delegationID: string },
  signal: AbortSignal,
  consumeInput: () => void,
) {
  signal.throwIfAborted();
  const provider = createOpenAI({
    baseURL: gatewayAPIBase(config.baseURL),
    apiKey: config.key,
    headers: {
      "Lovable-API-Key": config.key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
  let responseCursor = 0;
  consumeInput();
  const result = streamText({
    model: provider.responses(config.backendModel),
    abortSignal: signal,
    maxRetries: 0,
    stopWhen: stepCountIs(50),
    includeRawChunks: true,
    prepareStep() {
      consumeInput();
      return { messages: [...messages] };
    },
    onStepFinish(step) {
      messages.push(...step.response.messages.slice(responseCursor));
      responseCursor = step.response.messages.length;
    },
    headers: {
      "X-Lovable-AIG-Run-ID": correlation.runID,
      "X-Lovable-AIG-Metadata": JSON.stringify({
        live_session_id: correlation.sessionID,
        delegation_id: correlation.delegationID,
      }),
    },
    providerOptions: {
      openai: {
        store: false,
        ...(config.backendModel !== "openai/chat-latest"
          ? {
              forceReasoning: true,
              reasoningEffort: "medium",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            }
          : {}),
      },
    },
    system:
      "You support a voice-only personal trainer. Answer the user's latest fitness question so the trainer can say it aloud while the user is mid-workout. " +
      "Transcripts may be incomplete or corrected. Use the latest correction. " +
      "Continue from completed tool results; do not repeat completed actions. " +
      "For any named exercise, call get_exercise_cues first and build on its cues. " +
      "Write plain spoken sentences only: no lists, markdown, symbols, or headings. At most 90 words. " +
      "Cover what matters: breathing, where to feel it, core, posture, and the mistake to avoid. " +
      "For pain or injury, give safe modifications and advise stopping if pain is sharp; never diagnose. " +
      "Ask for missing details instead of guessing. You have no other tools.",
    messages,
    tools: {
      get_exercise_cues: tool({
        description:
          "Look up curated coaching cues (breathing, where to feel it, core, posture, common mistakes) for an exercise.",
        inputSchema: exerciseCuesInput,
        execute: async ({ exercise }) => {
          signal.throwIfAborted();
          const cues = findExercise(exercise);
          if (cues) return { found: true, cues };
          return { found: false, known_exercises: EXERCISES.map((e) => e.name) };
        },
      }),
    },
  });
  let completed = false;
  let stepCompleted = false;
  let failed = false;
  // Drain through HTTP EOF so successful work is not recorded as cancelled by the Gateway.
  for await (const part of result.fullStream) {
    if (part.type === "start-step") stepCompleted = false;
    if (part.type === "raw" && part.rawValue && typeof part.rawValue === "object" && "type" in part.rawValue) {
      if (part.rawValue.type === "response.completed") stepCompleted = true;
      if (part.rawValue.type === "response.failed" || part.rawValue.type === "response.incomplete") failed = true;
    }
    if (part.type === "finish-step" && !stepCompleted) failed = true;
    if (part.type === "error" || part.type === "abort") failed = true;
    if (part.type === "finish") completed = part.finishReason === "stop";
  }
  signal.throwIfAborted();
  if (failed || !completed) throw new Error("The backend response did not complete");
  const answer = await result.text;
  if (!answer.trim()) throw new Error("The backend response had no answer");
  return answer;
}

function* commentaryChunks(content: string) {
  const encoder = new TextEncoder();
  let chunk = "";
  let bytes = 0;
  for (const [word] of content.matchAll(/\S+\s*|\s+/gu)) {
    // Chunks stay well inside the provider's per-append size limit.
    if (chunk && bytes + encoder.encode(word).length > 480) {
      yield chunk;
      chunk = "";
      bytes = 0;
    }
    for (const character of word) {
      const size = encoder.encode(character).length;
      if (bytes + size > 480) {
        yield chunk;
        chunk = "";
        bytes = 0;
      }
      chunk += character;
      bytes += size;
    }
  }
  if (chunk) yield chunk;
}

export function bindLiveConnection(
  browser: LiveSocket,
  configuration: LiveConfig,
  execution: LiveExecutionContext,
  connect: LiveConnector,
): void {
  const config = { ...configuration };
  const runID = crypto.randomUUID();
  const setupAbort = new AbortController();
  let gateway: LiveSocket | undefined;
  let sessionID: string | undefined;
  let starting = false;
  let closing = false;
  let finished = false;
  let revision = 0;
  let task: AbortController | undefined;
  const pendingDelegations: Array<{ event: ProviderEvent }> = [];
  // Trainer pacing: offer a cue on its own after a stretch of silence.
  let coachingActive = false;
  let coachingPaused = false;
  let endingRequested = false;
  let journalHash: string | undefined;
  let coachVoice: CoachVoice = "female";
  let workoutStartedAt: number | undefined;
  let savingWorkout = false;
  let userWords = "";
  let lastActivity = Date.now();
  let recentUserText = "";
  let cueTimer: ReturnType<typeof setInterval> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let completedDelegation: (typeof pendingDelegations)[number] | undefined;
  const backendMessages: ModelMessage[] = [];
  let transcriptCursor = 0;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let finishDrain: (() => void) | undefined;
  let browserReady = false;
  let greetingRequested = false;
  let greetingCommand: { id: string; type: "instructions" | "commentary" } | undefined;
  let greetingTimer: ReturnType<typeof setTimeout> | undefined;
  const startTimer = setTimeout(() => {
    emit({ type: "app.error", error: { message: "Voice startup message timed out" } });
    stop();
  }, 5000);
  const transcripts: Transcript[] = [];
  const delegations = new Set<string>();

  function emit(event: object) {
    if (browser.readyState !== 1) return;
    try {
      browser.send(JSON.stringify(event));
    } catch {
      stop();
    }
  }

  function close(socket?: LiveSocket) {
    if (!socket || socket.readyState === 3) return;
    try {
      socket.close(1000, "Call ended");
    } catch {
      return;
    }
  }

  function clearGreeting() {
    clearTimeout(greetingTimer);
    greetingCommand = undefined;
  }

  function requestGreeting() {
    const content = (
      config.openingInstructions ??
      "Start the conversation now in your configured language and role. Give a brief greeting suited to this app's purpose, ask one relevant opening question, then listen."
    ).trim();
    if (!content || !browserReady || !sessionID || greetingRequested || closing) return;
    greetingRequested = true;
    if (new TextEncoder().encode(content).length > 480) {
      emit({ type: "app.greeting.error", error: { message: "The opening instructions are too long" } });
      return;
    }
    greetingCommand = { id: crypto.randomUUID(), type: "instructions" };
    greetingTimer = setTimeout(() => {
      clearGreeting();
      emit({ type: "app.greeting.error", error: { message: "The opening could not be confirmed" } });
    }, 10_000);
    gateway?.send(
      JSON.stringify({
        type: "session.instructions.append",
        event_id: greetingCommand.id,
        delegation_id: null,
        content,
      }),
    );
  }

  function sendCoachCommentary(content: string) {
    if (closing || gateway?.readyState !== 1) return;
    try {
      gateway.send(
        JSON.stringify({
          type: "session.commentary.append",
          event_id: crypto.randomUUID(),
          delegation_id: null,
          content,
        }),
      );
    } catch {
      stop();
    }
  }

  function checkCue() {
    if (closing || endingRequested || !coachingActive || coachingPaused) return;
    if (task || pendingDelegations.length || greetingCommand) return;
    if (Date.now() - lastActivity < CUE_IDLE_SECONDS * 1000) return;
    lastActivity = Date.now();
    sendCoachCommentary(
      "Coaching cue now: in one or two short sentences, give the next most useful cue for what the user is doing: breathing rhythm, core, posture, or where they should feel it. If they seem to be resting, give a recovery breathing cue or ask if they're ready for the next set. Do not repeat your last cue.",
    );
  }

  function handleUserWords(delta: string) {
    recentUserText = (recentUserText + delta).slice(-160);
    const voiceChoice = detectVoiceChoice(recentUserText);
    if (voiceChoice) {
      recentUserText = "";
      emit({ type: "app.coach.voice.selected", voice: voiceChoice });
      sendCoachCommentary(`The user's ${voiceChoice} voice preference has been set for their next workout. Confirm briefly that this call keeps its current voice.`);
      return;
    }
    if (/\b(?:workout history|last workout|previous workouts|recent workouts)\b/i.test(recentUserText)) {
      recentUserText = "";
      const hash = journalHash;
      if (hash) execution.waitUntil(readWorkouts(hash).then((rows) => {
        const details = rows.slice(0, 3).map((row) => `${row.completed_at.slice(0, 10)}: ${row.exercises.join(", ") || "workout"}, ${Math.round(row.duration_seconds / 60)} minutes`).join("; ");
        sendCoachCommentary(rows.length ? `Read this verified workout history briefly: ${details}` : "Tell the user there are no completed workouts saved on this phone yet.");
      }).catch(() => sendCoachCommentary("Tell the user their workout history could not be loaded.")));
      return;
    }
    coachingActive = true;
    const command = detectCoachCommand(recentUserText);
    const completed = isWorkoutCompletion(recentUserText);
    if (!command && !completed) return;
    recentUserText = "";
    if (command === "pause") {
      coachingPaused = true;
      emit({ type: "app.coach.paused" });
    } else if (command === "resume") {
      coachingPaused = false;
      emit({ type: "app.coach.resumed" });
    } else if (command === "end" || completed) {
      completeWorkout();
    }
  }

  function completeWorkout(closeImmediately = false) {
    if (endingRequested || closing) return;
    endingRequested = true;
    discardPendingWork();
    emit({ type: "app.coach.ending" });
    const hash = journalHash;
    const startedAt = workoutStartedAt;
    if (!hash || startedAt === undefined || !coachingActive) {
      if (closeImmediately) stop();
      else {
        sendCoachCommentary("There was no workout to log yet. Say a brief goodbye.");
        endTimer = setTimeout(stop, 5000);
      }
      return;
    }
    savingWorkout = true;
    execution.waitUntil(saveWorkout({ id: runID, deviceHash: hash, startedAt,
      completedAt: Date.now(), voice: coachVoice, userWords }).then((row) => {
      emit({ type: "app.workout.saved", workout: row });
      if (!closeImmediately) sendCoachCommentary("The workout was successfully saved. Say your workout is logged and give a short encouraging goodbye. Do not ask a question.");
    }).catch((error) => {
      const message = error instanceof Error ? error.message : "Your workout could not be saved.";
      emit({ type: "app.workout.save_failed", error: { message } });
      if (!closeImmediately) sendCoachCommentary(`Tell the user: ${message} Give a brief goodbye without claiming the workout is logged.`);
    }).finally(() => {
      savingWorkout = false;
      if (closeImmediately) stop();
      else endTimer = setTimeout(stop, 8000);
    }));
  }

  function discardPendingWork() {
    pendingDelegations.length = 0;
    completedDelegation = undefined;
    clearTimeout(restartTimer);
    task?.abort();
  }

  function finish() {
    if (finished) return;
    finished = closing = true;
    clearTimeout(startTimer);
    clearTimeout(startupTimer);
    clearTimeout(closeTimer);
    clearTimeout(restartTimer);
    clearInterval(cueTimer);
    clearTimeout(endTimer);
    clearGreeting();
    discardPendingWork();
    setupAbort.abort();
    close(gateway);
    close(browser);
    finishDrain?.();
  }

  function stop() {
    if (closing) return;
    closing = true;
    discardPendingWork();
    clearTimeout(startupTimer);
    clearTimeout(startTimer);
    clearInterval(cueTimer);
    clearTimeout(endTimer);
    clearGreeting();
    if (gateway?.readyState === 1) {
      execution.waitUntil(
        new Promise<void>((resolve) => {
          finishDrain = resolve;
        }),
      );
      closeTimer = setTimeout(finish, 15_000);
      try {
        gateway.send(JSON.stringify({ type: "session.close" }));
      } catch {
        finish();
      }
    } else {
      finish();
    }
  }

  function scheduleDelegation() {
    clearTimeout(restartTimer);
    if (closing || task || pendingDelegations.length === 0) return;
    restartTimer = setTimeout(() => void runDelegation(), 300);
  }

  function deliverResult(delegationID: string, answer: string) {
    if (closing) return;
    if (gateway?.readyState !== 1) return stop();
    try {
      for (const content of commentaryChunks(answer)) {
        gateway.send(
          JSON.stringify({
            type: "session.commentary.append",
            event_id: crypto.randomUUID(),
            delegation_id: delegationID,
            content,
          }),
        );
      }
      lastActivity = Date.now();
      completedDelegation = pendingDelegations.shift();
    } catch {
      stop();
    }
  }

  async function runDelegation() {
    const pending = pendingDelegations[0];
    const event = pending?.event;
    const id = event?.delegation?.id;
    if (!pending || !event || !id || closing || task) return;
    if (!transcripts.some(({ role, text }) => role === "user" && text.trim())) return;
    const controller = new AbortController();
    task = controller;
    let taskRevision = revision;
    try {
      const answer = await answerQuestion(
        backendMessages,
        config,
        { runID, sessionID, delegationID: id },
        controller.signal,
        () => {
          const updates = transcripts.slice(transcriptCursor);
          backendMessages.push(...updates.map(({ role, text }) => ({ role, content: text })));
          transcriptCursor = transcripts.length;
          taskRevision = revision;
        },
      );
      if (closing || controller.signal.aborted) return;
      if (taskRevision !== revision) return;
      deliverResult(id, answer.trim());
    } catch {
      if (closing || controller.signal.aborted) return;
      backendMessages.push({
        role: "assistant",
        content:
          "The backend attempt failed. Completed tool results remain valid; verify uncertain external actions before any retry.",
      });
      if (taskRevision !== revision) return;
      deliverResult(id, "The backend could not finish the answer. Ask whether the user wants to try again.");
    } finally {
      if (task === controller) task = undefined;
      scheduleDelegation();
    }
  }

  function queueDelegation(event: ProviderEvent) {
    pendingDelegations.push({ event });
    emit({ type: "app.delegation.pending", delegation_id: event.delegation?.id });
    scheduleDelegation();
  }

  function receiveGateway(data: unknown) {
    try {
      if (typeof data !== "string" || data.length > 1024 * 1024) throw new Error("Invalid voice event");
      const event: ProviderEvent = JSON.parse(data);
      if (browser.readyState === 1) browser.send(data);
      if (event.type === "session.closed") return finish();
      if (event.type === "gateway.session.closing" || event.type === "gateway.error" || event.type === "app.error") {
        return stop();
      }
      if (closing) return;
      if (event.type === "gateway.session.created") {
        sessionID = event.session?.id;
        clearTimeout(startupTimer);
        clearInterval(cueTimer);
        cueTimer = setInterval(checkCue, 2000);
        requestGreeting();
      }
      if (
        greetingCommand &&
        event.type === `session.${greetingCommand.type}.appended` &&
        event.client_event_id === greetingCommand.id
      ) {
        if (greetingCommand.type === "instructions") {
          greetingCommand = { id: crypto.randomUUID(), type: "commentary" };
          gateway?.send(
            JSON.stringify({
              type: "session.commentary.append",
              event_id: greetingCommand.id,
              delegation_id: null,
              content: "Begin the conversation now, following the instructions provided.",
            }),
          );
        } else {
          clearGreeting();
          emit({ type: "app.greeting.accepted" });
        }
      } else if (greetingCommand && event.type === "error" && event.error?.client_event_id === greetingCommand.id) {
        clearGreeting();
        emit({ type: "app.greeting.error", error: { message: event.error.message ?? "The opening was rejected" } });
      }
      if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
        const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
        if (!event.delta?.trim()) return;
        lastActivity = Date.now();
        if (role === "user") {
          userWords = (userWords + event.delta).slice(-12000);
          handleUserWords(event.delta);
        }
        const listeningSound = role === "user" && Boolean(task) && isListeningSound(event.delta);
        transcripts.push({
          role,
          text: event.delta,
          start_ms: event.start_ms ?? 0,
          end_ms: event.end_ms ?? 0,
          listeningSound,
        });
        if (listeningSound) return;
        if (role === "user") {
          revision++;
          const offset = completedDelegation?.event.offset_ms;
          // Live has no transcript watermark; completed handoffs can receive late context.
          if (
            pendingDelegations.length === 0 &&
            completedDelegation &&
            typeof offset === "number" &&
            Number.isFinite(offset) &&
            offset >= 0 &&
            typeof event.start_ms === "number" &&
            Number.isFinite(event.start_ms) &&
            event.start_ms >= 0 &&
            event.start_ms <= offset
          ) {
            pendingDelegations.push(completedDelegation);
            completedDelegation = undefined;
          }
          if (pendingDelegations.length) {
            emit({ type: "app.delegation.pending", delegation_id: pendingDelegations[0]?.event.delegation?.id });
          }
        }
        scheduleDelegation();
      } else if (event.type === "session.delegation.created") {
        const id = event.delegation?.id;
        if (id && event.delegation?.target === "client" && !delegations.has(id)) {
          delegations.add(id);
          queueDelegation(event);
        }
      }
    } catch {
      emit({ type: "app.error", error: { message: "Invalid voice event or lost connection" } });
      stop();
    }
  }

  async function startSession(sdp: string, capability: unknown, voice: unknown) {
    if (closing || browser.readyState !== 1) return;
    clearTimeout(startTimer);
    journalHash = await deviceHash(capability);
    coachVoice = voice === "male" ? "male" : "female";
    startupTimer = setTimeout(() => {
      emit({ type: "app.error", error: { message: "Voice startup timed out" } });
      stop();
    }, 40_000);
    const accepted = await connect(
      new URL(`${gatewayAPIBase(config.baseURL)}/live/sessions`).href,
      {
        "Lovable-API-Key": config.key,
        "X-Lovable-AIG-SDK": "fetch",
        "X-Lovable-AIG-Run-ID": runID,
      },
      setupAbort.signal,
    );
    if (closing || browser.readyState !== 1) {
      close(accepted);
      return;
    }
    gateway = accepted;
    gateway.onMessage(receiveGateway);
    gateway.onClose(finish);
    gateway.onError(() => {
      emit({ type: "app.error", error: { message: "Voice gateway connection failed" } });
      stop();
    });
    gateway.send(
      JSON.stringify({
        type: "session.start",
        session: {
          model: config.liveModel,
          instructions: conversationInstructions,
          audio: { output: { voice: COACH_VOICES[coachVoice] } },
          delegation: { type: "client" },
        },
        transport: { type: "webrtc", sdp },
      }),
    );
  }

  browser.onMessage((data) => {
    try {
      if (typeof data !== "string" || data.length > 64 * 1024) throw new Error("Invalid client message");
      const event = JSON.parse(data);
      if (event.type === "session.close") {
        if (event.completed === true) completeWorkout(true);
        else if (!savingWorkout) stop();
        return;
      }
      if (closing) return;
      if (!gateway) {
        if (starting || event.type !== "app.start" || typeof event.sdp !== "string" || !event.sdp.trim()) {
          throw new Error("Voice startup message required");
        }
        starting = true;
        execution.waitUntil(
          startSession(event.sdp, event.capability, event.voice).catch((error) => {
            if (!closing)
              emit({
                type: "app.error",
                error: { message: error instanceof Error ? error.message : "Voice startup failed" },
              });
            stop();
          }),
        );
        return;
      }
      if (event.type === "app.ready") {
        browserReady = true;
        workoutStartedAt ??= Date.now();
        requestGreeting();
        return;
      }
      if (event.type !== "gateway.heartbeat") {
        throw new Error("Unsupported client event");
      }
      if (gateway.readyState !== 1) return stop();
      gateway.send(data);
    } catch {
      emit({ type: "app.error", error: { message: "Voice connection could not be started or continued" } });
      stop();
    }
  });
  browser.onClose(stop);
  browser.onError(stop);
}
