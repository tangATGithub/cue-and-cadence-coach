import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkoutHistory } from '@/components/WorkoutHistory';

export const Route = createFileRoute('/history')({
  head: () => ({ meta: [
    { title: 'Workout history — Coach' },
    { name: 'description', content: 'Your daily exercise chart, completed sets and individual saved workouts.' },
    { property: 'og:title', content: 'Workout history — Coach' },
    { property: 'og:description', content: 'Your private daily training record with exercises and completed sets.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: History,
});

function History() {
  return <main className="min-h-dvh bg-background">
    <nav className="mx-auto flex max-w-4xl px-6 pt-6 sm:px-10"><Button asChild variant="ghost"><Link to="/"><ArrowLeft />Back to Coach</Link></Button></nav>
    <WorkoutHistory />
  </main>;
}