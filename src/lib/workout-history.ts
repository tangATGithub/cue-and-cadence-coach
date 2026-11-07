import type { ExerciseSets } from './workout-journal';

export type SavedWorkout = {
  id: string;
  completed_at: string;
  duration_seconds: number;
  exercises: string[];
  coach_voice: string;
  exercise_sets: unknown;
};

export function readExerciseSets(value: unknown): ExerciseSets[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.exercise !== 'string') return [];
    const count = item.completed_sets;
    return [{ exercise: item.exercise, completed_sets: typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null }];
  });
}

export function dailyWorkouts(rows: SavedWorkout[]) {
  const days = new Map<string, { date: string; sessions: number; seconds: number; exercises: ExerciseSets[] }>();
  for (const row of rows) {
    const date = new Date(row.completed_at).toLocaleDateString('en-CA');
    const day = days.get(date) ?? { date, sessions: 0, seconds: 0, exercises: [] };
    day.sessions++;
    day.seconds += row.duration_seconds;
    const reported = readExerciseSets(row.exercise_sets);
    const entries = reported.length ? reported : row.exercises.map((exercise) => ({ exercise, completed_sets: null }));
    for (const entry of entries) {
      const existing = day.exercises.find((item) => item.exercise === entry.exercise);
      if (!existing) day.exercises.push({ ...entry });
      else if (existing.completed_sets === null || entry.completed_sets === null) existing.completed_sets = null;
      else existing.completed_sets += entry.completed_sets;
    }
    days.set(date, day);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function spokenWorkoutHistory(rows: SavedWorkout[]) {
  return dailyWorkouts(rows).slice(0, 3).map((day) => `${day.date}: ${day.exercises.map((entry) =>
    `${entry.exercise}, ${entry.completed_sets === null ? 'completed sets not reported' : `${entry.completed_sets} completed sets`}`
  ).join('; ') || 'workout'}, ${Math.round(day.seconds / 60)} minutes`).join('. ');
}