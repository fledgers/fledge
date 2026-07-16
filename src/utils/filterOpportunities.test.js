import assert from "node:assert/strict";
import test from "node:test";
import { matchesMajor, matchesYear } from "./filterOpportunities.js";

test("does not treat inferred majors as a hard eligibility restriction", () => {
  const opportunity = {
    eligible_majors: ["computer_science"],
    major_eligibility_type: "inferred",
  };

  assert.equal(matchesMajor(opportunity, "history"), true);
});

test("applies explicitly stated major restrictions", () => {
  const opportunity = {
    eligible_majors: ["computer_science", "engineering"],
    major_eligibility_type: "specific",
  };

  assert.equal(matchesMajor(opportunity, "history"), false);
  assert.equal(matchesMajor(opportunity, "engineering"), true);
});

test("does not treat an inferred year range as a hard restriction", () => {
  const opportunity = {
    year_min: 2,
    year_max: 3,
    year_eligibility_type: "inferred",
  };

  assert.equal(matchesYear(opportunity, 1), true);
});

test("keeps unknown major and year eligibility visible to everyone", () => {
  const opportunity = {
    eligible_majors: [],
    major_eligibility_type: "unknown",
    year_min: null,
    year_max: null,
    year_eligibility_type: "unknown",
  };

  assert.equal(matchesMajor(opportunity, "history"), true);
  assert.equal(matchesYear(opportunity, 4), true);
});
