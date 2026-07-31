export function matchesMajor(opportunity, selectedMajor) {
  if (!selectedMajor) return true;

  if (opportunity.major_eligibility_type === "all") return true;

  const eligibleMajors = Array.isArray(opportunity.eligible_majors)
    ? opportunity.eligible_majors
    : [];

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
