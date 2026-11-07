import { describe, expect, it } from "vitest";

import { detectCoachCommand } from "./coach-commands";

describe("spoken coach commands", () => {
  it("ends the session when the user says end the workout", () => {
    expect(detectCoachCommand("okay coach, end the workout")).toBe("end");
  });

  it("pauses coaching when the user asks for a minute", () => {
    expect(detectCoachCommand("hold on, give me a minute")).toBe("pause");
  });

  it("resumes coaching on next set", () => {
    expect(detectCoachCommand("alright, next set")).toBe("resume");
  });

  it("does not treat a normal workout description as a command", () => {
    expect(detectCoachCommand("I'm doing squats today, focusing on legs")).toBeNull();
  });

  it("does not end the session just because a set is done", () => {
    expect(detectCoachCommand("I'm done with that set")).toBeNull();
  });
});
