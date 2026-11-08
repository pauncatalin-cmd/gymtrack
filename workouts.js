export const MACHINE_DEFAULTS = {sets: 5, weight: '50'};
export const MACHINE_DEFAULTS_VERSION = 1;

export function machineProgramUpdate(data) {
  if (data.activeStart || Object.keys(data.draft).length) return null;
  const previous = [];
  const programs = data.programs.map(program => {
    if (program.machineDefaults === MACHINE_DEFAULTS_VERSION) return program;
    const exercises = program.exercises.map((exercise, index) => {
      if (exercise.type === 'cardio') return exercise;
      if (exercise.sets !== MACHINE_DEFAULTS.sets || exercise.weight !== MACHINE_DEFAULTS.weight) {
        previous.push({programId: program.id, index, name: exercise.name, sets: exercise.sets, weight: exercise.weight});
      }
      return {...exercise, ...MACHINE_DEFAULTS};
    });
    return {...program, exercises, machineDefaults: MACHINE_DEFAULTS_VERSION};
  });
  if (programs.every((program, index) => program === data.programs[index])) return null;
  const archive = previous.length ? [...data.archive, {key: 'machine-prescriptions-before-v14', previous}] : data.archive;
  return {programs, archive};
}

export function workoutDate(workout) {
  const value = String(workout?.date ?? '').trim();
  const local = /^(\d{1,2})[./-]\s*(\d{1,2})[./-]\s*(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (local) return new Date(+local[3], +local[2] - 1, +local[1]);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  return workout?.timestamp ? new Date(workout.timestamp) : null;
}

export function localDay(date) {
  if (!date || !Number.isFinite(date.getTime())) return '';
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

function chronological(a, b) {
  return (workoutDate(a)?.getTime() ?? 0) - (workoutDate(b)?.getTime() ?? 0) ||
    (a.timestamp ?? 0) - (b.timestamp ?? 0);
}

export function programLabel(workout) {
  return typeof workout.programName === 'string' && workout.programName.trim() ?
    workout.programName : 'Program nespecificat';
}

export function filterHistory(history, {program, from, to}) {
  return history.map((workout, index) => ({workout, index})).filter(({workout}) => {
    if (program && programLabel(workout) !== program) return false;
    if (!from && !to) return true;
    const day = localDay(workoutDate(workout));
    return day && (!from || day >= from) && (!to || day <= to);
  }).sort((a, b) => chronological(b.workout, a.workout) || b.index - a.index);
}

export const setNumber = value => Number(String(value ?? '').trim().replace(',', '.'));

function performance(set) {
  if (!set?.done) return null;
  const kg = setNumber(set.kg);
  const reps = setNumber(set.reps);
  return Number.isFinite(kg) && Number.isFinite(reps) && kg > 0 && reps > 0 ? {kg, reps} : null;
}

export function betterSet(best, candidate) {
  if (!candidate) return best;
  return !best || candidate.kg > best.kg ||
    (candidate.kg === best.kg && candidate.reps > best.reps) ? candidate : best;
}

export function bestSet(exercise) {
  return (exercise?.sets ?? []).reduce((best, set) => betterSet(best, performance(set)), null);
}

export function exerciseTimeline(history, name) {
  return [...history].sort(chronological).flatMap(workout => {
    const best = (workout.exercises ?? []).filter(exercise => exercise.name === name)
      .reduce((record, exercise) => betterSet(record, bestSet(exercise)), null);
    return best ? [{date: workoutDate(workout), ...best}] : [];
  });
}

export function prefillDraft(draft, program, history) {
  const sessions = history.filter(workout => {
    if (workout.programId) return workout.programId === program.id;
    return !workout.programName || workout.programName === program.name;
  }).sort(chronological).reverse();
  const loggedExercises = sessions.flatMap(workout => workout.exercises ?? []);
  let count = 0;
  for (const [index, exercise] of program.exercises.entries()) {
    if (exercise.type === 'cardio') continue;
    const previous = loggedExercises.find(item => item.name === exercise.name && bestSet(item));
    if (!previous) continue;
    for (const [setIndex, set] of previous.sets.slice(0, exercise.sets).entries()) {
      const values = performance(set);
      if (!values) continue;
      const current = draft[index]?.sets[setIndex];
      const missingWeight = String(current?.kg ?? '').trim() === '';
      const missingReps = String(current?.reps ?? '').trim() === '';
      if (current?.done || (!missingWeight && !missingReps)) continue;
      draft[index] ??= {sets: [], done: false, later: false};
      draft[index].sets[setIndex] = {
        ...current,
        kg: missingWeight ? String(values.kg) : current.kg,
        reps: missingReps ? String(values.reps) : current.reps,
        suggested: true,
      };
      count++;
    }
  }
  return count;
}

export function loggedSet(set) {
  if (!set || (set.suggested && !set.done)) return null;
  return {
    kg: setNumber(set.kg),
    reps: setNumber(set.reps),
    rir: set.rir === '' || set.rir == null ? '' : setNumber(set.rir),
    done: !!set.done,
  };
}
