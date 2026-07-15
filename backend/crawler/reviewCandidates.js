import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "./env.js";
import { callRpc, selectRows } from "./supabaseRest.js";

loadLocalEnv();

function getOption(name) {
  const optionIndex = process.argv.indexOf(name);

  if (optionIndex === -1) return null;

  const value = process.argv[optionIndex + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Expected a candidate ID after ${name}.`);
  }

  return value;
}

export function buildCandidateSummary(candidate) {
  const opportunity = candidate.extracted_opportunity || {};

  return {
    id: candidate.id,
    score: candidate.candidate_score,
    confidence: candidate.confidence_score ?? opportunity.confidence_score ?? 0,
    title: opportunity.title || candidate.raw_subject || "Untitled opportunity",
    category: opportunity.category || "other",
    organisation: opportunity.organisation || "Not stated",
    deadline: opportunity.deadline_source_text || opportunity.deadline || "Not stated",
    application: candidate.application_url || opportunity.application_url || "Not stated",
    reviewReasons: candidate.review_reasons?.join(", ") || "None",
    source: candidate.source_url || "Not stated",
  };
}

async function listPendingCandidates() {
  const expiredCount = await callRpc("expire_past_opportunity_candidates");
  const candidates = await selectRows("opportunity_candidates", {
    select:
      "id,candidate_score,confidence_score,review_reasons,source_url,application_url,raw_subject,extracted_opportunity,created_at",
    status: "eq.pending",
    order: "candidate_score.desc,created_at.desc",
    limit: "50",
  });

  if (expiredCount > 0) {
    console.log(`Marked ${expiredCount} past candidate${expiredCount === 1 ? "" : "s"} as expired.`);
  }

  if (!candidates.length) {
    console.log("No pending opportunity candidates.");
    return;
  }

  console.table(candidates.map(buildCandidateSummary));
}

async function main() {
  const approveId = getOption("--approve");
  const rejectId = getOption("--reject");

  if (approveId && rejectId) {
    throw new Error("Choose either --approve or --reject, not both.");
  }

  if (approveId) {
    const opportunityId = await callRpc("approve_opportunity_candidate", {
      candidate_id: approveId,
    });
    console.log(`Approved candidate ${approveId} as opportunity ${opportunityId}.`);
    return;
  }

  if (rejectId) {
    await callRpc("reject_opportunity_candidate", { candidate_id: rejectId });
    console.log(`Rejected candidate ${rejectId}.`);
    return;
  }

  await listPendingCandidates();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
