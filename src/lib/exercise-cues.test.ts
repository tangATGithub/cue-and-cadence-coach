import { describe, expect, it } from "vitest";

import { findExercise } from "./exercise-cues";

describe("exercise cue lookup", () => {
  it("finds an exercise by a spoken alias", () => {
    expect(findExercise("Push ups")?.name).toBe("push-up");
  });

  it("finds an exercise inside a longer phrase", () => {
    expect(findExercise("romanian deadlift")?.name).toBe("deadlift");
  });

  it("returns nothing for an unknown exercise", () => {
    expect(findExercise("underwater basket weaving")).toBeUndefined();
  });
});
