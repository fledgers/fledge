import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdvisorServiceError,
  extractEsthaOutput,
  parseAdvisorOutput,
} from './opportunity-advisor.js';

const FIRST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECOND_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function comparisonJson() {
  return JSON.stringify({
    overview: 'Two useful options.',
    recommendations: [
      {
        opportunity_id: FIRST_ID,
        rank: 2,
        fit_score: 70,
        fit_label: 'Good fit',
        reason: 'Useful experience.',
      },
      {
        opportunity_id: SECOND_ID,
        rank: 1,
        fit_score: 90,
        fit_label: 'Strong fit',
        reason: 'Best aligned.',
      },
    ],
    general_advice: 'Check both deadlines.',
  });
}

test('extracts a direct OpenAI-compatible Estha completion', () => {
  const output = extractEsthaOutput({
    choices: [{ message: { content: comparisonJson() } }],
  });

  assert.equal(output, comparisonJson());
});

test('prefers a nested completion over an envelope status message', () => {
  const output = extractEsthaOutput({
    message: 'Request successful',
    data: {
      choices: [{ message: { content: comparisonJson() } }],
    },
  });

  assert.equal(output, comparisonJson());
});

test('extracts array-based content from a nested output wrapper', () => {
  const output = extractEsthaOutput({
    message: 'Request successful',
    data: {
      output: [
        { content: [{ text: comparisonJson() }] },
      ],
    },
  });

  assert.equal(output, comparisonJson());
});

test('accepts an already structured advisor payload', () => {
  const payload = JSON.parse(comparisonJson());

  assert.equal(extractEsthaOutput({ data: payload }), payload);
});

test('parses and orders valid recommendations by model-supplied rank', () => {
  const result = parseAdvisorOutput(comparisonJson(), [FIRST_ID, SECOND_ID]);

  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations[0].opportunity_id, SECOND_ID);
  assert.equal(result.recommendations[0].rank, 1);
  assert.equal(result.recommendations[1].opportunity_id, FIRST_ID);
  assert.equal(result.recommendations[1].rank, 2);
});

test('classifies a prose-only completion as a retryable format error', () => {
  assert.throws(
    () => parseAdvisorOutput('Here is my comparison.', [FIRST_ID, SECOND_ID]),
    (error) =>
      error instanceof AdvisorServiceError &&
      error.code === 'estha_invalid_format',
  );
});
