const CORE_PROFILE_FIELDS = [
  'full_name',
  'university',
  'faculty',
  'major',
  'year_of_study',
  'outlook_onboarding_status',
  'outlook_onboarding_updated_at',
];

const RECOMMENDATION_PROFILE_FIELDS = [
  'opportunity_interests',
  'career_goals',
  'skills_experience',
  'weekly_availability_hours',
  'workload_preference',
  'opportunity_budget_sgd',
  'preferred_locations',
  'preferred_delivery_modes',
  'willing_to_travel',
];

export const CORE_PROFILE_SELECT = CORE_PROFILE_FIELDS.join(', ');

export const PROFILE_SELECT = [
  ...CORE_PROFILE_FIELDS,
  ...RECOMMENDATION_PROFILE_FIELDS,
].join(', ');

export function isRecommendationProfileSchemaMissing(error) {
  if (!error) return false;

  const errorText = [
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    error.code === '42703'
    || error.code === 'PGRST204'
    || (
      /schema cache/i.test(errorText)
      && /profiles/i.test(errorText)
    )
    || RECOMMENDATION_PROFILE_FIELDS.some((field) => (
      errorText.includes(field)
    ))
  );
}

async function queryProfile(client, userId, columns) {
  return client
    .from('profiles')
    .select(columns)
    .eq('id', userId)
    .maybeSingle();
}

export async function selectProfileWithSchemaFallback(client, userId) {
  const profileResult = await queryProfile(client, userId, PROFILE_SELECT);

  if (!isRecommendationProfileSchemaMissing(profileResult.error)) {
    return profileResult;
  }

  return queryProfile(client, userId, CORE_PROFILE_SELECT);
}
