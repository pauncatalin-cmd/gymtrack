import assert from 'node:assert/strict';
import test from 'node:test';
import {estimateEnergy, latestWeight, sessionHighlights, weeklyStats} from './fitness.js';

test('energy subtracts resting calories and uses separate time for strength and treadmill', () => {
  assert.deepEqual(estimateEnergy({bodyKg: 80, duration: 2400, strength: true, cardio: [{mode: 'brisk', minutes: 10}]}), {
    energy: {kcal: 158, bodyKg: 80, strengthSeconds: 1800, cardioSeconds: 600, method: 'met-active-v1'},
  });
  assert.equal(estimateEnergy({bodyKg: 80, duration: 2400, strength: false, cardio: [{mode: 'brisk', minutes: 10}]}).energy.kcal, 53);
  assert.equal(estimateEnergy({bodyKg: 80, duration: 2400, strength: true, cardio: [{mode: '', minutes: 10}]}).energy, undefined);
  assert.equal(estimateEnergy({bodyKg: 80, duration: 500, strength: true, cardio: [{mode: 'brisk', minutes: 10}]}).energy, undefined);
  assert.equal(estimateEnergy({duration: 2400, strength: true, cardio: []}).energy, undefined);
});

test('weekly totals start on Monday and count only sessions with estimates towards calories', () => {
  const history = [
    {date: '03.05.2026', energy: {kcal: 20}},
    {date: '04.05.2026', energy: {kcal: 130}},
    {date: '05.05.2026'},
    {date: '07.05.2026', energy: {kcal: 25}},
  ];
  assert.deepEqual(weeklyStats(history, new Date(2026, 4, 6)), {workouts: 2, estimates: 1, kcal: 130});
});

test('latest weight follows the measurement date, then the save time', () => {
  const log = [{date: '2026-04-03', kg: 78, recordedAt: 5},
    {date: '2026-04-02', kg: 80, recordedAt: 10}, {date: '2026-04-03', kg: 79, recordedAt: 15}];
  assert.equal(latestWeight(log, '2026-04-02').kg, 80);
  assert.equal(latestWeight(log, '2026-04-03').kg, 79);
});

test('session comparisons use the same program and records respect recovered performances', () => {
  const workout = (date, programName, kg, reps) => ({
    date, programName, exercises: [{name: 'Presă', sets: [{kg, reps, done: true}]}],
  });
  const earlier = workout('03.04.2026', 'Full Body', 50, 8);
  const other = workout('05.04.2026', 'Upper', 45, 12);
  const today = workout('06.04.2026', 'Full Body', 50, 10);
  assert.deepEqual(sessionHighlights(today, [earlier, other])[0], {
    name: 'Presă', current: {kg: 50, reps: 10}, previous: {date: new Date(2026, 3, 3), kg: 50, reps: 8}, record: true,
  });
  const captured = [{name: 'Presă', first: {kg: 40, repetitions: 10}, last: {kg: 55, repetitions: 8}}];
  assert.equal(sessionHighlights(today, [earlier, other], captured)[0].record, false);
});
