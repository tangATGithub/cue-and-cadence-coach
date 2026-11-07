import { EXERCISES } from "./exercise-cues";

export type CoachVoice = "male" | "female";
export const COACH_VOICES = { male: "meridian", female: "gleam" } as const;

export function detectVoiceChoice(text: string): CoachVoice | null {
  const normalized = text.toLowerCase();
  if (/\b(female|woman|feminine)\s+(voice|coach|trainer)\b/.test(normalized)) return "female";
  if (/\b(male|man|masculine)\s+(voice|coach|trainer)\b/.test(normalized)) return "male";
  return null;
}

export function isWorkoutCompletion(text: string) {
  return /\b(?:workout|training|session)\s+(?:is\s+)?(?:complete|completed|finished|done)\b|\b(?:i'?m|we'?re)\s+done\b/i.test(text);
}

export function buildWorkoutLog(input: {
  id: string; deviceHash: string; startedAt: number; completedAt: number;
  voice: CoachVoice; userWords: string;
}) {
  const text = input.userWords.trim().slice(-12000);
  const normalized = text.toLowerCase();
  const exercises = EXERCISES.filter((exercise) =>
    [exercise.name, ...exercise.aliases].some((name) => normalized.includes(name.toLowerCase())),
  ).map((exercise) => exercise.name);
  return {
    id: input.id, device_hash: input.deviceHash,
    started_at: new Date(input.startedAt).toISOString(),
    completed_at: new Date(input.completedAt).toISOString(),
    duration_seconds: Math.max(0, Math.round((input.completedAt - input.startedAt) / 1000)),
    coach_voice: input.voice, exercises,
    reported_details: text,
  };
}