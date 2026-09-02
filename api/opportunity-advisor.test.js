import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdvisorServiceError,
  buildAdvisorMessages,
  extractEsthaOutput,
  generateAdvisorAnalysis,
  parseAdvisorOutput,
  validateAdvisorPreferenceAlignment,
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

function costComparisonJson() {
  return JSON.stringify({
    overview: 'The options are ranked by disclosed cost.',
    ranking_basis: 'The first option has a stated S$1,145 fee, while the second does not disclose its cost.',
    preference_summary: 'The request for a cheap programme made cost the primary criterion.',
    recommendations: [
      {
        opportunity_id: FIRST_ID,
        rank: 1,
        fit_score: 90,
        fit_label: 'Strong fit',
        reason: 'Its disclosed S$1,145 fee is the clearest low-cost evidence.',
      },
      {
        opportunity_id: SECOND_ID,
        rank: 2,
        fit_score: 70,
        fit_label: 'Possible fit',
        reason: 'Its fee is not stated, so it cannot be confirmed as cheaper.',
      },
    ],
    general_advice: 'Verify the final payable fee before applying.',
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
  assert.match(messages[0].content, /fit_score in descending order/i);
  assert.match(messages[0].content, /Never assume that missing cost information means free or cheap/i);
});

test('keeps cost evidence while compacting opportunity records and output', () => {
  const longDescription = `Programme fee: S$1,250. ${'Course detail. '.repeat(300)}`;
  const messages = buildAdvisorMessages({
    filters: { categories: ['winter_programme'] },
    opportunities: [
      {
        id: FIRST_ID,
        title: 'Affordable Winter School',
        category: 'winter_programme',
        description: longDescription,
        eligible_majors: ['computer_science'],
        source_url: 'https://example.com/should-not-be-sent',
      },
      {
        id: SECOND_ID,
        title: 'Second Winter School',
        category: 'winter_programme',
        description: 'Programme fee is not stated.',
      },
    ],
    preferenceMessages: ['Rank the lowest-cost winter programmes first.'],
    profile: null,
  });
  const prompt = JSON.parse(messages[1].content);
  const outputShapeText = messages[0].content;

  assert.match(prompt.opportunities[0].description, /Programme fee: S\$1,250/);
  assert.ok(prompt.opportunities[0].description.length <= 360);
  assert.equal(prompt.opportunities[0].cost_evidence, 'Programme fee: S$1,250.');
  assert.match(prompt.opportunities[1].cost_evidence, /fee is not stated/i);
  assert.deepEqual(prompt.opportunities[0].eligible_majors, ['computer_science']);
  assert.equal(prompt.opportunities[0].source_url, undefined);
  assert.doesNotMatch(outputShapeText, /eligibility_checks/);
  assert.doesNotMatch(outputShapeText, /workload_assessment/);
});

test('reserves a short recovery attempt when the primary Estha call times out', async () => {
  const calls = [];
  const opportunities = [
    { id: FIRST_ID, title: 'Affordable Winter School' },
    { id: SECOND_ID, title: 'Unknown-cost Winter School' },
  ];
  const preferenceMessages = ['I want a cheap winter program.'];
  const messages = buildAdvisorMessages({
    filters: { categories: ['winter_programme'] },
    opportunities,
    preferenceMessages,
    profile: null,
  });
  const requestCompletion = async (requestMessages, timeoutMs) => {
    calls.push({ requestMessages, timeoutMs });

    if (calls.length === 1) {
      throw new AdvisorServiceError('Primary request timed out.', {
        status: 504,
        code: 'estha_timeout',
      });
    }

    return costComparisonJson();
  };

  const analysis = await generateAdvisorAnalysis({
    messages,
    opportunities,
    preferenceMessages,
    requestCompletion,
  });

  assert.equal(analysis.recommendations[0].opportunity_id, FIRST_ID);
  assert.deepEqual(calls.map(({ timeoutMs }) => timeoutMs), [42_000, 12_000]);
  assert.match(calls[1].requestMessages.at(-1).content, /cheap winter program/i);
});

test('uses the bounded recovery attempt for a preference-mismatched explanation', async () => {
  const calls = [];
  const opportunities = [
    { id: FIRST_ID, title: 'Affordable Winter School' },
    { id: SECOND_ID, title: 'Unknown-cost Winter School' },
  ];
  const preferenceMessages = ['I want a cheap winter program.'];
  const messages = buildAdvisorMessages({
    filters: { categories: ['winter_programme'] },
    opportunities,
    preferenceMessages,
    profile: null,
  });
  const requestCompletion = async (_requestMessages, timeoutMs) => {
    calls.push(timeoutMs);
    return calls.length === 1
      ? JSON.stringify({
          ranking_basis: 'The first option has stronger cultural immersion.',
          preference_summary: 'No preferences were provided.',
          recommendations: [
            { opportunity_id: FIRST_ID, rank: 1, fit_score: 90, reason: 'Strong language focus.' },
            { opportunity_id: SECOND_ID, rank: 2, fit_score: 70, reason: 'Broad course selection.' },
          ],
        })
      : costComparisonJson();
  };

  const analysis = await generateAdvisorAnalysis({
    messages,
    opportunities,
    preferenceMessages,
    requestCompletion,
  });

  assert.match(analysis.ranking_basis, /S\$1,145/);
  assert.deepEqual(calls, [42_000, 12_000]);
});

test('requires low-cost explanations to address cost on the ranking and cards', () => {
  const alignedAnalysis = {
    ranking_basis: 'The first option ranks highest because its stated fee is S$1,145, while the other listing does not disclose a cost.',
    preference_summary: 'The request for a low-cost programme made stated fees the primary criterion.',
    recommendations: [
      { reason: 'Its disclosed S$1,145 fee provides the clearest affordable option.' },
      { reason: 'Its fee is not stated, so it cannot be confirmed as lower cost.' },
    ],
  };

  assert.equal(
    validateAdvisorPreferenceAlignment(
      alignedAnalysis,
      ['I want a low cost winter programme.'],
    ),
    alignedAnalysis,
  );

  assert.throws(
    () => validateAdvisorPreferenceAlignment(
      {
        ranking_basis: 'The first option offers stronger cultural immersion.',
        preference_summary: 'No preferences were provided.',
        recommendations: [
          { reason: 'Strong language programme.' },
          { reason: 'Broad course offering.' },
        ],
      },
      ['I want a low cost winter programme.'],
    ),
    (error) =>
      error instanceof AdvisorServiceError
      && error.code === 'estha_preference_mismatch',
  );
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

test('parses recommendations whose ranks agree with their fit scores', () => {
  const result = parseAdvisorOutput(comparisonJson(), [FIRST_ID, SECOND_ID]);

  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations[0].opportunity_id, SECOND_ID);
  assert.equal(result.recommendations[0].rank, 1);
  assert.equal(result.recommendations[1].opportunity_id, FIRST_ID);
  assert.equal(result.recommendations[1].rank, 2);
  assert.equal(result.ranking_was_corrected, false);
});

test('corrects inconsistent model ranks using descending fit score', () => {
  const result = parseAdvisorOutput(
    JSON.stringify({
      ranking_basis: 'The short programme was originally placed first.',
      recommendations: [
        {
          opportunity_id: FIRST_ID,
          rank: 1,
          fit_score: 55,
          reason: 'Short and experiential.',
        },
        {
          opportunity_id: SECOND_ID,
          rank: 2,
          fit_score: 85,
          reason: 'Strong semester exchange.',
        },
        {
          opportunity_id: THIRD_ID,
          rank: 3,
          fit_score: 90,
          reason: 'Strongest overall fit.',
        },
      ],
    }),
    [
      { id: FIRST_ID, title: 'STEER India: Mumbai & Agra' },
      { id: SECOND_ID, title: 'University of New South Wales' },
      { id: THIRD_ID, title: 'Incoming Exchange Students' },
    ],
  );

  assert.deepEqual(
    result.recommendations.map(({ opportunity_id, rank, fit_score }) => ({
      opportunity_id,
      rank,
      fit_score,
    })),
    [
      { opportunity_id: THIRD_ID, rank: 1, fit_score: 90 },
      { opportunity_id: SECOND_ID, rank: 2, fit_score: 85 },
      { opportunity_id: FIRST_ID, rank: 3, fit_score: 55 },
    ],
  );
  assert.equal(result.ranking_was_corrected, true);
  assert.match(result.ranking_basis, /Incoming Exchange Students ranks first/);
  assert.match(result.ranking_basis, /90% fit score/);
});

test('uses model rank only to break equal fit scores', () => {
  const result = parseAdvisorOutput(
    JSON.stringify({
      ranking_basis: 'The second option wins the tie on stated preferences.',
      recommendations: [
        { opportunity_id: FIRST_ID, rank: 2, fit_score: 80 },
        { opportunity_id: SECOND_ID, rank: 1, fit_score: 80 },
      ],
    }),
    [FIRST_ID, SECOND_ID],
  );

  assert.deepEqual(
    result.recommendations.map(({ opportunity_id }) => opportunity_id),
    [SECOND_ID, FIRST_ID],
  );
  assert.equal(result.ranking_was_corrected, false);
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

  assert.equal(result.recommendations[0].opportunity_id, SECOND_ID);
  assert.equal(result.recommendations[0].fit_score, 0);
  assert.equal(result.recommendations[1].opportunity_id, FIRST_ID);
  assert.equal(result.recommendations[1].fit_score, null);
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
