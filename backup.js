const STORAGE_KEY = 'kip-training-data';
const BACKUP_FORMAT = 'kip-training-backup';
const VERSION = 1;
const LEGACY_KEYS = [
  'fb-history', 'fb-history-backup', 'fb-draft', 'fb-active-start',
  'kip-programs', 'kip-active-program', 'gymtrack-history', 'gymtrack-settings',
];

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string';
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const isTimestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const optional = (value, check) => value == null || check(value);
const isSetValue = value => value == null || isText(value) || isNumber(value);
const isSet = value => isObject(value) &&
  ['kg', 'reps', 'rir'].every(key => isSetValue(value[key])) &&
  ['done', 'suggested'].every(key => optional(value[key], flag => typeof flag === 'boolean'));
const isSets = value => Array.isArray(value) && value.every(set => set === null || isSet(set));

function isHistory(value) {
  return Array.isArray(value) && value.every(workout => isObject(workout) &&
    optional(workout.date, isText) && (isText(workout.date) || isTimestamp(workout.timestamp)) &&
    ['duration', 'volume', 'done', 'exerciseCount'].every(key => optional(workout[key], isNumber)) &&
    optional(workout.timestamp, isTimestamp) &&
    optional(workout.exercises, exercises => Array.isArray(exercises) &&
      exercises.every(exercise => isObject(exercise) && isText(exercise.name) && optional(exercise.sets, isSets))));
}

function isDraft(value) {
  return isObject(value) && Object.entries(value).every(([index, exercise]) =>
    /^(0|[1-9]\d*)$/.test(index) && isObject(exercise) && isSets(exercise.sets) &&
    ['done', 'later'].every(key => optional(exercise[key], flag => typeof flag === 'boolean')));
}

function isPrograms(value) {
  return Array.isArray(value) && value.length > 0 &&
    new Set(value.map(program => program?.id)).size === value.length &&
    value.every(program => isObject(program) && isText(program.id) && program.id &&
      isText(program.name) && Array.isArray(program.exercises) &&
      program.exercises.every(exercise => isObject(exercise) && isText(exercise.name) &&
        ['type', 'muscle', 'image', 'sub', 'reps', 'weight', 'guide'].every(key => optional(exercise[key], isText)) &&
        ['sets', 'minutes', 'rest'].every(key => optional(exercise[key], count => isNumber(count) && count >= 0)) &&
        optional(exercise.image, path => /^assets\/[\w.-]+$/.test(path))));
}

function isState(data) {
  return isObject(data) && isHistory(data.history) && isDraft(data.draft) &&
    isTimestamp(data.activeStart) && isPrograms(data.programs) &&
    data.programs.some(program => program.id === data.activeProgramId) &&
    Array.isArray(data.archive) && data.archive.every(isObject) &&
    optional(data.recovery, isRecovery);
}

const isPositiveInteger = value => Number.isSafeInteger(value) && value > 0;
const isPerformance = value => isObject(value) && isNumber(value.kg) && value.kg > 0 &&
  isPositiveInteger(value.repetitions);

function isRecovery(value) {
  return isObject(value) && isText(value.through) && /^\d{4}-\d{2}-\d{2}$/.test(value.through) &&
    isPositiveInteger(value.workoutCount) && isPositiveInteger(value.totalMinutes) &&
    optional(value.frequency, isText) && optional(value.month, month => isObject(month) &&
      isPositiveInteger(month.workoutCount) && isPositiveInteger(month.minutes)) &&
    Array.isArray(value.exercises) &&
    value.exercises.every(exercise => isObject(exercise) && isText(exercise.name) &&
      isPerformance(exercise.first) && isPerformance(exercise.last));
}

function displayMinutes(value) {
  const duration = /^(\d+) h(?: (\d+) min)?$/.exec(value);
  return duration ? Number(duration[1]) * 60 + Number(duration[2] ?? 0) : 0;
}

function readScreenshotSummary(source, history) {
  if (!isObject(source)) throw new Error('Rezumatul din capturi are un format nevalid.');
  const day = new Date(history.reduce((latest, workout) => Math.max(latest, historyTime(workout)), 0));
  const isoDay = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0')].join('-');
  const recovery = {
    through: source.dataPanaLa ?? isoDay,
    workoutCount: source.antrenamenteInainteDeStergere,
    totalMinutes: source.timpTotalMinute ?? displayMinutes(source.timpTotalAfisat),
    frequency: source.frecventaAfisataUltimele30Zile,
    exercises: Array.isArray(source.progresExercitii) ? source.progresExercitii.map(exercise => ({
      name: exercise?.exercitiu,
      first: {kg: exercise?.prima?.kg, repetitions: exercise?.prima?.repetari},
      last: {kg: exercise?.ultima?.kg, repetitions: exercise?.ultima?.repetari},
    })) : [],
  };
  const month = source.lunaCapturii ?? source.noiembrie2026;
  if (month) {
    recovery.month = {
      workoutCount: month.antrenamente,
      minutes: displayMinutes(month.timpAfisat),
    };
  }
  if (!history.length || !isRecovery(recovery)) throw new Error('Rezumatul din capturi are un format nevalid.');
  return recovery;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

const fingerprint = value => JSON.stringify(canonical(value));

// Match complete records and retain their multiplicity. A date or timestamp alone
// cannot distinguish two manually entered sessions or two edits of one session.
function mergeEntries(local, incoming) {
  const occurrences = new Map();
  for (const entry of local) {
    const key = fingerprint(entry);
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  const added = incoming.filter(entry => {
    const key = fingerprint(entry);
    const count = occurrences.get(key) ?? 0;
    if (count > 0) occurrences.set(key, count - 1);
    return count === 0;
  });
  return [...local, ...added];
}

function historyTime(workout) {
  const date = isText(workout.date) ? workout.date.trim() : '';
  const local = /^(\d{1,2})[./-]\s*(\d{1,2})[./-]\s*(\d{4})$/.exec(date);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  if (local) return new Date(+local[3], +local[2] - 1, +local[1]).getTime();
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
  return workout.timestamp ?? 0;
}

function mergeHistory(local, incoming) {
  const merged = mergeEntries(local, incoming);
  if (merged.length === local.length) return local;
  return merged.sort((a, b) => historyTime(a) - historyTime(b) || (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

function migrateOldHistory(history) {
  if (!isHistory(history)) throw new Error('Istoricul din backup are un format nevalid.');
  return history.map(workout => {
    if (!Object.hasOwn(workout, 'completedSets') || Object.hasOwn(workout, 'done')) return workout;
    const exercises = workout.exercises ?? [];
    return {
      ...workout,
      timestamp: workout.timestamp ?? (isTimestamp(workout.id) ? workout.id : 0),
      programName: workout.programName ?? workout.title,
      exerciseCount: exercises.length,
      done: exercises.filter(exercise => exercise.sets?.some(set => set?.done)).length,
    };
  });
}

function readLegacy(storage, defaults) {
  const keys = new Set(LEGACY_KEYS);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith('gymtrack-draft-')) keys.add(key);
  }
  const values = new Map([...keys].map(key => [key, storage.getItem(key)]));
  const archive = [];
  function read(key, fallback, check) {
    const raw = values.get(key);
    if (raw === null) return fallback;
    try {
      const value = JSON.parse(raw);
      if (check(value)) return value;
    } catch {
      // Keep unreadable legacy values in the export for manual recovery.
    }
    archive.push({key, raw});
    return fallback;
  }

  const history = read('fb-history', [], isHistory);
  const olderHistory = read('gymtrack-history', [], isHistory);
  const programs = read('kip-programs', defaults, isPrograms);
  const selected = values.get('kip-active-program');
  for (const [key, raw] of values) {
    if (raw !== null && (key === 'fb-history-backup' || key === 'gymtrack-settings' || key.startsWith('gymtrack-draft-'))) {
      archive.push({key, raw});
    }
  }
  return {
    history: mergeHistory(migrateOldHistory(history), migrateOldHistory(olderHistory)),
    programs,
    activeProgramId: programs.some(program => program.id === selected) ? selected : programs[0].id,
    draft: read('fb-draft', {}, isDraft),
    activeStart: read('fb-active-start', 0, isTimestamp),
    archive,
  };
}

export function createStorage(storage, defaults) {
  let cachedRaw;
  let cachedData;
  function read() {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return {raw, data: readLegacy(storage, defaults)};
    if (raw !== cachedRaw) {
      const record = JSON.parse(raw);
      if (record?.version !== VERSION || !isState(record.data)) {
        throw new Error('Datele locale KIP Training au un format necunoscut.');
      }
      cachedData = record.data;
      cachedRaw = raw;
    }
    return {raw, data: cachedData};
  }
  return {
    get: key => structuredClone(read().data[key]),
    activeProgram() {
      const {programs, activeProgramId} = read().data;
      return structuredClone(programs.find(program => program.id === activeProgramId));
    },
    snapshot: () => structuredClone(read()),
    update(fields, expected) {
      const current = read();
      if (expected && (current.raw !== expected.raw ||
          (current.raw === null && fingerprint(current.data) !== fingerprint(expected.data)))) {
        throw new Error('Datele s-au schimbat între timp. Redeschide aplicația și încearcă din nou.');
      }
      const data = {...current.data, ...fields};
      // A single setItem commits the complete change. The source keys remain intact.
      const raw = JSON.stringify({version: VERSION, data});
      const persisted = JSON.parse(raw).data;
      if (!isState(persisted)) throw new Error('Datele nu au putut fi salvate. Verifică valorile introduse.');
      storage.setItem(STORAGE_KEY, raw);
      cachedRaw = raw;
      cachedData = persisted;
    },
  };
}

export function createBackup(data) {
  return {format: BACKUP_FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data};
}

export function parseBackup(text) {
  const file = JSON.parse(text);
  if (file?.format === BACKUP_FORMAT) {
    if (file.version !== VERSION) throw new Error('Versiunea backupului nu este compatibilă.');
    if (!isState(file.data)) throw new Error('Backupul conține date nevalide.');
    return file.data;
  }

  if (Array.isArray(file)) return {history: migrateOldHistory(file), archive: []};
  const isKip = file?.app === 'KIP Training' && file.version === 10;
  const isGymTrack = file?.version === 1 && Object.hasOwn(file, 'settings') && isObject(file.settings);
  if (!isKip && !isGymTrack) throw new Error('Fișierul nu este un backup GymTrack compatibil.');
  const archive = [];
  if (isGymTrack) archive.push({key: 'gymtrack-settings', raw: JSON.stringify(file.settings)});
  if (isKip && (file.activeStart || Object.keys(file.draft ?? {}).length)) {
    // Version 10 did not export the program that gives the draft indices meaning.
    archive.push({key: 'kip-backup-v10-draft', draft: file.draft, activeStart: file.activeStart});
  }
  const history = migrateOldHistory(file.history);
  const data = {history, archive};
  if (isKip && Object.hasOwn(file, 'recuperareDinCapturi')) {
    data.recovery = readScreenshotSummary(file.recuperareDinCapturi, history);
  }
  return data;
}

export function planImport(local, incoming, defaults) {
  const hasLocalDraft = local.activeStart > 0 || Object.keys(local.draft).length > 0;
  const hasIncomingDraft = !!incoming.activeStart || Object.keys(incoming.draft ?? {}).length > 0;
  const history = mergeHistory(local.history, incoming.history);
  const archive = mergeEntries(local.archive, incoming.archive);
  const recovery = local.recovery ?? incoming.recovery;
  if (local.recovery && incoming.recovery && fingerprint(local.recovery) !== fingerprint(incoming.recovery)) {
    throw new Error('Acest backup conține un alt rezumat istoric decât cel salvat deja.');
  }
  const recoveryFields = recovery ? {recovery} : {};
  if (incoming.programs && !hasLocalDraft && !local.history.length &&
      fingerprint(local.programs) === fingerprint(defaults)) {
    return {...incoming, history, archive, ...recoveryFields};
  }

  const programs = [...local.programs];
  const incomingIds = new Set(incoming.programs?.map(program => program.id));
  let importedActiveId;
  for (const program of incoming.programs ?? []) {
    const {id, ...details} = program;
    let targetId = id;
    let suffix = 1;
    for (;;) {
      const existing = programs.find(item => item.id === targetId);
      if (!existing) {
        programs.push({...program, id: targetId});
        break;
      }
      const {id: existingId, ...existingDetails} = existing;
      if (fingerprint(existingDetails) === fingerprint(details)) break;
      do {
        targetId = `${id}-import-${suffix++}`;
      } while (incomingIds.has(targetId));
    }
    if (id === incoming.activeProgramId) importedActiveId = targetId;
  }

  let draft = local.draft;
  let activeStart = local.activeStart;
  let activeProgramId = local.activeProgramId;
  if (hasIncomingDraft && !hasLocalDraft) {
    draft = incoming.draft;
    activeStart = incoming.activeStart;
    activeProgramId = importedActiveId;
  } else if (hasIncomingDraft && (activeStart !== incoming.activeStart ||
      activeProgramId !== importedActiveId || fingerprint(draft) !== fingerprint(incoming.draft))) {
    throw new Error('Există două antrenamente în curs. Salvează antrenamentul de pe acest dispozitiv, apoi importă din nou.');
  }

  return {history, programs, activeProgramId, draft, activeStart, archive, ...recoveryFields};
}

export function historyTotals(history, recovery, dateOf) {
  const sum = workouts => workouts.reduce((seconds, workout) => seconds + Number(workout.duration || 0), 0);
  if (!recovery) return {count: history.length, seconds: sum(history), summarizedCount: 0};
  const cutoff = dateOf({date: recovery.through});
  cutoff.setHours(23, 59, 59, 999);
  const earlier = history.filter(workout => {
    const date = dateOf(workout);
    return date && date <= cutoff;
  });
  const summarizedCount = Math.max(0, recovery.workoutCount - earlier.length);
  const summarizedSeconds = Math.max(0, recovery.totalMinutes * 60 - sum(earlier));
  return {
    count: history.length + summarizedCount,
    seconds: sum(history) + summarizedSeconds,
    summarizedCount,
  };
}
