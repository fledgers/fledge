import assert from "node:assert/strict";
import test from "node:test";
import { matchesMajor, matchesYear } from "./filterOpportunities.js";

test("requires an inferred major to match the selected major", () => {
  const opportunity = {
    eligible_majors: ["computer_science"],
    major_eligibility_type: "inferred",
  };

  assert.equal(matchesMajor(opportunity, "history"), false);
  assert.equal(matchesMajor(opportunity, "computer_science"), true);
});

test("applies explicitly stated major restrictions", () => {
  const opportunity = {
    eligible_majors: ["computer_science", "engineering"],
    major_eligibility_type: "specific",
  };

  assert.equal(matchesMajor(opportunity, "history"), false);
  assert.equal(matchesMajor(opportunity, "engineering"), true);
});

test("allows an opportunity explicitly marked for all majors", () => {
  const opportunity = {
    eligible_majors: [],
    major_eligibility_type: "all",
  };

  assert.equal(matchesMajor(opportunity, "history"), true);
});

test("does not treat unknown or empty major eligibility as all majors", () => {
  const opportunity = {
    eligible_majors: [],
    major_eligibility_type: "unknown",
  };

  assert.equal(matchesMajor(opportunity, "history"), false);
});

test("handles missing or invalid eligible major lists conservatively", () => {
  assert.equal(
    matchesMajor({ major_eligibility_type: "specific" }, "history"),
    false,
  );
  assert.equal(
    matchesMajor(
      {
        eligible_majors: "history",
        major_eligibility_type: "specific",
      },
      "history",
    ),
    false,
  );
});

test("shows every opportunity when no major filter is selected", () => {
  assert.equal(
    matchesMajor(
      {
        eligible_majors: [],
        major_eligibility_type: "unknown",
      },
      "",
    ),
    true,
  );
});

test("does not treat an inferred year range as a hard restriction", () => {
  const opportunity = {
    year_min: 2,
    year_max: 3,
    year_eligibility_type: "inferred",
  };

  assert.equal(matchesYear(opportunity, 1), true);
});

test("keeps unknown year eligibility visible to every year", () => {
  const opportunity = {
    eligible_majors: [],
    major_eligibility_type: "unknown",
    year_min: null,
    year_max: null,
    year_eligibility_type: "unknown",
  };

  assert.equal(matchesMajor(opportunity, "history"), false);
  assert.equal(matchesYear(opportunity, 4), true);
});
