function formatYearTag(yearMin, yearMax) {
  if (!yearMin || !yearMax) return "👤 Check requirements";
  if (yearMin === yearMax) return `👤 Year ${yearMin}`;
  return `👤 Year ${yearMin}-${yearMax}`;
}

function formatDeadline(row) {
  if (!row.deadline) return "Open year-round";

  if (row.deadline_has_time && !row.deadline_source_timezone) {
    return row.deadline_source_text
      ? `Deadline: ${row.deadline_source_text} (time zone not stated)`
      : "Deadline time zone not stated";
  }

  const date = new Date(row.deadline);
  const dateLabel = date.toLocaleDateString("en-SG", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Singapore",
  });

  if (!row.deadline_has_time) return `Deadline: ${dateLabel}`;

  const timeLabel = date.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });

  return `Deadline: ${dateLabel}, ${timeLabel} SGT`;
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
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    organisation: row.organisation,
    source_url: row.source_url || null,
    application_url: row.application_url || null,

    location: formatLocation(row),
    yearTag: formatYearTag(row.year_min, row.year_max),
    deadline: row.deadline,
    deadlineLabel: formatDeadline(row),
    icon: getCategoryIcon(row.category),
    badge: row.eligibility ? "Requirements listed" : "Open to all",
    source_priority: row.source_priority ?? 99,
    source_published_at: row.source_published_at || null,
    last_seen_at: row.last_seen_at || null,
    confidence_score: row.confidence_score ?? 0,
    dedupe_key: row.dedupe_key || null,
    updated_at: row.updated_at || null,

    year_min: row.year_min,
    year_max: row.year_max,
    eligible_majors: row.eligible_majors || [],
    major_eligibility_type: row.major_eligibility_type || "unknown",
    year_eligibility_type: row.year_eligibility_type || "unknown",
    eligibility: row.eligibility || "",
    deadline_has_time: row.deadline_has_time || false,
    deadline_source_timezone: row.deadline_source_timezone || null,
    deadline_source_text: row.deadline_source_text || null,
  };
}
