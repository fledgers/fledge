import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOpportunityReport } from './opportunityReports.js';

const opportunityId = '11111111-1111-4111-8111-111111111111';

test('accepts a structured report without optional details', () => {
  assert.equal(
    validateOpportunityReport({
      opportunityId,
      reason: 'already_expired',
      details: '',
    }),
    null
  );
});

test('requires details when the student selects other', () => {
  assert.equal(
    validateOpportunityReport({
      opportunityId,
      reason: 'other',
      details: '   ',
    }),
    'Add a short explanation for the issue.'
  );
});

test('rejects fake opportunity IDs that are not database UUIDs', () => {
  assert.equal(
    validateOpportunityReport({
      opportunityId: 1,
      reason: 'incorrect_information',
      details: '',
    }),
    'This opportunity is not connected to the live database yet.'
  );
});

test('limits student-written report details to 1000 characters', () => {
  assert.equal(
    validateOpportunityReport({
      opportunityId,
      reason: 'suspicious_or_scam',
      details: 'a'.repeat(1001),
    }),
    'Report details must be 1,000 characters or fewer.'
  );
});

