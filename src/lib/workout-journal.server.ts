import { z } from "zod";
import { buildWorkoutLog, type CoachVoice } from "./workout-journal";

export async function deviceHash(capability: unknown) {
  const token = z.string().regex(/^[a-f0-9]{64}$/).parse(capability);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveWorkout(input: {
  id: string; deviceHash: string; startedAt: number; completedAt: number;
  voice: CoachVoice; userWords: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const row = buildWorkoutLog(input);
  const { error } = await supabaseAdmin.from("workout_logs").upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Your workout could not be saved. Please try again.");
  const { data, error: readError } = await supabaseAdmin.from("workout_logs")
    .select("id, duration_seconds, exercises, exercise_sets").eq("id", input.id).eq("device_hash", input.deviceHash).single();
  if (readError || !data) throw new Error("Your workout save could not be confirmed.");
  return data;
}

export async function readWorkouts(hash: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("workout_logs")
    .select("id, completed_at, duration_seconds, exercises, coach_voice, exercise_sets")
    .eq("device_hash", hash).order("completed_at", { ascending: false });
  if (error) throw new Error("Your workout history could not be loaded.");
  return data;
}