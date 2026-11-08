import {bestSet, betterSet, exerciseTimeline, localDay, workoutDate} from './workouts.js?v=16';

export const DEFAULT_WEEKLY_GOAL = 3;
export const MAX_WEEKLY_GOAL = 21;

// Adult Compendium 02054, 17352, 17358 and 12020.
const STRENGTH_MET = 3.5;
export const CARDIO_MODES = {
  walk: {label: 'Bandă · mers 4–4,7 km/h', met: 3.5},
  brisk: {label: 'Bandă · mers 5,6–6,3 km/h', met: 4.8},
  jog: {label: 'Alergare ușoară', met: 7.5},
};

export function latestWeight(entries, day) {
  return entries.filter(entry => entry.date <= day)
    .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt - a.recordedAt)[0];
}

export function weeklyStats(history, today) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const first = localDay(start);
  const last = localDay(today);
  const workouts = history.filter(workout => {
    const day = localDay(workoutDate(workout));
    return day >= first && day <= last;
  });
  const estimates = workouts.flatMap(workout => workout.energy ? [workout.energy.kcal] : []);
  return {workouts: workouts.length, estimates: estimates.length, kcal: estimates.reduce((sum, kcal) => sum + kcal, 0)};
}

export function estimateEnergy({bodyKg, duration, strength, cardio}) {
  if (!Number.isFinite(bodyKg) || bodyKg <= 0) return {reason: 'Adaugă greutatea corporală în Setări pentru estimare.'};
  if (cardio.some(segment => !Number.isFinite(segment.minutes) || segment.minutes <= 0 ||
      !Object.hasOwn(CARDIO_MODES, segment.mode))) {
    return {reason: 'Completează minutele și tipul de cardio pentru o estimare.'};
  }
  const cardioSeconds = Math.round(cardio.reduce((sum, segment) => sum + segment.minutes * 60, 0));
  if (cardioSeconds > duration) return {reason: 'Minutele de cardio depășesc durata cronometrată.'};
  const strengthSeconds = strength ? duration - cardioSeconds : 0;
  if (!strengthSeconds && !cardioSeconds) return {reason: 'Estimez caloriile pentru sesiunile cu activitate înregistrată.'};
  const activeKcal = (met, seconds) => (met - 1) * 3.5 * bodyKg * (seconds / 60) / 200;
  const kcal = Math.round(activeKcal(STRENGTH_MET, strengthSeconds) + cardio.reduce((sum, segment) =>
    sum + activeKcal(CARDIO_MODES[segment.mode].met, segment.minutes * 60), 0));
  return {energy: {kcal, bodyKg, strengthSeconds, cardioSeconds, method: 'met-active-v1'}};
}

export function sessionHighlights(workout, history, recoveredExercises = []) {
  const ordered = history.filter(item => localDay(workoutDate(item)) <= localDay(workoutDate(workout)))
    .sort((a, b) => localDay(workoutDate(a)).localeCompare(localDay(workoutDate(b))) ||
      (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const sameProgram = ordered.filter(item => item.programId ?
    item.programId === workout.programId : item.programName === workout.programName);
  return workout.exercises.flatMap(exercise => {
    const current = bestSet(exercise);
    if (!current) return [];
    const previous = exerciseTimeline(sameProgram, exercise.name).at(-1);
    const recovered = recoveredExercises.find(item => item.name === exercise.name);
    const capturedBest = recovered ? [recovered.first, recovered.last]
      .map(item => ({kg: item.kg, reps: item.repetitions})).reduce(betterSet, null) : null;
    const record = exerciseTimeline(ordered, exercise.name).reduce(betterSet, capturedBest);
    return [{name: exercise.name, current, previous, record: !!record && betterSet(record, current) === current}];
  });
}
