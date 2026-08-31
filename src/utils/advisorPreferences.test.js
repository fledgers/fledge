import assert from 'node:assert/strict';
import test from 'node:test';
import { appendAdvisorPreference } from './advisorPreferences.js';

test('includes an unsubmitted ranking requirement before comparison', () => {
  assert.deepEqual(
    appendAdvisorPreference([], '  I want a low cost winter programme.  '),
    ['I want a low cost winter programme.'],
  );
});

test('keeps recent requirements when the draft is empty', () => {
  assert.deepEqual(
    appendAdvisorPreference(['Low cost matters.', 'Prefer December.'], ''),
    ['Low cost matters.', 'Prefer December.'],
  );
});

test('limits the conversation to the latest requirements', () => {
  assert.deepEqual(
    appendAdvisorPreference(['First', 'Second'], 'Third', 2),
    ['Second', 'Third'],
  );
});
