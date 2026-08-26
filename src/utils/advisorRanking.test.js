import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAdvisorRecommendationsById,
  rankOpportunitiesWithAdvisor,
} from './advisorRanking.js';

const opportunities = [
  { id: 'deadline-first', title: 'Deadline first' },
  { id: 'ai-first', title: 'AI first' },
  { id: 'ai-second', title: 'AI second' },
  { id: 'not-compared', title: 'Not compared' },
];

const analysis = {
  recommendations: [
    { opportunity_id: 'ai-first', rank: 1, fit_score: 92 },
    { opportunity_id: 'ai-second', rank: 2, fit_score: 81 },
    { opportunity_id: 'deadline-first', rank: 3, fit_score: 70 },
  ],
};

test('moves AI-ranked opportunities into rank order and keeps other results after them', () => {
  assert.deepEqual(
    rankOpportunitiesWithAdvisor(opportunities, analysis).map(({ id }) => id),
    ['ai-first', 'ai-second', 'deadline-first', 'not-compared']
  );
});

test('maps AI recommendations to their original opportunity IDs', () => {
  const recommendationsById = getAdvisorRecommendationsById(analysis);

  assert.equal(recommendationsById.get('ai-first').fit_score, 92);
  assert.equal(recommendationsById.has('not-compared'), false);
});

test('preserves the existing opportunity order without a valid AI analysis', () => {
  assert.deepEqual(
    rankOpportunitiesWithAdvisor(opportunities, null),
    opportunities
  );
});
