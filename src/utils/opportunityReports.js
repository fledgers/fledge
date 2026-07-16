import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export const OPPORTUNITY_REPORT_REASONS = [
  { value: 'incorrect_information', label: 'Incorrect information' },
  { value: 'already_expired', label: 'Already expired' },
  { value: 'suspicious_or_scam', label: 'Suspicious or potentially unsafe' },
  { value: 'broken_application_link', label: 'Application link is broken' },
  { value: 'duplicate', label: 'Duplicate opportunity' },
  { value: 'other', label: 'Other issue' },
];

const VALID_REPORT_REASONS = new Set(
  OPPORTUNITY_REPORT_REASONS.map(reason => reason.value)
);

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

export class OpportunityReportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OpportunityReportError';
    this.code = code;
  }
}

export function validateOpportunityReport({ opportunityId, reason, details }) {
  const normalizedDetails = String(details || '').trim();

  if (!isUuid(opportunityId)) {
    return 'This opportunity is not connected to the live database yet.';
  }

  if (!VALID_REPORT_REASONS.has(reason)) {
    return 'Choose a valid reason for the report.';
  }

  if (reason === 'other' && !normalizedDetails) {
    return 'Add a short explanation for the issue.';
  }

  if (normalizedDetails.length > 1000) {
    return 'Report details must be 1,000 characters or fewer.';
  }

  return null;
}

export async function submitOpportunityReport({
  opportunityId,
  reason,
  details,
}) {
  const validationError = validateOpportunityReport({
    opportunityId,
    reason,
    details,
  });

  if (validationError) {
    throw new OpportunityReportError('VALIDATION_ERROR', validationError);
  }

  if (!isSupabaseConfigured || !supabase) {
    throw new OpportunityReportError(
      'CONFIGURATION_REQUIRED',
      'Reporting is not connected yet. Add the frontend Supabase settings.'
    );
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw new OpportunityReportError(
      'SESSION_ERROR',
      'Your login session could not be checked. Please try again.'
    );
  }

  const user = sessionData.session?.user;
  if (!user) {
    throw new OpportunityReportError(
      'AUTH_REQUIRED',
      'Log in before reporting an opportunity.'
    );
  }

  const normalizedDetails = String(details || '').trim();
  const { data, error } = await supabase
    .from('opportunity_reports')
    .insert({
      opportunity_id: opportunityId,
      reporter_user_id: user.id,
      reason,
      details: normalizedDetails || null,
    })
    .select('id,status')
    .single();

  if (error?.code === '23505') {
    throw new OpportunityReportError(
      'ALREADY_REPORTED',
      'You already have a pending report for this opportunity.'
    );
  }

  if (error) {
    throw new OpportunityReportError(
      'SUBMISSION_FAILED',
      'The report could not be submitted. Please try again.'
    );
  }

  return data;
}
