export function matchesMajor(opportunity, selectedMajor) {
  if (!selectedMajor) return true;

  const eligibleMajors = opportunity.eligible_majors || [];
  const eligibilityType = opportunity.major_eligibility_type;

  if (["all", "unknown", "inferred"].includes(eligibilityType)) return true;
  if (eligibleMajors.length === 0) return true;

  return eligibleMajors.includes(selectedMajor);
}

export function matchesYear(opportunity, selectedYear) {
  if (!selectedYear) return true;

  if (["unknown", "inferred"].includes(opportunity.year_eligibility_type)) {
    return true;
  }

  if (!opportunity.year_min || !opportunity.year_max) return true;

  return selectedYear >= opportunity.year_min && selectedYear <= opportunity.year_max;
}
