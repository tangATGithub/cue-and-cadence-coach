import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { bindLiveConnection, type LiveSocket } from "./live-relay.server";
import { saveWorkout } from "./workout-journal.server";
import { buildWorkoutLog } from "./workout-journal";

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
  it("keeps coaching after all exercise sets finish until the workout explicitly ends", async () => {
    const { browser, gateway } = await setup("female");
    gateway.receive({ type: "session.input_transcript.delta", delta: "I'm working legs. Squats, targeting three sets. " });
    gateway.receive({ type: "session.input_transcript.delta", delta: "I completed three sets of squats. I'm done. " });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).not.toHaveBeenCalled();
    expect(browser.sent.some((event) => event['type'] === 'app.coach.ending')).toBe(false);
    gateway.receive({ type: "session.input_transcript.delta", delta: "Next, lunges, targeting two sets. I completed one set of lunges. End workout." });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).toHaveBeenCalledTimes(1);
    const input = vi.mocked(saveWorkout).mock.calls[0]?.[0];
    if (!input) throw new Error("Workout must be saved");
    expect(buildWorkoutLog(input).exercise_sets).toEqual([
      { exercise: "squat", completed_sets: 3 }, { exercise: "lunge", completed_sets: 1 },
    ]);
  });
  it("does not log connection loss as a completed workout", async () => {
    const { browser, gateway } = await setup("female");
    gateway.receive({ type: "session.input_transcript.delta", delta: "I'm doing squats." });
    browser.disconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).not.toHaveBeenCalled();
  });
  it('saves reported exercise sets on end workout, excluding assistant counts', async () => {
    const { browser, gateway } = await setup('female');
    gateway.receive({ type: 'session.output_transcript.delta', delta: 'You completed ten sets of planks.' });
    gateway.receive({ type: 'session.input_transcript.delta', delta: 'I completed three ' });
    gateway.receive({ type: 'session.input_transcript.delta', delta: 'sets of squats and two sets of push-ups. ' });
    gateway.receive({ type: 'session.input_transcript.delta', delta: 'End workout.' });
    gateway.receive({ type: 'session.input_transcript.delta', delta: 'End workout.' });
    browser.receive({ type: 'session.close', completed: true });
    browser.receive({ type: 'session.close', completed: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(saveWorkout).toHaveBeenCalledTimes(1);
    const input = vi.mocked(saveWorkout).mock.calls[0]?.[0];
    expect(input).toBeDefined();
    if (!input) throw new Error('Workout must be saved');
    expect(buildWorkoutLog(input).exercise_sets).toEqual([
      { exercise: 'squat', completed_sets: 3 }, { exercise: 'push-up', completed_sets: 2 },
    ]);
    expect(browser.sent.filter((event) => event['type'] === 'app.workout.saved')).toHaveLength(1);
  });
  it('announces a failed save without announcing success', async () => {
    vi.mocked(saveWorkout).mockRejectedValueOnce(new Error('Workout could not be saved'));
    const { browser, gateway } = await setup('male');
    gateway.receive({ type: 'session.input_transcript.delta', delta: 'I completed three sets of squats. End workout.' });
    await vi.advanceTimersByTimeAsync(0);
    expect(browser.sent.some((event) => event['type'] === 'app.workout.save_failed')).toBe(true);
    expect(browser.sent.some((event) => event['type'] === 'app.workout.saved')).toBe(false);
  });
});