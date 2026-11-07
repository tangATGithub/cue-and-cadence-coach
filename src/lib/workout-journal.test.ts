import { describe, expect, it } from "vitest";
import { buildWorkoutLog, COACH_VOICES, detectVoiceChoice, isWorkoutCompletion } from "./workout-journal";

describe("workout requirements", () => {
  it("offers distinct male and female voices", () => {
    expect(COACH_VOICES.male).toBe("meridian");
    expect(COACH_VOICES.female).toBe("gleam");
    expect(detectVoiceChoice("use a female coach")).toBe("female");
    expect(detectVoiceChoice("I prefer a male voice")).toBe("male");
  });
  it("recognizes completion without mistaking an exercise question", () => {
    expect(isWorkoutCompletion("my workout is completed")).toBe(true);
    expect(isWorkoutCompletion("I'm done")).toBe(true);
    expect(isWorkoutCompletion("how should I do squats?")).toBe(false);
  });
  it("logs date, duration and reported exercise on completion", () => {
    const row = buildWorkoutLog({ id: "one", deviceHash: "private", startedAt: 0,
      completedAt: 120000, voice: "male", userWords: "I am doing squats, three sets of ten" });
    expect(row.duration_seconds).toBe(120);
    expect(row.completed_at).toBe("1970-01-01T00:02:00.000Z");
    expect(row.exercises).toContain("Squat");
    expect(row.reported_details).toContain("three sets of ten");
  });
});