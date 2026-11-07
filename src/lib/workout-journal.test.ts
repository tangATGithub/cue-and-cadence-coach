import { describe, expect, it } from "vitest";
import { buildWorkoutLog, COACH_VOICES, detectVoiceChoice, isWorkoutCompletion, extractCompletedSets } from "./workout-journal";

describe("workout requirements", () => {
  it('saves both exercises in a single compound completion report', () => {
    expect(extractCompletedSets('I completed three sets of squats and two sets of push-ups. End workout.')).toEqual([
      { exercise: 'squat', completed_sets: 3 }, { exercise: 'push-up', completed_sets: 2 },
    ]);
  });
  it('does not carry completion into a separate sentence or a planned exercise', () => {
    expect(extractCompletedSets('I completed three sets of squats. Two sets of push-ups.')).toEqual([
      { exercise: 'squat', completed_sets: 3 }, { exercise: 'push-up', completed_sets: null },
    ]);
    expect(extractCompletedSets('I completed three sets of squats and will do two sets of push-ups.')).toEqual([
      { exercise: 'squat', completed_sets: 3 }, { exercise: 'push-up', completed_sets: null },
    ]);
  });
  it('saves completed sets separately for each exercise', () => {
    expect(extractCompletedSets('I completed three sets of squats. I completed two sets of push-ups. End workout.')).toEqual([
      { exercise: 'squat', completed_sets: 3 }, { exercise: 'push-up', completed_sets: 2 },
    ]);
  });
  it('does not count planned sets as completed', () => {
    expect(extractCompletedSets('I will do three sets of squats.')).toEqual([{ exercise: 'squat', completed_sets: null }]);
  });
  it('counts individual reports and replaces the total on correction', () => {
    expect(extractCompletedSets('Squats. Set done. Set done. Actually I completed three sets of squats.'))
      .toEqual([{ exercise: 'squat', completed_sets: 3 }]);
  });
  it('does not mistake side planks for planks or split squats for squats', () => {
    expect(extractCompletedSets('I completed two sets of side planks. I completed three sets of split squat.'))
      .toEqual([{ exercise: 'side plank', completed_sets: 2 }, { exercise: 'lunge', completed_sets: 3 }]);
  });
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
    expect(row.exercises).toContain("squat");
    expect(row.reported_details).toContain("three sets of ten");
  });
});