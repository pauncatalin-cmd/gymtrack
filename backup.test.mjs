import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackup, createStorage, historyTotals, parseBackup, planImport} from './backup.js';

const defaults = [{id: 'full-body', name: 'Full Body', exercises: []}];
const localWorkout = {date: '12.08.2026', timestamp: Date.UTC(2026, 7, 12), done: 1, volume: 100};
const olderWorkout = {
  id: Date.UTC(2025, 3, 12),
  date: '12.04.2025',
  title: 'Upper',
  duration: 100,
  completedSets: 1,
  calories: 40,
  exercises: [{name: 'Presă', sets: [{kg: 30, reps: 10, done: true}]}],
};

function fixture(values = {}) {
  const entries = new Map(Object.entries(values));
  const storage = {
    get length() { return entries.size; },
    key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, raw) => entries.set(key, raw),
  };
  return {storage, store: createStorage(storage, defaults)};
}

test('reads both historical formats and migrates without modifying the original keys', () => {
  const draft = {0: {sets: [null, {kg: '30', reps: '10', rir: '2', done: true}]}};
  const programs = [...defaults, {id: 'upper', name: 'Upper', exercises: [{name: 'Presă', sets: 3}]}];
  const initial = {
    'fb-history': JSON.stringify([localWorkout]),
    'gymtrack-history': JSON.stringify([olderWorkout]),
    'fb-history-backup': JSON.stringify([{date: '01.01.2024'}]),
    'fb-draft': JSON.stringify(draft),
    'fb-active-start': '1750000000000',
    'kip-programs': JSON.stringify(programs),
    'kip-active-program': 'upper',
    'gymtrack-draft-upper': '{"0":{"note":"old draft"}}',
  };
  const {storage, store} = fixture(initial);
  const before = store.snapshot().data;
  assert.equal(storage.length, Object.keys(initial).length);
  assert.deepEqual(before.history[0], {
    ...olderWorkout, timestamp: olderWorkout.id, programName: 'Upper', exerciseCount: 1, done: 1,
  });
  assert.deepEqual(before.history[1], localWorkout);
  assert.deepEqual(before.draft, draft);
  assert.deepEqual(before.programs, programs);
  assert.equal(before.activeProgramId, 'upper');
  assert.equal(before.activeStart, 1750000000000);
  assert.deepEqual(before.archive.map(item => item.key), ['fb-history-backup', 'gymtrack-draft-upper']);
  store.update({history: before.history});
  assert.deepEqual(createStorage(storage, defaults).snapshot().data, before);
  for (const [key, raw] of Object.entries(initial)) assert.equal(storage.getItem(key), raw);
});

test('restores programs, the active program and a sparse draft on a fresh installation', () => {
  const source = fixture({'fb-history': JSON.stringify([localWorkout])}).store;
  const programs = [{...defaults[0], name: 'Full Body personalizat', exercises: [{name: 'Presă', sets: 4}]}];
  source.update({
    programs,
    draft: {0: {sets: [null, {kg: '42', reps: '8', done: true}]}},
    activeStart: 1750000000000,
  });
  const expected = source.snapshot().data;
  const incoming = parseBackup(JSON.stringify(createBackup(expected)));
  const {store} = fixture();
  const fresh = store.snapshot();
  store.update(planImport(fresh.data, incoming, defaults), fresh);
  assert.deepEqual(store.snapshot().data, expected);
});

test('merge is repeatable and preserves matching occurrences and edited versions', () => {
  const {store} = fixture({'fb-history': JSON.stringify([localWorkout])});
  const reordered = Object.fromEntries(Object.entries(localWorkout).reverse());
  const edited = {...localWorkout, volume: 120};
  const incoming = parseBackup(JSON.stringify([reordered, reordered, edited]));
  const result = planImport(store.snapshot().data, incoming, defaults);
  assert.equal(result.history.length, 3);
  assert.deepEqual(result.history.map(item => item.volume), [100, 100, 120]);
  assert.deepEqual(planImport(result, incoming, defaults), result);
});

test('legacy exports are supported and drafts without a program are archived', () => {
  const kip = parseBackup(JSON.stringify({
    app: 'KIP Training', version: 10, history: [localWorkout], draft: {0: {sets: []}}, activeStart: 1234,
  }));
  const gymtrack = parseBackup(JSON.stringify({version: 1, history: [olderWorkout], settings: {rir: 2}}));
  assert.deepEqual(kip.history, [localWorkout]);
  assert.equal(kip.archive[0].activeStart, 1234);
  assert.equal(kip.draft, undefined);
  assert.equal(gymtrack.history[0].calories, 40);
  assert.equal(gymtrack.archive[0].key, 'gymtrack-settings');
  assert.throws(() => parseBackup('{"format":"kip-training-backup","version":99}'), /Versiunea/);
  assert.throws(() => parseBackup('[{"date":"12.08.2026","exercises":[null]}]'), /format nevalid/);
});

test('conflicting program IDs are kept separately and existing drafts are protected', () => {
  const {store} = fixture({'fb-history': JSON.stringify([localWorkout])});
  const base = store.snapshot().data;
  const incoming = {...base, programs: [{...defaults[0], name: 'Import'}], activeStart: 12};
  const result = planImport(base, incoming, defaults);
  assert.equal(result.programs.length, 2);
  assert.equal(result.activeProgramId, result.programs[1].id);
  assert.deepEqual(planImport(result, incoming, defaults), result);
  assert.throws(() => planImport({...base, activeStart: 42}, incoming, defaults), /două antrenamente/);
});

test('failed writes and stale import plans leave saved state intact', () => {
  const {storage, store} = fixture({'fb-history': JSON.stringify([localWorkout])});
  const snapshot = store.snapshot();
  const setItem = storage.setItem;
  storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.throws(() => store.update({history: []}, snapshot), {name: 'QuotaExceededError'});
  assert.deepEqual(store.snapshot(), snapshot);
  storage.setItem = setItem;
  store.update({activeStart: 12});
  assert.throws(() => store.update({history: []}, snapshot), /schimbat/);
  assert.deepEqual(store.get('history'), [localWorkout]);
});

test('screenshot recovery preserves totals and exercise progress without adding imaginary sessions', () => {
  const incoming = parseBackup(JSON.stringify({
    app: 'KIP Training', version: 10,
    history: [{...localWorkout, duration: 3600}],
    recuperareDinCapturi: {
      antrenamenteInainteDeStergere: 4,
      timpTotalAfisat: '8 h',
      progresExercitii: [{
        exercitiu: 'Presă',
        prima: {kg: 20, repetari: 10},
        ultima: {kg: 30, repetari: 12},
      }],
    },
  }));
  const {store} = fixture();
  const initial = store.snapshot();
  const merged = planImport(initial.data, incoming, defaults);
  store.update(merged, initial);
  const restored = store.snapshot().data;
  assert.equal(restored.history.length, 1);
  assert.deepEqual(restored.recovery.exercises[0].last, {kg: 30, repetitions: 12});
  assert.deepEqual(planImport(restored, incoming, defaults), restored);
  assert.deepEqual(parseBackup(JSON.stringify(createBackup(restored))), restored);
  const dateOf = ({date}) => date.includes('.') ? new Date(date.split('.').reverse().join('-')) : new Date(date);
  const later = {date: '13.08.2026', duration: 1800};
  assert.deepEqual(historyTotals([...restored.history, later], restored.recovery, dateOf),
    {count: 5, seconds: 30600, summarizedCount: 3});
});

test('fitness preferences, measurements and calorie estimates survive export and repeatable import', () => {
  const weight = {date: '2026-08-12', kg: 80, recordedAt: localWorkout.timestamp};
  const energy = {kcal: 100, bodyKg: 80, strengthSeconds: 1800, cardioSeconds: 0, method: 'met-active-v1'};
  const {store} = fixture();
  store.update({weeklyGoal: 4, weightLog: [weight], history: [{...localWorkout, energy}]});
  const source = store.snapshot().data;
  const imported = parseBackup(JSON.stringify(createBackup(source)));
  assert.deepEqual(imported, source);
  const local = {...fixture().store.snapshot().data, weeklyGoal: 2};
  const merged = planImport(local, imported, defaults);
  assert.equal(merged.weeklyGoal, 2);
  assert.deepEqual(merged.weightLog, [weight]);
  assert.deepEqual(merged.history[0].energy, energy);
  assert.deepEqual(planImport(merged, imported, defaults), merged);
});
