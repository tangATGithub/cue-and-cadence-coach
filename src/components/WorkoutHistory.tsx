import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDeviceCapability } from '@/lib/device-capability';
import { getWorkouts } from '@/lib/workouts.functions';
import { dailyWorkouts, readExerciseSets } from '@/lib/workout-history';

export function WorkoutHistory() {
  const [capability, setCapability] = useState<string>();
  const [storageError, setStorageError] = useState(false);
  const load = useServerFn(getWorkouts);
  useEffect(() => {
    try { setCapability(getDeviceCapability()); } catch { setStorageError(true); }
  }, []);
  const history = useQuery({ queryKey: ['workout-history', capability], enabled: Boolean(capability),
    queryFn: () => capability ? load({ data: { capability } }) : Promise.resolve([]), retry: false });
  const rows = history.data ?? [];
  const days = dailyWorkouts(rows);
  const maxSets = Math.max(1, ...days.flatMap((day) => day.exercises.map((entry) => entry.completed_sets ?? 0)));
  return <section className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div><p className="mb-2 text-sm font-semibold uppercase text-primary">Your training record</p>
        <h1 className="font-display text-5xl text-foreground">Logged workouts</h1></div>
      <div className="flex gap-2">
        <Button variant="ghost" size="icon" aria-label="Refresh workout history" title="Refresh workout history" disabled={history.isFetching} onClick={() => void history.refetch()}><RefreshCw /></Button>
      </div>
    </div>
    {storageError || history.isError ? <p role="alert" className="text-destructive">Your workout history couldn’t be loaded. {storageError ? 'Allow website storage on this phone.' : 'Please try refreshing your history.'}</p>
      : history.isPending ? <p role="status" className="text-muted-foreground">Loading workouts…</p>
      : !days.length ? <div className="border-y border-border py-16 text-center"><p className="font-display text-3xl">No completed workouts yet</p><p className="mt-3 text-muted-foreground">Your training record starts with your first saved workout.</p></div>
      : <div className="space-y-10">{days.map((day) => <article key={day.date} className="border-b border-border pb-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">{new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h2>
          <p className="text-sm text-muted-foreground">{day.sessions} {day.sessions === 1 ? 'workout' : 'workouts'} · {Math.round(day.seconds / 60)} min</p>
        </div>
        <div className="mb-3 flex justify-between text-xs uppercase text-muted-foreground"><span>Exercise</span><span>Completed sets</span></div>
        <div className="space-y-4">{day.exercises.map((entry) => <div key={entry.exercise} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_3rem] items-center gap-3">
          <span className="break-words capitalize">{entry.exercise}</span>
          <meter className="workout-meter w-full" min={0} max={maxSets} value={entry.completed_sets ?? 0} aria-label={`${entry.exercise}: ${entry.completed_sets === null ? 'sets not reported' : `${entry.completed_sets} completed sets`}`} />
          <span className="text-right font-semibold text-primary">{entry.completed_sets ?? '—'}</span>
        </div>)}</div>
        {day.exercises.some((entry) => entry.completed_sets === null) && <p className="mt-4 text-sm text-muted-foreground">— Sets not reported</p>}
        <h3 className="mb-3 mt-8 text-sm font-semibold uppercase text-muted-foreground">Workouts completed this day</h3>
        <ol className="divide-y divide-border">{day.workouts.map((workout, index) => {
          const reported = readExerciseSets(workout.exercise_sets);
          const entries = reported.length ? reported : workout.exercises.map((exercise) => ({ exercise, completed_sets: null }));
          return <li key={workout.id} className="py-4">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">Workout {day.workouts.length - index}</span>
              <span className="text-sm text-muted-foreground">{new Date(workout.completed_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {Math.round(workout.duration_seconds / 60)} min</span>
            </div>
            <ul className="mt-2 space-y-1">{entries.map((entry) => <li key={entry.exercise} className="flex justify-between gap-4 text-sm">
              <span className="capitalize">{entry.exercise}</span><span className="text-muted-foreground">{entry.completed_sets === null ? 'Sets not reported' : `${entry.completed_sets} completed sets`}</span>
            </li>)}</ul>
            {!entries.length && <p className="mt-2 text-sm text-muted-foreground">Exercises not reported</p>}
          </li>;
        })}</ol>
      </article>)}</div>}
  </section>;
}