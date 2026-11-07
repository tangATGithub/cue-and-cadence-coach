import { describe, expect, it } from 'vitest';
import { dailyWorkouts, spokenWorkoutHistory, type SavedWorkout } from './workout-history';

describe('daily workout history', () => {
  const row: SavedWorkout = { id: 'one', completed_at: '2026-11-07T12:00:00Z', duration_seconds: 120, exercises: ['squat'], coach_voice: 'male', exercise_sets: [{ exercise: 'squat', completed_sets: 3 }] };
  it('adds completed sets from multiple workouts on the same day', () => {
    const days = dailyWorkouts([row, { ...row, id: 'two', exercise_sets: [{ exercise: 'squat', completed_sets: 2 }] }]);
    expect(days).toHaveLength(1);
    expect(days[0].exercises).toEqual([{ exercise: 'squat', completed_sets: 5 }]);
    expect(spokenWorkoutHistory([row])).toContain('squat, 3 completed sets');
  });
  it('keeps old or unreported totals unknown rather than inventing sets', () => {
    expect(dailyWorkouts([{ ...row, exercise_sets: [] }])[0].exercises[0].completed_sets).toBeNull();
  });
});