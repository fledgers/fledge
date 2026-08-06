import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdvisorServiceError,
  buildAdvisorMessages,
  extractEsthaOutput,
  parseAdvisorOutput,
  validateAdvisorRequest,
} from './opportunity-advisor.js';

const FIRST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECOND_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const THIRD_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function comparisonJson() {
  return JSON.stringify({
    overview: 'Two useful options.',
    ranking_basis: 'The second option aligns more closely with the goal.',
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

test('cleans and limits conversational preference messages', () => {
  const preferenceMessages = Array.from(
    { length: 10 },
    (_, index) => `  Preference   ${index}  `,
  );
  const result = validateAdvisorRequest({
    opportunityIds: [FIRST_ID, SECOND_ID],
    preferenceMessages,
  });

  assert.deepEqual(
    result.preferenceMessages,
    preferenceMessages.slice(-8).map((message) => message.replace(/\s+/g, ' ').trim()),
  );
});

test('includes preference messages and comparative reasoning in the prompt', () => {
  const messages = buildAdvisorMessages({
    filters: { categories: ['Exchange'] },
    opportunities: [
      { id: FIRST_ID, title: 'First opportunity' },
      { id: SECOND_ID, title: 'Second opportunity' },
    ],
    preferenceMessages: [
      'I prefer a shorter programme.',
      'Cost matters more than location.',
    ],
    profile: null,
  });
  const prompt = JSON.parse(messages[1].content);

  assert.deepEqual(prompt.student_preference_messages, [
    'I prefer a shorter programme.',
    'Cost matters more than location.',
  ]);
  assert.match(messages[0].content, /why the first option ranks above/i);
  assert.match(messages[0].content, /most recent message/i);
});

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

test('normalizes common Estha ID fields and exact listing titles', () => {
  const output = JSON.stringify({
    recommendations: [
      {
        opportunityId: `  ${FIRST_ID.toUpperCase()}  `,
        rank: 3,
        fitScore: 70,
      },
      {
        opportunity_title: '  NATIONAL YOUTH FUND RESEARCH GRANT ',
        rank: 1,
        score: 90,
      },
      {
        opportunity: { id: THIRD_ID },
        rank: 2,
        fit_score: 80,
      },
    ],
  });
  const result = parseAdvisorOutput(output, [
    { id: FIRST_ID, title: 'A*STAR Research Internship Award (ARIA)' },
    { id: SECOND_ID, title: 'National Youth Fund Research Grant' },
    { id: THIRD_ID, title: 'A*STAR I2R Scientific Attachment' },
  ]);

  assert.deepEqual(
    result.recommendations.map((recommendation) => ({
      id: recommendation.opportunity_id,
      score: recommendation.fit_score,
    })),
    [
      { id: SECOND_ID, score: 90 },
      { id: THIRD_ID, score: 80 },
      { id: FIRST_ID, score: 70 },
    ],
  );
});

test('accepts recommendations keyed by opportunity ID', () => {
  const result = parseAdvisorOutput(
    JSON.stringify({
      recommendations: {
        [FIRST_ID]: { rank: 2, fit_score: 60 },
        [SECOND_ID]: { rank: 1, fit_score: 80 },
      },
    }),
    [FIRST_ID, SECOND_ID],
  );

  assert.deepEqual(
    result.recommendations.map(({ opportunity_id }) => opportunity_id),
    [SECOND_ID, FIRST_ID],
  );
});

test('normalizes percentage, fractional, and nested fit fields', () => {
  const result = parseAdvisorOutput(
    JSON.stringify({
      recommendations: [
        {
          opportunity_id: FIRST_ID,
          rank: 1,
          match_percentage: '82%',
          match_label: 'Strong match',
          fit_reason: 'Matches the selected interests.',
          workload: {
            level: 'Moderate',
            assessment: 'About six hours each week.',
          },
        },
        {
          opportunity_id: SECOND_ID,
          rank: 2,
          fit: {
            score: 0.74,
            label: 'Good fit',
            reason: 'Relevant to the stated goal.',
          },
        },
      ],
    }),
    [FIRST_ID, SECOND_ID],
  );

  assert.equal(result.recommendations[0].fit_score, 82);
  assert.equal(result.recommendations[0].fit_label, 'Strong match');
  assert.equal(
    result.recommendations[0].reason,
    'Matches the selected interests.',
  );
  assert.equal(result.recommendations[0].workload_level, 'Moderate');
  assert.equal(
    result.recommendations[0].workload_assessment,
    'About six hours each week.',
  );
  assert.equal(result.recommendations[1].fit_score, 74);
  assert.equal(result.recommendations[1].fit_label, 'Good fit');
});

test('distinguishes a missing fit score from a genuine zero score', () => {
  const result = parseAdvisorOutput(
    JSON.stringify({
      recommendations: [
        { opportunity_id: FIRST_ID, rank: 1 },
        { opportunity_id: SECOND_ID, rank: 2, fit_score: 0 },
      ],
    }),
    [FIRST_ID, SECOND_ID],
  );

  assert.equal(result.recommendations[0].fit_score, null);
  assert.equal(result.recommendations[1].fit_score, 0);
});

test('does not attach a title-only recommendation when titles are ambiguous', () => {
  assert.throws(
    () =>
      parseAdvisorOutput(
        JSON.stringify({
          recommendations: [
            { title: 'Same title', rank: 1 },
            { title: 'Same title', rank: 2 },
          ],
        }),
        [
          { id: FIRST_ID, title: 'Same title' },
          { id: SECOND_ID, title: 'Same title' },
        ],
      ),
    (error) =>
      error instanceof AdvisorServiceError &&
      error.code === 'estha_incomplete_comparison',
  );
});

test('classifies a prose-only completion as a retryable format error', () => {
  assert.throws(
    () => parseAdvisorOutput('Here is my comparison.', [FIRST_ID, SECOND_ID]),
    (error) =>
      error instanceof AdvisorServiceError &&
      error.code === 'estha_invalid_format',
  );
});
