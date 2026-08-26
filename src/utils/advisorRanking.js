export function getAdvisorRecommendationsById(analysis) {
  const recommendations = Array.isArray(analysis?.recommendations)
    ? analysis.recommendations
    : [];

  return new Map(
    recommendations
      .filter(recommendation => typeof recommendation?.opportunity_id === 'string')
      .map(recommendation => [recommendation.opportunity_id, recommendation])
  );
}

export function rankOpportunitiesWithAdvisor(opportunities, analysis) {
  const recommendationsById = getAdvisorRecommendationsById(analysis);

  return opportunities
    .map((opportunity, originalIndex) => ({
      opportunity,
      originalIndex,
      rank: Number(recommendationsById.get(opportunity.id)?.rank),
    }))
    .sort((left, right) => {
      const leftIsRanked = Number.isFinite(left.rank) && left.rank > 0;
      const rightIsRanked = Number.isFinite(right.rank) && right.rank > 0;

      if (leftIsRanked && rightIsRanked) return left.rank - right.rank;
      if (leftIsRanked !== rightIsRanked) return leftIsRanked ? -1 : 1;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ opportunity }) => opportunity);
}
