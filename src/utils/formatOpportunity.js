export const EXPIRED_RETENTION_DAYS = 15;

export function getOpportunityDetailsUrl(opportunity) {
  return opportunity.source_url || opportunity.application_url || null;
}

export function getOpportunityExpiryTime(opportunity) {
  if (opportunity.deadline) {
    if (
      opportunity.deadline_has_time &&
      opportunity.deadline_source_timezone
    ) {
      const exactTime = new Date(opportunity.deadline).getTime();
      return Number.isNaN(exactTime) ? null : exactTime;
    }

    const dateOnly = String(opportunity.deadline).slice(0, 10);
    const endOfSingaporeDay = new Date(
      `${dateOnly}T23:59:59.999+08:00`
    ).getTime();
    return Number.isNaN(endOfSingaporeDay) ? null : endOfSingaporeDay;
  }

  if (opportunity.listing_expires_at) {
    const rollingExpiry = new Date(opportunity.listing_expires_at).getTime();
    return Number.isNaN(rollingExpiry) ? null : rollingExpiry;
  }

  return null;
}

export function isOpportunityExpired(opportunity, now = Date.now()) {
  const expiryTime = getOpportunityExpiryTime(opportunity);
  return expiryTime !== null && expiryTime < now;
}

export function isExpiredOpportunityRetained(
  opportunity,
  now = Date.now(),
  retentionDays = EXPIRED_RETENTION_DAYS
) {
  const expiryTime = getOpportunityExpiryTime(opportunity);
  if (expiryTime === null || expiryTime >= now) return false;

  return now <= expiryTime + retentionDays * 24 * 60 * 60 * 1000;
}

const UNCERTAIN_ELIGIBILITY_TYPES = new Set(["unknown", "inferred"]);

export function getEligibilityWarning(opportunity) {
  const majorIsUnclear = UNCERTAIN_ELIGIBILITY_TYPES.has(
    opportunity.major_eligibility_type
  );
  const yearIsUnclear = UNCERTAIN_ELIGIBILITY_TYPES.has(
    opportunity.year_eligibility_type
  );

  if (majorIsUnclear && yearIsUnclear) {
    return "Major and year eligibility are not clearly stated. Check both on the official source before applying.";
  }

  if (majorIsUnclear) {
    return "Major eligibility is not clearly stated. Check it on the official source before applying.";
  }

  if (yearIsUnclear) {
    return "Year eligibility is not clearly stated. Check it on the official source before applying.";
  }

  return null;
}

function formatYearTag(row) {
  if (UNCERTAIN_ELIGIBILITY_TYPES.has(row.year_eligibility_type)) {
    return "👤 Check year eligibility";
  }

  if (!row.year_min || !row.year_max) return "👤 Check requirements";
  if (row.year_min === row.year_max) return `👤 Year ${row.year_min}`;
  return `👤 Year ${row.year_min}-${row.year_max}`;
}

function formatDeadlineValue({
  deadline,
  deadlineHasTime,
  deadlineSourceTimezone,
  deadlineSourceText,
  label,
}) {
  if (!deadline) return null;

  if (deadlineHasTime && !deadlineSourceTimezone) {
    return deadlineSourceText
      ? `${label}: ${deadlineSourceText} (time zone not stated)`
      : `${label} time zone not stated`;
  }

  const date = new Date(deadline);
  const dateLabel = date.toLocaleDateString("en-SG", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Singapore",
  });

  if (!deadlineHasTime) return `${label}: ${dateLabel}`;

  const timeLabel = date.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });

  return `${label}: ${dateLabel}, ${timeLabel} SGT`;
}

function formatDeadline(row) {
  if (!row.deadline) {
    return row.listing_expires_at
      ? "Rolling applications"
      : "Application timing not stated";
  }

  return formatDeadlineValue({
    deadline: row.deadline,
    deadlineHasTime: row.deadline_has_time,
    deadlineSourceTimezone: row.deadline_source_timezone,
    deadlineSourceText: row.deadline_source_text,
    label:
      row.deadline_source === "nus"
        ? "NUS application deadline"
        : "Deadline",
  });
}

function formatExternalDeadline(row) {
  if (!row.deadline_conflict || !row.external_deadline) return null;

  return formatDeadlineValue({
    deadline: row.external_deadline,
    deadlineHasTime: row.external_deadline_has_time,
    deadlineSourceTimezone: row.external_deadline_source_timezone,
    deadlineSourceText: row.external_deadline_source_text,
    label: "Host deadline",
  });
}

function getCategoryIcon(category) {
  const icons = {
    internship: "💼",
    competition: "⚡",
    scholarship: "🏅",
    research: "🔬",
    exchange: "✈️",
    summer_programme: "☀️",
    winter_programme: "❄️",
    mentorship: "🎯",
    networking: "🎤",
    entrepreneurship: "🚀",
    volunteer: "🤝",
    community: "🌱",
    other: "✨",
  };

  return icons[category] || "✨";
}

function formatLocation(row) {
  if (row.delivery_mode === "online") return "💻 Online";
  if (row.delivery_mode === "hybrid") return "🌐 Hybrid";
  if (row.delivery_mode === "in_person") {
    return row.location ? `📍 ${row.location}` : "📍 On-site";
  }

  return row.location || "Location TBC";
}

export function formatOpportunity(row) {
  const majorEligibilityType = row.major_eligibility_type || "unknown";
  const yearEligibilityType = row.year_eligibility_type || "unknown";
  const eligibilityWarning = getEligibilityWarning({
    major_eligibility_type: majorEligibilityType,
    year_eligibility_type: yearEligibilityType,
  });

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    organisation: row.organisation,
    source_url: row.source_url || null,
    application_url: row.application_url || null,

    location: formatLocation(row),
    yearTag: formatYearTag({
      year_min: row.year_min,
      year_max: row.year_max,
      year_eligibility_type: yearEligibilityType,
    }),
    deadline: row.deadline,
    deadlineLabel: formatDeadline(row),
    externalDeadlineLabel: formatExternalDeadline(row),
    icon: getCategoryIcon(row.category),
    badge: eligibilityWarning
      ? "Check eligibility"
      : row.eligibility
        ? "Requirements listed"
        : "Open to all",
    eligibilityWarning,
    source_priority: row.source_priority ?? 99,
    source_published_at: row.source_published_at || null,
    created_at: row.created_at || null,
    last_seen_at: row.last_seen_at || null,
    confidence_score: row.confidence_score ?? 0,
    dedupe_key: row.dedupe_key || null,
    updated_at: row.updated_at || null,
    visibility: row.visibility || "public",
    owner_user_id: row.owner_user_id || null,
    listing_expires_at: row.listing_expires_at || null,
    isExpired: isOpportunityExpired(row),

    year_min: row.year_min,
    year_max: row.year_max,
    eligible_majors: row.eligible_majors || [],
    major_eligibility_type: majorEligibilityType,
    year_eligibility_type: yearEligibilityType,
    eligibility: row.eligibility || "",
    deadline_has_time: row.deadline_has_time || false,
    deadline_source_timezone: row.deadline_source_timezone || null,
    deadline_source_text: row.deadline_source_text || null,
    deadline_source: row.deadline_source || "unknown",
    external_deadline: row.external_deadline || null,
    external_deadline_has_time: row.external_deadline_has_time || false,
    external_deadline_source_timezone:
      row.external_deadline_source_timezone || null,
    external_deadline_source_text: row.external_deadline_source_text || null,
    deadline_conflict: row.deadline_conflict || false,
    deadline_note: row.deadline_note || null,
  };
}
