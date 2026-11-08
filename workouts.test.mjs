import assert from 'node:assert/strict';
import test from 'node:test';
import {exerciseProgress, exerciseTimeline, filterHistory, loggedSet, machineProgramUpdate, prefillDraft} from './workouts.js';

const program = {id: 'full-body', name: 'Full Body', exercises: [
  {name: 'Bandă', type: 'cardio', minutes: 10},
  {name: 'Presă', sets: 3, weight: '40'},
]};
const entry = (date, programName, sets) => ({date, programName, exercises: [{name: 'Presă', sets}]});

test('machine update waits for an active workout and retains the previous settings for export', () => {
  const data = {programs: [program], archive: [], draft: {}, activeStart: 0};
  assert.equal(machineProgramUpdate({...data, activeStart: 1000}), null);
  assert.equal(machineProgramUpdate({...data, draft: {1: {sets: []}}}), null);
  const update = machineProgramUpdate(data);
  assert.deepEqual(update.programs[0].exercises, [program.exercises[0], {name: 'Presă', sets: 5, weight: '50'}]);
  assert.deepEqual(update.archive[0].previous[0], {
    programId: 'full-body', index: 1, name: 'Presă', sets: 3, weight: '40',
  });
  update.programs[0].exercises[1].sets = 4;
  assert.equal(machineProgramUpdate({...data, ...update}), null);
  assert.equal(data.programs[0].exercises[1].sets, 3);
});

test('history filters are inclusive and retain indices for editing the original entries', () => {
  const history = [
    entry('06.04.2026', 'Full Body', []),
    entry('2026-04-04', 'Upper', []),
    entry('03/04/2026', 'Full Body', []),
    entry('05.04.2026', undefined, []),
  ];
  const options = {program: 'Full Body', from: '2026-04-03', to: '2026-04-06'};
  assert.deepEqual(filterHistory(history, options).map(item => item.index), [0, 2]);
  assert.deepEqual(filterHistory(history, {...options, program: ''}).map(item => item.index), [0, 3, 1, 2]);
  assert.deepEqual(filterHistory(history, {...options, program: 'Program nespecificat'}).map(item => item.index), [3]);
});

test('prefill uses completed sets from the matching program and leaves entered values and RIR intact', () => {
  const draft = {1: {sets: [{kg: '47', rir: '2'}, {kg: '32', reps: '11', done: true}]}};
  const history = [
    entry('05.04.2026', 'Full Body', [{kg: '40,5', reps: 9, rir: 1, done: true}, {kg: 41, reps: 10, done: true}]),
    entry('06.04.2026', 'Full Body', [{kg: 100, reps: 10, done: false}]),
    entry('07.04.2026', 'Upper', [{kg: 90, reps: 5, done: true}]),
  ];
  assert.equal(prefillDraft(draft, program, history), 1);
  assert.deepEqual(draft[1].sets, [
    {kg: '47', reps: '9', rir: '2', suggested: true},
    {kg: '32', reps: '11', done: true},
  ]);
  assert.equal(prefillDraft(draft, program, history), 0);
  assert.equal(loggedSet(draft[1].sets[0]), null);
  assert.deepEqual(loggedSet({...draft[1].sets[0], done: true}), {kg: 47, reps: 9, rir: 2, done: true});
  assert.deepEqual(loggedSet({kg: '42,5', reps: '8', done: false}), {kg: 42.5, reps: 8, rir: '', done: false});
});

test('exercise timeline ranks valid completed sets and orders sessions by date', () => {
  const history = [
    entry('06.04.2026', 'Full Body', [{kg: 50, reps: 9, done: true}, {kg: 50, reps: 10, done: true}]),
    entry('05.04.2026', 'Full Body', [{kg: 45, reps: 11, done: true}, {kg: 100, reps: 10, done: false}]),
    entry('07.04.2026', 'Full Body', [null, {kg: 55, reps: 0, done: true}]),
  ];
  assert.deepEqual(exerciseTimeline(history, 'Presă').map(({kg, reps}) => [kg, reps]), [[45, 11], [50, 10]]);
});

test('recovered first and last performances are usable without exercise logs', () => {
  const recovery = {through: '2026-04-06', exercises: [{
    name: 'Presă', first: {kg: 30, repetitions: 14}, last: {kg: 50, repetitions: 12},
  }]};
  const old = [entry('05.04.2026', 'Full Body', []), entry('06.04.2026', 'Full Body', [])];
  const recovered = exerciseProgress(old, 'Presă', recovery);
  assert.equal(recovered.first, recovered.capturedFirst);
  assert.equal(recovered.last, recovered.capturedLast);
  assert.deepEqual(recovered.first, {kg: 30, reps: 14});
  assert.deepEqual(recovered.last, {kg: 50, reps: 12});
  assert.deepEqual(recovered.timeline, []);
  const later = entry('07.04.2026', 'Full Body', [{kg: 52, reps: 10, done: true}]);
  const updated = exerciseProgress([later, ...old], 'Presă', recovery);
  assert.deepEqual(updated.first, recovered.first);
  assert.deepEqual(updated.last, {date: new Date(2026, 3, 7), kg: 52, reps: 10});
  assert.equal(updated.record, updated.last);
});
