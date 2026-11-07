// Spoken commands that change how the trainer behaves, detected from the
// user's most recent words. Kept pure so it can be tested.

export type CoachCommand = "end" | "pause" | "resume" | null;

const END = /\b(end|finish|stop|close)\s+(the\s+|my\s+|this\s+|our\s+)?(workout|session|training)\b|\bgoodbye coach\b/;
const PAUSE =
  /\b(pause|hold on|give me a (minute|moment|second|sec)|stop talking|be quiet|quiet please|shush|stop coaching)\b/;
const RESUME = /\b(resume|let'?s go|keep going|next set|go again|i'?m back|continue|start coaching|i'?m ready)\b/;

/** Detect a command in the user's latest words. End wins over pause, pause over resume. */
export function detectCoachCommand(recentUserText: string): CoachCommand {
  const text = recentUserText.toLowerCase().replace(/[’]/g, "'");
  if (END.test(text)) return "end";
  if (PAUSE.test(text)) return "pause";
  if (RESUME.test(text)) return "resume";
  return null;
}

/** Seconds of silence before the trainer offers the next cue on its own. */
export const CUE_IDLE_SECONDS = 14;
