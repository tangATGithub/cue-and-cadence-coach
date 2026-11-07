import { EXERCISES } from "./exercise-cues";

export type CoachVoice = "male" | "female";
export const COACH_VOICES = { male: "meridian", female: "gleam" } as const;

export type ExerciseSets = { exercise: string; completed_sets: number | null };

/** Only explicit completion reports count; a plan is not a completed set. */
export function extractCompletedSets(text: string): ExerciseSets[] {
  const numbers: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const number = '(\\d{1,3}|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
  const entries = new Map<string, ExerciseSets>();
  let current: string | undefined;
  const normalized = text.toLowerCase().replace(/[–—]/g, '-');
  const aliases = EXERCISES.flatMap((exercise) => [exercise.name, ...exercise.aliases].map((alias) => ({ alias, exercise: exercise.name })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const escaped = aliases.map(({ alias }) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const exercisePattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');
  // Split before exercise switches as well as sentence boundaries, retaining
  // reports such as "completed three sets of squats and two sets of push-ups".
  const clauses = normalized.split(/([.!?;\n]+|,\s*|\band\b)/);
  let completionContinues = false;
  for (const clause of clauses) {
    if (/^[.!?;\n]+$/.test(clause)) { completionContinues = false; continue; }
    if (/^(?:,\s*|and)$/.test(clause)) continue;
    const matches = [...clause.matchAll(exercisePattern)];
    if (matches.length) {
      const last = matches[matches.length - 1];
      const found = aliases.find(({ alias }) => alias === last?.[0]);
      if (found) current = found.exercise;
      for (const match of matches) {
        const foundExercise = aliases.find(({ alias }) => alias === match[0])?.exercise;
        if (foundExercise && !entries.has(foundExercise)) entries.set(foundExercise, { exercise: foundExercise, completed_sets: null });
      }
    }
    if (!current || /\b(?:plan|planning|will|going to|want to|should|aim|target|how many|haven't|not completed|not done)\b/.test(clause)) { completionContinues = false; continue; }
    const total = clause.match(new RegExp(`\\b(?:completed|finished|did|done)\\s+(?:a total of\\s+)?${number}\\s+sets?\\b`))
      ?? clause.match(new RegExp(`\\b${number}\\s+sets?\\b[^.!?]*\\b(?:completed|finished|done)\\b`))
      ?? (completionContinues ? clause.match(new RegExp(`^\\s*${number}\\s+sets?\\b`)) : null);
    const entry = entries.get(current);
    if (!entry) continue;
    const reported = total?.[1];
    if (reported !== undefined) {
      entry.completed_sets = Number.isNaN(Number(reported)) ? numbers[reported] ?? null : Number(reported);
      completionContinues = true;
    }
    else if (/\b(?:set (?:is )?(?:done|complete|completed|finished)|(?:completed|finished) (?:a|another|the) set)\b/.test(clause)) {
      entry.completed_sets = (entry.completed_sets ?? 0) + 1;
    } else completionContinues = false;
  }
  return [...entries.values()];
}

export function detectVoiceChoice(text: string): CoachVoice | null {
  const normalized = text.toLowerCase();
  if (/\b(female|woman|feminine)\s+(voice|coach|trainer)\b/.test(normalized)) return "female";
  if (/\b(male|man|masculine)\s+(voice|coach|trainer)\b/.test(normalized)) return "male";
  return null;
}

export function isWorkoutCompletion(text: string) {
  return /\b(?:workout|training|session)\s+(?:is\s+)?(?:complete|completed|finished|done)\b|\b(?:i'?m|we'?re)\s+done\s+(?:with\s+)?(?:the\s+|my\s+|our\s+)?(?:workout|training|session)\b/i.test(text);
}

export function buildWorkoutLog(input: {
  id: string; deviceHash: string; startedAt: number; completedAt: number;
  voice: CoachVoice; userWords: string;
}) {
  const text = input.userWords.trim().slice(-12000);
  const normalized = text.toLowerCase();
  const exercise_sets = extractCompletedSets(normalized);
  const exercises = exercise_sets.map((entry) => entry.exercise);
  return {
    id: input.id, device_hash: input.deviceHash,
    started_at: new Date(input.startedAt).toISOString(),
    completed_at: new Date(input.completedAt).toISOString(),
    duration_seconds: Math.max(0, Math.round((input.completedAt - input.startedAt) / 1000)),
    coach_voice: input.voice, exercises, exercise_sets,
    reported_details: text,
  };
}