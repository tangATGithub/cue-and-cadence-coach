import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWorkouts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ capability: z.string().regex(/^[a-f0-9]{64}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { deviceHash, readWorkouts } = await import("./workout-journal.server");
    return readWorkouts(await deviceHash(data.capability));
  });