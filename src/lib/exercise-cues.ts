// Curated coaching cues the voice trainer's backend can look up.
// Plain data so it is safe to import on server or client.

export type ExerciseCues = {
  name: string;
  aliases: string[];
  breathing: string;
  feelIt: string;
  core: string;
  posture: string;
  commonMistakes: string;
};

export const EXERCISES: ExerciseCues[] = [
  {
    name: "squat",
    aliases: ["squats", "bodyweight squat", "air squat", "goblet squat", "back squat"],
    breathing: "Breathe in on the way down, breathe out as you drive up.",
    feelIt: "Front of the thighs and glutes; a little in the hamstrings at the bottom.",
    core: "Brace like someone is about to poke your stomach before each rep.",
    posture: "Chest up, knees tracking over your toes, weight in mid-foot and heels.",
    commonMistakes: "Knees caving in, heels lifting, rounding the lower back.",
  },
  {
    name: "push-up",
    aliases: ["push up", "pushups", "push-ups", "press up", "press-ups"],
    breathing: "Breathe in as you lower, breathe out as you push the floor away.",
    feelIt: "Chest, front of the shoulders and the back of the arms.",
    core: "Squeeze glutes and abs so your body moves as one straight plank.",
    posture: "Hands under shoulders, elbows about 45 degrees from the body, neck long.",
    commonMistakes: "Hips sagging, elbows flaring straight out, half reps.",
  },
  {
    name: "plank",
    aliases: ["planks", "forearm plank", "high plank"],
    breathing: "Slow steady breaths: in through the nose, out through the mouth. Never hold your breath.",
    feelIt: "Deep in the abs, plus shoulders and glutes working to hold the line.",
    core: "Pull your belly button toward your spine and tuck the tailbone slightly.",
    posture: "Elbows under shoulders, straight line from head to heels, eyes on the floor.",
    commonMistakes: "Hips too high or sagging, shoulders shrugged to the ears.",
  },
  {
    name: "side plank",
    aliases: ["side planks"],
    breathing: "Keep breathing slowly; exhale fully to feel the side of the waist tighten.",
    feelIt: "Obliques along the side of the waist and the outer hip.",
    core: "Lift the bottom hip and keep the ribs stacked over the pelvis.",
    posture: "Elbow under shoulder, body in one line, top hip stacked over bottom hip.",
    commonMistakes: "Hips dropping, rolling forward or back.",
  },
  {
    name: "lunge",
    aliases: ["lunges", "forward lunge", "reverse lunge", "walking lunge", "split squat"],
    breathing: "Breathe in as you step and lower, breathe out as you push back up.",
    feelIt: "Front leg thigh and glute; a stretch in the front of the back hip.",
    core: "Keep the core tight so your torso stays tall and doesn't wobble.",
    posture: "Torso upright, front knee over the ankle, back knee drops straight down.",
    commonMistakes: "Front knee shooting past the toes, leaning forward, narrow stance.",
  },
  {
    name: "deadlift",
    aliases: ["deadlifts", "romanian deadlift", "rdl", "stiff leg deadlift"],
    breathing: "Big breath in and brace at the top, lower, then exhale as you stand tall.",
    feelIt: "Hamstrings and glutes; your lower back should hold, not burn.",
    core: "Brace hard before every rep, like wearing a tight belt.",
    posture: "Hinge at the hips, flat back, weight close to the legs, shoulders slightly back.",
    commonMistakes: "Rounding the back, squatting it instead of hinging, letting the weight drift away.",
  },
  {
    name: "glute bridge",
    aliases: ["glute bridges", "bridge", "hip thrust", "hip thrusts"],
    breathing: "Breathe out as you lift the hips, breathe in as you lower.",
    feelIt: "Glutes first, then hamstrings. Not the lower back.",
    core: "Tilt the pelvis slightly so the ribs stay down.",
    posture: "Feet hip width, heels close to the glutes, squeeze at the top for a second.",
    commonMistakes: "Over-arching the lower back, pushing through the toes.",
  },
  {
    name: "bent-over row",
    aliases: ["row", "rows", "bent over row", "dumbbell row", "barbell row"],
    breathing: "Breathe out as you pull, breathe in as you lower.",
    feelIt: "Middle and upper back, between and below the shoulder blades, plus the biceps.",
    core: "Brace so the torso stays still; no swinging.",
    posture: "Hinge forward with a flat back, pull elbows toward the hips, squeeze the shoulder blades.",
    commonMistakes: "Rounding the back, shrugging, using momentum.",
  },
  {
    name: "overhead press",
    aliases: ["shoulder press", "military press", "dumbbell press overhead"],
    breathing: "Breathe in at the shoulders, breathe out as you press up.",
    feelIt: "Shoulders, mainly the front and sides, plus the back of the arms.",
    core: "Squeeze glutes and abs so the lower back does not arch.",
    posture: "Ribs down, press straight up, finish with arms by the ears.",
    commonMistakes: "Leaning back, flaring the ribs, pressing forward instead of up.",
  },
  {
    name: "bicep curl",
    aliases: ["curl", "curls", "bicep curls", "biceps curl", "hammer curl"],
    breathing: "Breathe out as you curl up, breathe in as you lower slowly.",
    feelIt: "Front of the upper arm.",
    core: "Stay tall and braced so the body doesn't rock.",
    posture: "Elbows pinned to your sides, shoulders down and back.",
    commonMistakes: "Swinging the weight, elbows drifting forward, dropping the weight fast.",
  },
  {
    name: "crunch",
    aliases: ["crunches", "sit up", "sit-ups", "situps"],
    breathing: "Breathe out as you curl up, breathe in as you lower.",
    feelIt: "Upper and middle abs.",
    core: "Curl the ribs toward the hips rather than pulling with the neck.",
    posture: "Chin slightly tucked with a fist of space, lower back gently on the floor.",
    commonMistakes: "Yanking the neck, using momentum, holding the breath.",
  },
  {
    name: "mountain climber",
    aliases: ["mountain climbers"],
    breathing: "Keep a steady rhythm: breathe out every one or two knee drives.",
    feelIt: "Abs, shoulders and hip flexors; your heart rate goes up.",
    core: "Hold a strong plank so the hips stay level.",
    posture: "Shoulders over wrists, drive knees toward the chest, hips down.",
    commonMistakes: "Hips piking up, bouncing, shoulders drifting behind the hands.",
  },
  {
    name: "burpee",
    aliases: ["burpees"],
    breathing: "Breathe out on the jump and the push, find a rhythm rather than rushing.",
    feelIt: "Full body: legs, chest, shoulders and lungs.",
    core: "Brace when you kick back so the hips don't sag.",
    posture: "Land softly with bent knees, hands planted under shoulders.",
    commonMistakes: "Sagging hips in the plank, landing stiff-legged.",
  },
  {
    name: "calf raise",
    aliases: ["calf raises", "heel raise", "heel raises"],
    breathing: "Breathe out as you rise, breathe in as you lower.",
    feelIt: "Back of the lower leg.",
    core: "Stand tall and tight for balance.",
    posture: "Rise straight up through the big toe, pause at the top, lower slowly.",
    commonMistakes: "Bouncing, rolling to the outside of the foot.",
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find coaching cues for an exercise by its name or a common alias. */
export function findExercise(query: string): ExerciseCues | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  const exact = EXERCISES.find((e) => [e.name, ...e.aliases].some((n) => normalize(n) === q));
  if (exact) return exact;
  return EXERCISES.find((e) =>
    [e.name, ...e.aliases].some((n) => {
      const name = normalize(n);
      return q.includes(name) || name.includes(q);
    }),
  );
}
