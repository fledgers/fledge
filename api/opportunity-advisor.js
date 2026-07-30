import { createClient } from '@supabase/supabase-js';

const DEFAULT_ESTHA_API_URL =
  'https://studio.estha.ai/api/v1/open/chat/completions';
const MAX_OPPORTUNITIES = 8;
const MAX_FILTER_TEXT_LENGTH = 200;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendJson(response, status, payload) {
  response.status(status).json(payload);
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function readRequestBody(request) {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body);
  }

  return request.body || {};
}

function cleanText(value, maxLength = 2_000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanStringArray(value, limit = 6, itemLength = 400) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(String(item ?? ''), itemLength))
    .filter(Boolean)
    .slice(0, limit);
}

function cleanFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return {};
  }

  return {
    search: cleanText(filters.search, MAX_FILTER_TEXT_LENGTH),
    categories: cleanStringArray(filters.categories, 12, 80),
    major: cleanText(filters.major, 100),
    year: cleanText(filters.year, 40),
    sortBy: cleanText(filters.sortBy, 80),
  };
}

export function validateAdvisorRequest(body) {
  const opportunityIds = Array.isArray(body?.opportunityIds)
    ? [...new Set(body.opportunityIds)]
    : [];

  if (opportunityIds.length < 2) {
    throw new Error('Select filters that return at least two opportunities.');
  }

  if (opportunityIds.length > MAX_OPPORTUNITIES) {
    throw new Error(
      `No more than ${MAX_OPPORTUNITIES} opportunities can be compared at once.`,
    );
  }

  if (
    opportunityIds.some(
      (opportunityId) =>
        typeof opportunityId !== 'string' ||
        !UUID_PATTERN.test(opportunityId),
    )
  ) {
    throw new Error('One or more opportunity IDs are invalid.');
  }

  return {
    opportunityIds,
    filters: cleanFilters(body?.filters),
  };
}

function toProfilePrompt(profile) {
  return {
    faculty: profile?.faculty || null,
    major: profile?.major || null,
    year_of_study: profile?.year_of_study || null,
    opportunity_interests: profile?.opportunity_interests || [],
    career_goals: profile?.career_goals || null,
    skills_experience: profile?.skills_experience || null,
    weekly_availability_hours:
      profile?.weekly_availability_hours ?? null,
    workload_preference: profile?.workload_preference || null,
    opportunity_budget_sgd: profile?.opportunity_budget_sgd ?? null,
    preferred_locations: profile?.preferred_locations || [],
    preferred_delivery_modes: profile?.preferred_delivery_modes || [],
    willing_to_travel: profile?.willing_to_travel ?? null,
  };
}

function toOpportunityPrompt(opportunity) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    category: opportunity.category,
    organisation: opportunity.organisation,
    eligibility: opportunity.eligibility,
    year_min: opportunity.year_min,
    year_max: opportunity.year_max,
    majors: opportunity.majors,
    location: opportunity.location,
    delivery_mode: opportunity.delivery_mode,
    deadline: opportunity.deadline,
    listing_expires_at: opportunity.listing_expires_at,
    source_url: opportunity.source_url,
    application_url: opportunity.application_url,
    source_priority: opportunity.source_priority,
  };
}

export function buildAdvisorMessages({
  profile,
  opportunities,
  filters,
}) {
  const outputShape = {
    overview: 'Short comparison overview',
    recommendations: [
      {
        opportunity_id: 'UUID copied exactly from the input',
        rank: 1,
        fit_score: 85,
        fit_label: 'Strong fit',
        reason: 'Why this option suits the student',
        pros: ['Specific advantage'],
        cons: ['Specific trade-off'],
        workload_level: 'Low, Moderate, High, or Unknown',
        workload_assessment: 'Workload estimate and its evidence',
        eligibility_checks: ['Eligibility item the student must verify'],
        questions_to_verify: ['Important unanswered question'],
      },
    ],
    general_advice: 'A short next-step recommendation',
  };

  return [
    {
      role: 'system',
      content: [
        'You are Fledge Opportunity Advisor for university students.',
        'Compare only the student profile and opportunity records supplied.',
        'Do not browse the web, claim to have read reviews, or invent facts.',
        'Treat filters as preferences, not proof of eligibility.',
        'State uncertainty when workload, eligibility, cost, or timing is not supplied.',
        'Do not infer sensitive personal characteristics.',
        'Rank every supplied opportunity from best to least suitable.',
        'Return valid JSON only, with no Markdown fences or commentary.',
        `Use this exact shape: ${JSON.stringify(outputShape)}`,
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        task:
          'Compare these filtered opportunities and recommend the best matches.',
        selected_filters: filters,
        student_profile: toProfilePrompt(profile),
        opportunities: opportunities.map(toOpportunityPrompt),
      }),
    },
  ];
}

export function extractEsthaOutput(payload) {
  const output =
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    payload?.message?.content ??
    payload?.message ??
    payload?.output_text ??
    payload?.output ??
    payload?.response;

  if (typeof output === 'string' && output.trim()) {
    return output.trim();
  }

  throw new Error('Estha returned an empty recommendation.');
}

function extractJsonObject(output) {
  const withoutFence = output
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Estha returned an invalid recommendation format.');
  }

  return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
}

export function parseAdvisorOutput(output, allowedOpportunityIds) {
  const parsed = extractJsonObject(output);
  const allowedIds = new Set(allowedOpportunityIds);
  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .filter((item) => allowedIds.has(item?.opportunity_id))
        .map((item, index) => ({
          opportunity_id: item.opportunity_id,
          rank: index + 1,
          fit_score: Math.max(
            0,
            Math.min(100, Number(item.fit_score) || 0),
          ),
          fit_label: cleanText(item.fit_label, 60) || 'Fit unclear',
          reason: cleanText(item.reason, 800),
          pros: cleanStringArray(item.pros),
          cons: cleanStringArray(item.cons),
          workload_level:
            cleanText(item.workload_level, 40) || 'Unknown',
          workload_assessment: cleanText(
            item.workload_assessment,
            600,
          ),
          eligibility_checks: cleanStringArray(
            item.eligibility_checks,
          ),
          questions_to_verify: cleanStringArray(
            item.questions_to_verify,
          ),
        }))
    : [];

  if (recommendations.length < 2) {
    throw new Error(
      'Estha did not return enough valid opportunities to compare.',
    );
  }

  return {
    overview: cleanText(parsed.overview, 1_000),
    recommendations,
    general_advice: cleanText(parsed.general_advice, 1_000),
  };
}

async function callEstha(messages) {
  const apiKey =
    process.env.ESTHA_OPPORTUNITY_API_KEY ||
    process.env.ESTHA_API_KEY;
  const apiUrl =
    process.env.ESTHA_OPPORTUNITY_API_URL ||
    process.env.ESTHA_API_URL ||
    DEFAULT_ESTHA_API_URL;
  const modelId =
    process.env.ESTHA_OPPORTUNITY_MODEL_ID ||
    process.env.ESTHA_MODEL_ID;

  if (!apiKey) {
    throw new Error('The Estha opportunity advisor is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(modelId ? { model: modelId } : {}),
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Estha opportunity advisor failed', {
        status: response.status,
        payload,
      });
      throw new Error('Estha could not compare the opportunities.');
    }

    return extractEsthaOutput(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return sendJson(response, 401, {
        error: 'Sign in before comparing opportunities.',
      });
    }

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabasePublishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      throw new Error('Supabase is not configured for the advisor.');
    }

    const { opportunityIds, filters } = validateAdvisorRequest(
      readRequestBody(request),
    );
    const supabase = createClient(
      supabaseUrl,
      supabasePublishableKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return sendJson(response, 401, {
        error: 'Your session has expired. Sign in again.',
      });
    }

    const [profileResult, opportunitiesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('active_opportunities')
        .select('*')
        .in('id', opportunityIds),
    ]);

    if (profileResult.error) {
      throw profileResult.error;
    }

    if (opportunitiesResult.error) {
      throw opportunitiesResult.error;
    }

    const opportunitiesById = new Map(
      (opportunitiesResult.data || []).map((opportunity) => [
        opportunity.id,
        opportunity,
      ]),
    );
    const opportunities = opportunityIds
      .map((opportunityId) => opportunitiesById.get(opportunityId))
      .filter(Boolean);

    if (opportunities.length < 2) {
      return sendJson(response, 400, {
        error:
          'At least two of these opportunities must still be visible and active.',
      });
    }

    const messages = buildAdvisorMessages({
      profile: profileResult.data,
      opportunities,
      filters,
    });
    const output = await callEstha(messages);
    const analysis = parseAdvisorOutput(
      output,
      opportunities.map((opportunity) => opportunity.id),
    );

    return sendJson(response, 200, {
      analysis,
      comparedCount: opportunities.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Opportunity advisor request failed', error);

    const status =
      error instanceof SyntaxError ||
      /select filters|No more than|invalid|not return enough/i.test(
        error.message,
      )
        ? 400
        : 500;

    return sendJson(response, status, {
      error:
        status === 400
          ? error.message
          : 'The opportunity comparison could not be generated. Try again.',
    });
  }
}

export const config = {
  maxDuration: 60,
};
