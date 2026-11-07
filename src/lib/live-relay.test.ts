import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { bindLiveConnection, type LiveSocket } from "./live-relay.server";
import { saveWorkout } from "./workout-journal.server";

vi.mock("./workout-journal.server", () => ({
  deviceHash: vi.fn(async () => "private-device-hash"),
  readWorkouts: vi.fn(async () => []),
  saveWorkout: vi.fn(async () => ({ id: "saved", duration_seconds: 60, exercises: ["squat"] })),
}));

function socket() {
  let receive: (data: unknown) => void = () => {};
  let closed: () => void = () => {};
  const sent: Array<Record<string, unknown>> = [];
  const value: LiveSocket = {
    readyState: 1, send: (data) => { sent.push(JSON.parse(data)); }, close: vi.fn(),
    onMessage: (handler) => { receive = handler; },
    onClose: (handler) => { closed = handler; }, onError: () => {},
  };
  return { value, sent, receive: (event: object) => receive(JSON.stringify(event)), disconnect: () => closed() };
}

describe("workout completion relay", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());

  async function setup(voice: "male" | "female") {
    const browser = socket();
    const gateway = socket();
    bindLiveConnection(browser.value, { baseURL: "https://ai.gateway.lovable.dev", key: "test",
      liveModel: "openai/gpt-live-1", backendModel: "openai/gpt-6-astra" },
    { waitUntil: (promise) => { void promise; } }, async () => gateway.value);
    browser.receive({ type: "app.start", sdp: "test-offer", capability: "a".repeat(64), voice });
    await vi.advanceTimersByTimeAsync(0);
    gateway.receive({ type: "gateway.session.created", session: { id: "test-session" } });
    browser.receive({ type: "app.ready" });
    return { browser, gateway };
  }

  it("uses the selected session voice", async () => {
    const { gateway } = await setup("male");
    expect(gateway.sent[0]).toMatchObject({ type: "session.start", session: { audio: { output: { voice: "meridian" } } } });
  });
  it("saves once when end workout is spoken and confirms the saved record", async () => {
    const { browser, gateway } = await setup("female");
    gateway.receive({ type: "session.input_transcript.delta", delta: "I'm doing squats. " });
    gateway.receive({ type: "session.input_transcript.delta", delta: "End workout." });
    gateway.receive({ type: "session.input_transcript.delta", delta: "End workout." });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).toHaveBeenCalledTimes(1);
    expect(saveWorkout).toHaveBeenCalledWith(expect.objectContaining({ voice: "female", deviceHash: "private-device-hash", userWords: "I'm doing squats. End workout." }));
    expect(browser.sent).toContainEqual({ type: "app.workout.saved", workout: { id: "saved", duration_seconds: 60, exercises: ["squat"] } });
  });
  it("logs explicit completed workouts", async () => {
    const { gateway } = await setup("male");
    gateway.receive({ type: "session.input_transcript.delta", delta: "My workout is completed." });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).toHaveBeenCalledTimes(1);
  });
  it("does not log connection loss as a completed workout", async () => {
    const { browser, gateway } = await setup("female");
    gateway.receive({ type: "session.input_transcript.delta", delta: "I'm doing squats." });
    browser.disconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).not.toHaveBeenCalled();
  });
});