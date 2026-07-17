import { createHash } from "node:crypto";
import {
  buildOpportunityDedupeKey,
  getAutomaticPublicationDecision,
  getOpportunityVisibilityDecision,
  scopeOpportunityDedupeKey,
} from "./opportunityPolicy.js";

const CATEGORY_RULES = [
  {
    category: "internship",
    keywords: [
      "internship",
      "intern",
      "traineeship",
      "industrial attachment",
      "work attachment",
    ],
  },
  {
    category: "competition",
    keywords: ["competition", "hackathon", "challenge", "case competition", "contest"],
  },
  {
    category: "scholarship",
    keywords: [
      "scholarship",
      "scholarships",
      "bursary",
      "bursaries",
      "financial aid",
      "study award",
      "study awards",
    ],
  },
  {
    category: "volunteer",
    keywords: ["volunteer", "volunteering", "community service", "charity"],
  },
  {
    category: "community",
    keywords: [
      "changemaker",
      "change maker",
      "civic action",
      "collective impact",
      "community",
      "community impact",
      "community leadership",
      "community project",
      "grant making",
      "social impact",
      "social innovator",
      "social innovation",
      "society",
      "youth curators",
      "youth-led",
      "youth led",
    ],
  },
  {
    category: "research",
    keywords: [
      "research",
      "research assistant",
      "research attachment",
      "research attachments",
      "urop",
      "lab assistant",
    ],
  },
  {
    category: "exchange",
    keywords: [
      "exchange",
      "engagement and enrichment",
      "overseas exchange",
      "semester abroad",
      "sep",
      "steer",
      "student exchange",
      "student exchange programme",
      "student exchange program",
      "study abroad",
      "study trip",
      "study trips",
    ],
  },
  {
    category: "summer_programme",
    keywords: ["summer programme", "summer program", "summer school", "summer course"],
  },
  {
    category: "winter_programme",
    keywords: ["winter programme", "winter program", "winter school", "winter course"],
  },
  {
    category: "mentorship",
    keywords: ["mentor", "mentorship", "mentoring"],
  },
  {
    category: "networking",
    keywords: ["networking", "career talk", "panel discussion", "industry panel"],
  },
  {
    category: "entrepreneurship",
    keywords: [
      "startup",
      "start-up",
      "entrepreneurial",
      "entrepreneurship",
      "incubator",
      "accelerator",
      "founder",
      "noc",
      "nus overseas colleges",
      "overseas colleges",
    ],
  },
];

const MAJOR_RULES = [
  {
    major: "anthropology",
    keywords: [
      "anthropology",
      "anthropological",
      "ethnography",
      "ethnographic",
      "cultural studies",
      "human culture",
    ],
  },
  {
    major: "architecture",
    keywords: [
      "architecture",
      "architectural",
      "architect",
      "built environment",
      "building design",
      "urban design",
    ],
  },
  {
    major: "artificial_intelligence",
    keywords: [
      "artificial intelligence",
      "generative ai",
      "machine learning",
      "deep learning",
      "neural network",
      "ai research",
    ],
  },
  {
    major: "business_administration",
    keywords: [
      "business administration",
      "business",
      "management",
      "marketing",
      "consulting",
      "strategy",
      "operations",
      "sales",
    ],
  },
  {
    major: "business_analytics",
    keywords: [
      "business analytics",
      "business intelligence",
      "data analytics",
      "analytics",
      "dashboard",
      "market analysis",
    ],
  },
  {
    major: "business_artificial_intelligence_systems",
    keywords: [
      "business artificial intelligence",
      "ai systems",
      "business ai",
      "intelligent systems",
      "enterprise ai",
    ],
  },
  {
    major: "chemistry",
    keywords: [
      "chemistry",
      "chemical",
      "laboratory",
      "materials chemistry",
      "analytical chemistry",
      "organic chemistry",
    ],
  },
  {
    major: "chinese_languages_and_cultures",
    keywords: [
      "chinese language",
      "chinese languages",
      "chinese culture",
      "mandarin",
      "chinese literature",
      "sinology",
    ],
  },
  {
    major: "chinese_studies_bilingual",
    keywords: [
      "chinese studies",
      "bilingual chinese",
      "china studies",
      "chinese society",
      "chinese history",
    ],
  },
  {
    major: "common_computer_science_programmes",
    keywords: [
      "common computer science",
      "computing programme",
      "computing program",
      "computer science programme",
      "computer science program",
    ],
  },
  {
    major: "communications_and_new_media",
    keywords: [
      "communications",
      "communication",
      "new media",
      "media",
      "content",
      "journalism",
      "social media",
      "public relations",
      "digital marketing",
    ],
  },
  {
    major: "computer_science",
    keywords: [
      "computer science",
      "software",
      "software engineering",
      "programming",
      "developer",
      "web development",
      "frontend",
      "backend",
      "full-stack",
      "full stack",
      "algorithm",
    ],
  },
  {
    major: "data_science_and_analytics",
    keywords: [
      "data science",
      "data analytics",
      "data analysis",
      "machine learning",
      "data visualization",
      "data visualisation",
      "big data",
    ],
  },
  {
    major: "data_science_and_economics",
    keywords: [
      "data science and economics",
      "economic data",
      "econometrics",
      "quantitative economics",
      "economic modelling",
      "economic modeling",
    ],
  },
  {
    major: "economics",
    keywords: [
      "economics",
      "economic policy",
      "economist",
      "econometrics",
      "macroeconomics",
      "microeconomics",
      "market research",
    ],
  },
  {
    major: "engineering",
    keywords: [
      "engineering",
      "engineer",
      "robotics",
      "hardware",
      "mechanical",
      "electrical",
      "civil engineering",
      "chemical engineering",
      "biomedical engineering",
      "environmental engineering",
      "materials engineering",
      "industrial engineering",
    ],
  },
  {
    major: "english_language_and_linguistics",
    keywords: [
      "english language",
      "linguistics",
      "language research",
      "discourse analysis",
      "phonetics",
      "syntax",
      "semantics",
    ],
  },
  {
    major: "english_literature",
    keywords: [
      "english literature",
      "literature",
      "literary",
      "creative writing",
      "poetry",
      "fiction",
      "drama studies",
    ],
  },
  {
    major: "environmental_studies",
    keywords: [
      "environmental studies",
      "environment",
      "sustainability",
      "climate",
      "biodiversity",
      "conservation",
      "ecology",
      "green",
    ],
  },
  {
    major: "food_science_and_technology",
    keywords: [
      "food science",
      "food technology",
      "food safety",
      "nutrition",
      "food innovation",
      "food systems",
    ],
  },
  {
    major: "geography",
    keywords: [
      "geography",
      "geographical",
      "urban studies",
      "urban planning",
      "spatial analysis",
      "human geography",
      "physical geography",
    ],
  },
  {
    major: "geospatial_intelligence",
    keywords: [
      "geospatial",
      "gis",
      "remote sensing",
      "mapping",
      "satellite imagery",
      "spatial data",
    ],
  },
  {
    major: "global_studies",
    keywords: [
      "global studies",
      "international relations",
      "global affairs",
      "global policy",
      "development studies",
      "international development",
    ],
  },
  {
    major: "history",
    keywords: [
      "history",
      "historical",
      "archive",
      "archives",
      "heritage",
      "museum",
      "public history",
    ],
  },
  {
    major: "humanities_and_sciences",
    keywords: [
      "humanities and sciences",
      "interdisciplinary",
      "liberal arts",
      "humanities",
      "science communication",
    ],
  },
  {
    major: "industrial_design",
    keywords: [
      "industrial design",
      "product design",
      "design thinking",
      "user experience",
      "ux design",
      "prototype",
      "prototyping",
    ],
  },
  {
    major: "information_security",
    keywords: [
      "information security",
      "cybersecurity",
      "cyber security",
      "network security",
      "cryptography",
      "security engineering",
      "penetration testing",
    ],
  },
  {
    major: "infrastructure_and_project_management",
    keywords: [
      "infrastructure",
      "project management",
      "construction management",
      "facilities management",
      "real estate development",
      "built assets",
    ],
  },
  {
    major: "japanese_studies",
    keywords: [
      "japanese studies",
      "japan",
      "japanese language",
      "japanese culture",
      "japanese society",
    ],
  },
  {
    major: "landscape_architecture",
    keywords: [
      "landscape architecture",
      "landscape design",
      "urban greenery",
      "parks",
      "public space design",
    ],
  },
  {
    major: "life_sciences",
    keywords: [
      "life sciences",
      "biology",
      "biological",
      "biotech",
      "biotechnology",
      "genetics",
      "molecular biology",
      "ecology",
    ],
  },
  {
    major: "mathematics",
    keywords: [
      "mathematics",
      "math",
      "quantitative",
      "quant",
      "mathematical modelling",
      "mathematical modeling",
      "applied mathematics",
    ],
  },
  {
    major: "malay_studies",
    keywords: [
      "malay studies",
      "malay language",
      "malay culture",
      "malay world",
      "southeast asian malay",
    ],
  },
  {
    major: "philosophy",
    keywords: [
      "philosophy",
      "ethics",
      "moral philosophy",
      "logic",
      "political philosophy",
      "philosophical",
    ],
  },
  {
    major: "philosophy_politics_and_economics",
    keywords: [
      "philosophy politics and economics",
      "ppe",
      "political economy",
      "public policy",
      "governance",
      "ethics and policy",
    ],
  },
  {
    major: "physics",
    keywords: [
      "physics",
      "quantum",
      "astronomy",
      "astrophysics",
      "optics",
      "materials physics",
      "particle physics",
    ],
  },
  {
    major: "political_science",
    keywords: [
      "political science",
      "politics",
      "public policy",
      "government",
      "governance",
      "international relations",
      "policy research",
    ],
  },
  {
    major: "psychology",
    keywords: [
      "psychology",
      "psychological",
      "behavioural",
      "behavioral",
      "cognitive science",
      "mental health",
      "human behaviour",
      "human behavior",
    ],
  },
  {
    major: "quantitative_finance",
    keywords: [
      "quantitative finance",
      "quant finance",
      "financial modelling",
      "financial modeling",
      "risk modelling",
      "risk modeling",
      "trading",
      "investment analytics",
    ],
  },
  {
    major: "social_work",
    keywords: [
      "social work",
      "community care",
      "casework",
      "social service",
      "family service",
      "youth work",
    ],
  },
  {
    major: "sociology",
    keywords: [
      "sociology",
      "sociological",
      "society",
      "social research",
      "social inequality",
      "migration",
    ],
  },
  {
    major: "south_asian_studies",
    keywords: [
      "south asian studies",
      "south asia",
      "india",
      "indian society",
      "south asian culture",
    ],
  },
  {
    major: "southeast_asian_studies",
    keywords: [
      "southeast asian studies",
      "southeast asia",
      "asean",
      "indonesia",
      "malaysia",
      "thailand",
      "vietnam",
    ],
  },
  {
    major: "statistics",
    keywords: [
      "statistics",
      "statistical",
      "statistician",
      "probability",
      "statistical modelling",
      "statistical modeling",
      "biostatistics",
    ],
  },
  {
    major: "theatre_and_performance_studies",
    keywords: [
      "theatre",
      "theater",
      "performance studies",
      "performance",
      "drama",
      "stage production",
    ],
  },
];

const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const MONTH_NUMBERS = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

// Abbreviations such as CST are intentionally excluded because they can mean
// different places. A deadline is converted only when its timezone is clear.
const DEADLINE_TIME_ZONES = [
  { pattern: /\bSGT\b|Singapore Standard Time/i, label: "SGT", offsetMinutes: 480 },
  { pattern: /\bKST\b|Korea Standard Time/i, label: "KST", offsetMinutes: 540 },
  { pattern: /\bJST\b|Japan Standard Time/i, label: "JST", offsetMinutes: 540 },
  { pattern: /\bHKT\b|Hong Kong Time/i, label: "HKT", offsetMinutes: 480 },
  { pattern: /China Standard Time/i, label: "China Standard Time", offsetMinutes: 480 },
  { pattern: /\bIST\b|India Standard Time/i, label: "IST", offsetMinutes: 330 },
  { pattern: /\bAEST\b|Australian Eastern Standard Time/i, label: "AEST", offsetMinutes: 600 },
  { pattern: /\bAEDT\b|Australian Eastern Daylight Time/i, label: "AEDT", offsetMinutes: 660 },
  { pattern: /\bPST\b|Pacific Standard Time/i, label: "PST", offsetMinutes: -480 },
  { pattern: /\bPDT\b|Pacific Daylight Time/i, label: "PDT", offsetMinutes: -420 },
  { pattern: /\bMST\b|Mountain Standard Time/i, label: "MST", offsetMinutes: -420 },
  { pattern: /\bMDT\b|Mountain Daylight Time/i, label: "MDT", offsetMinutes: -360 },
  { pattern: /\bEST\b|Eastern Standard Time/i, label: "EST", offsetMinutes: -300 },
  { pattern: /\bEDT\b|Eastern Daylight Time/i, label: "EDT", offsetMinutes: -240 },
  { pattern: /\bBST\b|British Summer Time/i, label: "BST", offsetMinutes: 60 },
  { pattern: /\bCET\b|Central European Time/i, label: "CET", offsetMinutes: 60 },
  { pattern: /\bCEST\b|Central European Summer Time/i, label: "CEST", offsetMinutes: 120 },
  { pattern: /\bUTC\b|\bGMT\b/, label: "UTC", offsetMinutes: 0 },
];

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtml(html = "") {
  return normalizeWhitespace(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
  );
}

function getEmailText(email) {
  const bodyText =
    email.body?.contentType?.toLowerCase() === "html"
      ? stripHtml(email.body.content)
      : email.body?.content || "";

  return normalizeWhitespace(
    [email.subject, email.bodyPreview, bodyText].filter(Boolean).join(" ")
  );
}

function getEmailBodyText(email) {
  const bodyText =
    email.body?.contentType?.toLowerCase() === "html"
      ? stripHtml(email.body.content)
      : email.body?.content || "";

  return normalizeWhitespace(bodyText || email.bodyPreview || "");
}

function keywordMatches(text, keyword) {
  if (/^[a-z0-9]+$/i.test(keyword)) {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(text);
  }

  return text.includes(keyword);
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => keywordMatches(text, keyword));
}

const NUS_STUDENT_ELIGIBILITY_SIGNALS = [
  "nus students",
  "nus student",
  "national university of singapore",
  "university students",
  "university student",
  "undergraduate students",
  "undergraduate student",
  "undergraduates",
  "full-time students",
  "full time students",
  "tertiary students",
  "tertiary student",
  "polytechnic and university students",
  "students in singapore",
  "singapore students",
  "singaporean students",
  "students based in singapore",
  "open to all students",
  "open to students",
  "students interested",
  "student interested",
  "student teams",
  "student competition",
  "student hackathon",
  "student programme",
  "student program",
  "students and graduates",
  "student and graduate",
  "young singaporeans",
  "singapore youth",
];

const OPEN_ELIGIBILITY_SIGNALS = [
  "open to all",
  "no prior experience required",
  "all majors welcome",
  "all disciplines welcome",
  "all faculties welcome",
  "all years welcome",
  "students from all disciplines",
  "students from any discipline",
];

const GLOBAL_ELIGIBILITY_SIGNALS = [
  "accepting applications worldwide",
  "all nationalities are eligible",
  "all nationalities eligible",
  "global applications welcome",
  "international applicants are welcome",
  "international applicants welcome",
  "international students are welcome",
  "international students welcome",
  "no nationality restriction",
  "no nationality restrictions",
  "open globally",
  "open to all nationalities",
  "open to applicants worldwide",
  "open to students worldwide",
  "open worldwide",
  "students from any country",
  "students from around the world",
  "teams from around the world",
  "worldwide applications",
  "worldwide participation",
];

const INELIGIBLE_AUDIENCE_SIGNALS = [
  "working adults",
  "working professionals",
  "mid-career",
  "mid career",
  "full-time employees",
  "full time employees",
  "employees only",
  "staff only",
  "professionals only",
  "not open to students",
  "graduates only",
  "postgraduate students only",
  "masters students only",
  "phd students only",
  "minimum 2 years of work experience",
  "minimum 3 years of work experience",
  "minimum 5 years of work experience",
];

const FOREIGN_ONLY_PATTERNS = [
  /\b(?:us|u\.s\.|united states|uk|u\.k\.|united kingdom|australian|canadian|indian|malaysian|indonesian|thai|vietnamese|japanese|korean|chinese)\s+(?:citizens|residents|nationals)\s+only\b/i,
  /\bonly\s+open\s+to\s+(?:citizens|residents|nationals)\s+of\s+(?!singapore\b)[a-z .-]+\b/i,
  /\bmust\s+be\s+(?:a\s+)?(?:us|u\.s\.|uk|u\.k\.|australian|canadian|indian|malaysian|indonesian)\s+(?:citizen|resident|national)\b/i,
];

const HOST_COUNTRY_RULES = [
  {
    name: "Singapore",
    pattern: "singapore|singaporean",
    domainSuffixes: [".sg"],
  },
  {
    name: "United States",
    pattern: "us|u\\.s\\.?|united states|american",
    domainSuffixes: [".edu", ".us"],
  },
  {
    name: "United Kingdom",
    pattern: "uk|u\\.k\\.?|united kingdom|british",
    domainSuffixes: [".uk"],
  },
  {
    name: "Australia",
    pattern: "australia|australian",
    domainSuffixes: [".au"],
  },
  {
    name: "Canada",
    pattern: "canada|canadian",
    domainSuffixes: [".ca"],
  },
  {
    name: "China",
    pattern: "china|chinese",
    domainSuffixes: [".cn"],
  },
  {
    name: "India",
    pattern: "india|indian",
    domainSuffixes: [".in"],
  },
  {
    name: "Indonesia",
    pattern: "indonesia|indonesian",
    domainSuffixes: [".id"],
  },
  {
    name: "Japan",
    pattern: "japan|japanese",
    domainSuffixes: [".jp"],
  },
  {
    name: "Malaysia",
    pattern: "malaysia|malaysian",
    domainSuffixes: [".my"],
  },
  {
    name: "South Korea",
    pattern: "south korea|korea|korean",
    domainSuffixes: [".kr"],
  },
  {
    name: "Thailand",
    pattern: "thailand|thai",
    domainSuffixes: [".th"],
  },
  {
    name: "Vietnam",
    pattern: "vietnam|vietnamese",
    domainSuffixes: [".vn"],
  },
];

const UNIVERSITY_YEAR_ELIGIBILITY_PATTERNS = [
  /\b(?:year|years)\s*[1-4](?:\s*(?:-|–|—|to|and)\s*(?:year\s*)?[1-4])?\b/i,
  /\b(?:first|second|third|fourth)[ -]year\s+(?:university\s+)?students?\b/i,
];

const UNIVERSITY_AGE_ELIGIBILITY_PATTERNS = [
  /\b(?:aged?|ages?|age\s+between)\s*(\d{1,2})\s*(?:-|–|—|to|and)\s*(\d{1,2})(?:\s*years?\s*old)?\b/gi,
  /\b(?:applicants?|participants?|candidates?)\s+(?:must\s+be\s+)?(\d{1,2})\s*(?:-|–|—|to|and)\s*(\d{1,2})\s+years?\s+old\b/gi,
];

const CURRENT_APPLICATION_SIGNALS = [
  "accepting applications",
  "application deadline",
  "application period",
  "applications are open",
  "applications now open",
  "applications open",
  "apply by",
  "apply now",
  "call for applications",
  "closes on",
  "deadline",
  "open for applications",
  "open for registration",
  "register by",
  "register now",
  "registration open",
  "registrations open",
  "submit your application",
];

const CLOSED_APPLICATION_SIGNALS = [
  "application period has ended",
  "applications are closed",
  "applications closed",
  "deadline has passed",
  "no longer accepting applications",
  "registration has closed",
  "registration is closed",
];

const HISTORICAL_PAGE_SIGNALS = [
  "award ceremony",
  "awarded",
  "concluded",
  "has closed",
  "highlights",
  "launched today",
  "media release",
  "past event",
  "press release",
  "recap",
  "was launched",
  "were awarded",
  "winners",
];

const HISTORICAL_URL_SEGMENTS = [
  "/article/",
  "/articles/",
  "/blog/",
  "/blogs/",
  "/media/",
  "/news/",
  "/past-event",
  "/past-events",
  "/press-release",
  "/press-releases",
];

function findFirstSignal(text, signals) {
  return signals.find((signal) => keywordMatches(text, signal));
}

function inferHostCountry(sourceUrl, text) {
  const labelledLocation = extractLabeledValue(text, [
    "Programme Location",
    "Program Location",
    "Host Country",
    "Event Location",
  ]);

  if (labelledLocation) {
    const locationRule = HOST_COUNTRY_RULES.find((rule) =>
      new RegExp(`\\b(?:${rule.pattern})\\b`, "i").test(labelledLocation)
    );

    if (locationRule) return locationRule.name;
  }

  if (!sourceUrl) return null;

  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    const domainRule = HOST_COUNTRY_RULES.find((rule) =>
      rule.domainSuffixes.some((suffix) => hostname.endsWith(suffix))
    );

    return domainRule?.name || null;
  } catch {
    return null;
  }
}

function findForeignOnlyRestriction(text, hostCountry) {
  for (const pattern of FOREIGN_ONLY_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  for (const rule of HOST_COUNTRY_RULES) {
    if (rule.name === "Singapore") continue;

    const country = `(?:${rule.pattern})`;
    const audience =
      "(?:(?:university|college|tertiary|undergraduate)\\s+)?" +
      "(?:students?|applicants?|participants?|teams?|citizens?|residents?|nationals?)";
    const patterns = [
      new RegExp(`\\b${country}\\s+${audience}\\s+only\\b`, "i"),
      new RegExp(
        `\\b(?:only\\s+(?:open\\s+to\\s+)?|open\\s+only\\s+to\\s+|restricted\\s+to\\s+)${country}\\s+${audience}\\b`,
        "i"
      ),
      new RegExp(
        `\\b${audience}\\s+(?:from|in)\\s+(?:the\\s+)?${country}\\s+only\\b`,
        "i"
      ),
      new RegExp(
        `\\bonly\\s+${audience}\\s+(?:from|in)\\s+(?:the\\s+)?${country}\\b`,
        "i"
      ),
      new RegExp(
        `\\b${audience}\\s+(?:enrolled|studying)\\s+(?:at|in)\\s+(?:an?\\s+)?${country}\\s+(?:universities|colleges|institutions)\\s+only\\b`,
        "i"
      ),
      new RegExp(
        `\\bonly\\s+${audience}\\s+(?:enrolled|studying)\\s+(?:at|in)\\s+(?:an?\\s+)?${country}\\s+(?:universities|colleges|institutions)\\b`,
        "i"
      ),
      new RegExp(
        `\\bmust\\s+be\\s+(?:an?\\s+)?${country}\\s+${audience}\\b`,
        "i"
      ),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
  }

  if (hostCountry && hostCountry !== "Singapore") {
    const domesticOnlyPatterns = [
      /\b(?:domestic|local)\s+(?:(?:university|college|tertiary|undergraduate)\s+)?(?:students?|applicants?|participants?|teams?)\s+only\b/i,
      /\bonly\s+(?:domestic|local)\s+(?:(?:university|college|tertiary|undergraduate)\s+)?(?:students?|applicants?|participants?|teams?)\b/i,
    ];

    for (const pattern of domesticOnlyPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
  }

  return null;
}

function findUniversityYearSignal(text) {
  for (const pattern of UNIVERSITY_YEAR_ELIGIBILITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

function findUniversityAgeRange(text) {
  for (const pattern of UNIVERSITY_AGE_ELIGIBILITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const firstAge = Number(match[1]);
      const secondAge = Number(match[2]);
      const minimumAge = Math.min(firstAge, secondAge);
      const maximumAge = Math.max(firstAge, secondAge);

      if (minimumAge <= 25 && maximumAge >= 18) {
        return `${minimumAge}-${maximumAge}`;
      }
    }
  }

  return null;
}

function hasCurrentApplicationSignal(text) {
  return Boolean(findFirstSignal(text.toLowerCase(), CURRENT_APPLICATION_SIGNALS));
}

function hasClosedApplicationSignal(text) {
  return Boolean(findFirstSignal(text.toLowerCase(), CLOSED_APPLICATION_SIGNALS));
}

function containsPastYear(text) {
  const currentYear = new Date().getFullYear();
  const yearPattern = /\b20\d{2}\b/g;
  let match;

  while ((match = yearPattern.exec(text)) !== null) {
    if (Number(match[0]) < currentYear) return true;
  }

  return false;
}

function hasHistoricalUrl(sourceUrl) {
  if (!sourceUrl) return false;

  try {
    const { pathname } = new URL(sourceUrl);
    const normalizedPath = pathname.toLowerCase();

    return HISTORICAL_URL_SEGMENTS.some((segment) =>
      normalizedPath.includes(segment)
    );
  } catch {
    return false;
  }
}

function isHistoricalPublicWebPage({
  sourceUrl,
  title = "",
  descriptionText = "",
  fullText = "",
}) {
  const reviewText = normalizeWhitespace(
    [title, descriptionText, fullText.slice(0, 1200)].filter(Boolean).join(" ")
  );
  const lowerReviewText = reviewText.toLowerCase();

  if (hasCurrentApplicationSignal(lowerReviewText)) return false;

  const historicalSignal = findFirstSignal(lowerReviewText, HISTORICAL_PAGE_SIGNALS);
  const hasPastYear = containsPastYear(reviewText);

  return (
    hasHistoricalUrl(sourceUrl) ||
    (historicalSignal && hasPastYear) ||
    (hasPastYear && /\bawards?\b|ceremony|winners?|press|news/i.test(reviewText))
  );
}

export function assessNusStudentEligibility(text, options = {}) {
  const lowerText = text.toLowerCase();
  const hostCountry =
    options.hostCountry || inferHostCountry(options.sourceUrl, text);

  const ineligibleSignal = findFirstSignal(lowerText, INELIGIBLE_AUDIENCE_SIGNALS);
  if (ineligibleSignal) {
    return {
      eligible: false,
      hostCountry,
      reason: `Rejected because it looks targeted at ${ineligibleSignal}.`,
      scope: "non_student",
    };
  }

  const foreignOnlyRestriction = findForeignOnlyRestriction(text, hostCountry);
  if (foreignOnlyRestriction) {
    return {
      eligible: false,
      hostCountry,
      reason: `Rejected because it is restricted to another country's applicants: ${foreignOnlyRestriction}.`,
      scope: "foreign_only",
    };
  }

  const globalSignal = findFirstSignal(lowerText, GLOBAL_ELIGIBILITY_SIGNALS);
  if (globalSignal) {
    return {
      eligible: true,
      hostCountry,
      reason: `Matched global eligibility signal: ${globalSignal}.`,
      scope: "global",
    };
  }

  if (options.trustedForNusStudents) {
    return {
      eligible: true,
      hostCountry,
      reason: "Trusted NUS student source.",
      scope: "trusted_nus",
    };
  }

  const nusSignal = findFirstSignal(lowerText, NUS_STUDENT_ELIGIBILITY_SIGNALS);
  if (nusSignal) {
    return {
      eligible: true,
      hostCountry,
      reason: `Matched student eligibility signal: ${nusSignal}.`,
      scope: "student",
    };
  }

  const universityYearSignal = findUniversityYearSignal(text);
  if (universityYearSignal) {
    return {
      eligible: true,
      hostCountry,
      reason: `Matched university year eligibility: ${universityYearSignal}.`,
      scope: "university_year",
    };
  }

  const universityAgeRange = findUniversityAgeRange(text);
  if (universityAgeRange) {
    return {
      eligible: true,
      hostCountry,
      reason: `Matched an age range that includes university students: ${universityAgeRange}.`,
      scope: "university_age",
    };
  }

  const openSignal = findFirstSignal(lowerText, OPEN_ELIGIBILITY_SIGNALS);
  if (openSignal && /singapore|student|undergraduate|university|tertiary|nus/i.test(text)) {
    return {
      eligible: true,
      hostCountry,
      reason: `Matched open eligibility signal: ${openSignal}.`,
      scope: "open_student",
    };
  }

  return {
    eligible: false,
    hostCountry,
    reason: "Rejected because no clear NUS/student eligibility signal was found.",
    scope: "unknown",
  };
}

export function scoreOpportunityText(text) {
  const lowerText = text.toLowerCase();
  let score = 0;

  const strongSignals = [
    "apply now",
    "applications open",
    "registration open",
    "deadline",
    "internship",
    "research attachment",
    "research assistant",
    "exchange programme",
    "student exchange programme",
    "summer programme",
    "winter programme",
    "study trips",
    "steer",
    "noc",
    "competition",
    "hackathon",
  ];

  const weakSignals = [
    "join us",
    "sign up",
    "register",
    "opportunity",
    "programme",
    "program",
    "career",
    "student",
  ];

  for (const signal of strongSignals) {
    if (lowerText.includes(signal)) score += 2;
  }

  for (const signal of weakSignals) {
    if (lowerText.includes(signal)) score += 1;
  }

  if (extractDeadline(text)) score += 2;
  if (extractFirstUrl(text)) score += 1;

  return score;
}

function detectCategory(text, fallbackCategory = "other", priorityText = "") {
  const lowerPriorityText = priorityText.toLowerCase();
  if (lowerPriorityText) {
    for (const rule of CATEGORY_RULES) {
      if (includesAny(lowerPriorityText, rule.keywords)) return rule.category;
    }
  }

  const lowerText = text.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (includesAny(lowerText, rule.keywords)) return rule.category;
  }

  return fallbackCategory;
}

function hasAllMajorEligibility(text) {
  return /all majors|all disciplines|all faculties|open to all(?: nus)? students|all nus students/i.test(
    text
  );
}

function detectEligibleMajors(text, { requireExplicitEligibility = false } = {}) {
  const lowerText = text.toLowerCase();

  if (requireExplicitEligibility) {
    if (hasAllMajorEligibility(text)) {
      return [];
    }

    const eligibilityStatements = text.match(
      /(?:eligible(?:\s+applicants?)?(?:\s+must be|\s+are)?|open to|only\s+open\s+to|only\s+for|for students\s+(?:from|in)\b)[^.]{0,260}/gi
    );

    if (!eligibilityStatements) return [];

    return detectEligibleMajors(eligibilityStatements.join(" "));
  }

  const majors = new Set();

  for (const rule of MAJOR_RULES) {
    if (includesAny(lowerText, rule.keywords)) {
      majors.add(rule.major);
    }
  }

  return [...majors];
}

function detectMajorEligibility(text, options = {}) {
  if (hasAllMajorEligibility(text)) {
    return { type: "all", majors: [] };
  }

  const majors = detectEligibleMajors(text, options);

  if (majors.length) {
    return {
      type: options.requireExplicitEligibility ? "specific" : "inferred",
      majors,
    };
  }

  return { type: "unknown", majors: [] };
}

function detectYearRange(text, { unknownWhenUnstated = true } = {}) {
  const lowerText = text.toLowerCase();

  if (/all years?|years?\s*1\s*(?:-|to|through)\s*4/.test(lowerText)) {
    return { year_min: 1, year_max: 4, year_eligibility_type: "all" };
  }

  if (/year\s*1\s*(?:-|to|and|&)\s*2/.test(lowerText)) {
    return { year_min: 1, year_max: 2, year_eligibility_type: "specific" };
  }

  if (/year\s*2\s*(?:-|to|and|&)\s*3/.test(lowerText)) {
    return { year_min: 2, year_max: 3, year_eligibility_type: "specific" };
  }

  if (/year\s*3\s*(?:-|to|and|&)\s*4/.test(lowerText)) {
    return { year_min: 3, year_max: 4, year_eligibility_type: "specific" };
  }

  const singleYearMatch = lowerText.match(/year\s*([1-4])/);
  if (singleYearMatch) {
    const year = Number(singleYearMatch[1]);
    return { year_min: year, year_max: year, year_eligibility_type: "specific" };
  }

  if (lowerText.includes("final year")) {
    return { year_min: 4, year_max: 4, year_eligibility_type: "specific" };
  }

  return unknownWhenUnstated
    ? { year_min: null, year_max: null, year_eligibility_type: "unknown" }
    : { year_min: 1, year_max: 4, year_eligibility_type: "inferred" };
}

function detectDeliveryMode(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("hybrid")) return "hybrid";
  if (lowerText.includes("online") || lowerText.includes("zoom") || lowerText.includes("webinar")) {
    return "online";
  }
  if (
    lowerText.includes("in-person") ||
    lowerText.includes("in person") ||
    lowerText.includes("on campus") ||
    lowerText.includes("venue:")
  ) {
    return "in_person";
  }

  return "unspecified";
}

function detectLocation(text, deliveryMode) {
  if (deliveryMode === "online") return null;

  const locationMatch = text.match(/(?:venue|location):\s*([^.\n]+)/i);
  if (locationMatch) return normalizeWhitespace(locationMatch[1]).slice(0, 120);

  if (/nus|on campus|campus/i.test(text)) return "On campus";
  if (/singapore/i.test(text)) return "Singapore";
  if (/overseas|abroad|global|exchange/i.test(text)) return "Overseas";

  return null;
}

function extractDeadline(text) {
  return extractDeadlineDetails(text).deadline;
}

const PROGRAMME_FIELD_LABELS = [
  "Host University Website",
  "Programme Location",
  "Programme Dates",
  "Application Deadline",
  "Application Period",
  "Application Window",
  "Application Dates",
  "No. of Placements",
  "Course Information",
  "Courses Available In",
  "Eligibility Requirements",
  "Eligibility Criteria",
  "Programme Fee",
  "Financial Aid",
  "Estimated Cost of Participation",
  "Application Process",
];

function extractLabeledValue(text, labels) {
  for (const label of labels) {
    const labelPattern = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*`, "i");
    const labelMatch = labelPattern.exec(text);
    if (!labelMatch) continue;

    const remainder = text.slice(labelMatch.index + labelMatch[0].length);
    let endIndex = remainder.length;

    for (const nextLabel of PROGRAMME_FIELD_LABELS) {
      const nextLabelPattern = new RegExp(
        `\\b${escapeRegExp(nextLabel)}\\s*:`,
        "i"
      );
      const nextLabelMatch = nextLabelPattern.exec(remainder);
      if (nextLabelMatch && nextLabelMatch.index < endIndex) {
        endIndex = nextLabelMatch.index;
      }
    }

    return normalizeWhitespace(remainder.slice(0, endIndex))
      .replace(/^[|:-]+|[|:-]+$/g, "")
      .trim()
      .slice(0, 500);
  }

  return "";
}

function extractDeadlineDetails(text) {
  const directDeadline = extractLabeledValue(text, [
    "Application Deadline",
    "Deadline",
    "Apply By",
    "Register By",
    "Closes On",
  ]);
  const applicationPeriod = extractLabeledValue(text, [
    "Application Period",
    "Application Window",
    "Application Dates",
  ]);
  const deadlineText = directDeadline || applicationPeriod;

  if (!deadlineText) {
    return {
      deadline: null,
      deadline_has_time: false,
      deadline_source_timezone: null,
      deadline_source_text: null,
    };
  }

  const deadlineSourceText = formatDeadlineSourceText(deadlineText);
  const parsed = parseDeadlineText(deadlineSourceText, {
    useLastDate: Boolean(applicationPeriod && !directDeadline),
  });

  return {
    deadline: parsed?.deadline || null,
    deadline_has_time: parsed?.hasTime || false,
    deadline_source_timezone: parsed?.sourceTimezone || null,
    deadline_source_text: deadlineSourceText,
  };
}

function formatDeadlineSourceText(text) {
  const normalized = normalizeWhitespace(text).replace(/\b([ap])\./gi, "$1");
  const firstSentence = normalized.match(/^(.+?)(?=[.!?](?:\s|$)|$)/);

  return (firstSentence?.[1] || normalized).trim().slice(0, 240);
}

function parseDeadlineText(text, { useLastDate = false } = {}) {
  const isoTimestampMatch = text.match(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})\b/i
  );
  if (isoTimestampMatch) {
    const date = new Date(isoTimestampMatch[0]);
    if (!Number.isNaN(date.valueOf())) {
      return {
        deadline: date.toISOString(),
        hasTime: true,
        sourceTimezone: isoTimestampMatch[0].endsWith("Z") ? "UTC" : "UTC offset",
      };
    }
  }

  const dateMatches = findCalendarDateMatches(text);
  const selectedDate = useLastDate
    ? [...dateMatches].reverse().find((dateMatch) => parseCalendarDate(dateMatch.value))
    : dateMatches.find((dateMatch) => parseCalendarDate(dateMatch.value));
  const calendarDate = selectedDate && parseCalendarDate(selectedDate.value);

  if (!calendarDate) return null;

  const time = extractClockTime(text.slice(selectedDate.index + selectedDate.value.length));
  const sourceTimezone = extractDeadlineTimeZone(text);

  if (time && sourceTimezone) {
    return {
      deadline: new Date(
        Date.UTC(
          calendarDate.year,
          calendarDate.month,
          calendarDate.day,
          time.hour,
          time.minute,
          time.second
        ) - sourceTimezone.offsetMinutes * 60 * 1000
      ).toISOString(),
      hasTime: true,
      sourceTimezone: sourceTimezone.label,
    };
  }

  return {
    deadline: calendarDateToIso(calendarDate),
    hasTime: Boolean(time),
    sourceTimezone: null,
  };
}

function findCalendarDateMatches(text) {
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}\\b`, "gi"),
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b`, "gi"),
  ];
  const matches = [];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      matches.push({ value: match[0], index: match.index });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

function extractClockTime(text) {
  const match = text.match(
    /\b(?:at\s+)?(\d{1,2})(?::|\.)(\d{2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\b/i
  );
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridiem = match[4]?.replace(/\./g, "").toLowerCase();

  if (minute > 59 || second > 59 || hour > 23) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return { hour, minute, second };
}

function extractDeadlineTimeZone(text) {
  const offsetMatch = text.match(/\b(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\b/i);
  if (offsetMatch) {
    const [, sign, hours, minutes = "0"] = offsetMatch;
    const offsetMinutes = Number(hours) * 60 + Number(minutes);

    return {
      label: `UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      offsetMinutes: sign === "+" ? offsetMinutes : -offsetMinutes,
    };
  }

  return DEADLINE_TIME_ZONES.find((timeZone) => timeZone.pattern.test(text)) || null;
}

function parseCalendarDate(value) {
  const normalized = value.trim().replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return {
      year: Number(year),
      month: Number(month) - 1,
      day: Number(day),
    };
  }

  const dayFirstMatch = normalized.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const monthFirstMatch = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  const match = dayFirstMatch || monthFirstMatch;

  if (!match) return null;

  const [, first, second, year] = match;
  const day = dayFirstMatch ? Number(first) : Number(second);
  const monthName = (dayFirstMatch ? second : first).toLowerCase();
  const month = MONTH_NUMBERS[monthName];

  if (month === undefined) return null;

  return { year: Number(year), month, day };
}

function calendarDateToIso({ year, month, day }) {
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function extractFirstUrl(text) {
  const match = text.match(/https?:\/\/[^\s)"'<>]+/i);
  return match ? cleanExtractedUrl(match[0]) : null;
}

function cleanExtractedUrl(url) {
  return url.replace(/[.,;:!?\]}]+$/, "");
}

function extractApplicationUrl(text) {
  const match = text.match(
    /(?:apply(?:\s+(?:here|now|online))?|application(?:\s+(?:form|link|portal|website))?|register(?:\s+(?:here|now|online))?|registration(?:\s+(?:form|link|portal|website))?)\s*(?:at|through|via|:|-)?\s*(https?:\/\/[^\s)"'<>]+)/i
  );

  return match ? cleanExtractedUrl(match[1]) : null;
}

function extractApplicationUrlFromHtml(html = "") {
  const anchorPattern = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const label = stripHtml(match[2]).toLowerCase();
    const url = cleanExtractedUrl(match[1]);

    if (/\b(?:apply|application|register|registration)\b/.test(`${label} ${url}`)) {
      return url;
    }
  }

  return null;
}

function normalizeIsoTimestamp(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function addDaysToIsoTimestamp(value, days) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.valueOf())) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function createContentHash(text) {
  return createHash("sha256").update(normalizeWhitespace(text)).digest("hex");
}

function hasSpecificTitle(title) {
  const normalizedTitle = cleanTitle(title).toLowerCase();

  return Boolean(
    normalizedTitle &&
      ![
        "application",
        "applications open",
        "opportunity",
        "programme",
        "program",
        "untitled opportunity",
      ].includes(normalizedTitle)
  );
}

function hasKnownOrganisation(organisation) {
  return Boolean(
    organisation &&
      !["unknown", "unknown organisation", "not stated"].includes(
        organisation.trim().toLowerCase()
      )
  );
}

function hasExplicitYearRequirement(text) {
  return /\b(?:year\s*[1-4]|final year|all years?)\b/i.test(text);
}

function buildReviewReasons({
  title,
  organisation,
  category,
  sourceUrl,
  applicationUrl,
  deadline,
  sourcePublishedAt,
  yearRequirementsStated,
  majorEligibilityType,
}) {
  const reasons = [];

  if (!hasSpecificTitle(title)) reasons.push("generic_title");
  if (!hasKnownOrganisation(organisation)) reasons.push("missing_organisation");
  if (category === "other") reasons.push("unclear_category");
  if (!sourceUrl) reasons.push("missing_source_url");
  if (!applicationUrl) reasons.push("missing_application_url");
  if (!deadline) reasons.push("missing_deadline");
  if (!sourcePublishedAt) reasons.push("missing_source_published_at");
  if (!yearRequirementsStated) {
    reasons.push("year_requirements_not_stated");
  }
  if (majorEligibilityType === "unknown") {
    reasons.push("major_requirements_not_stated");
  }

  return reasons;
}

function calculateConfidenceScore({
  title,
  organisation,
  category,
  sourceUrl,
  applicationUrl,
  deadline,
  eligibility,
  sourcePublishedAt,
  yearRequirementsStated,
  contentHash,
}) {
  let score = 0;

  if (hasSpecificTitle(title)) score += 15;
  if (hasKnownOrganisation(organisation)) score += 10;
  if (category !== "other") score += 10;
  if (sourceUrl) score += 10;
  if (applicationUrl) score += 15;
  if (deadline) score += 15;
  if (eligibility) score += 10;
  if (yearRequirementsStated) score += 5;
  if (sourcePublishedAt) score += 5;
  if (contentHash) score += 5;

  return score;
}

function inferOrganisation(email) {
  const senderName = email.from?.emailAddress?.name;
  const senderEmail = email.from?.emailAddress?.address;

  if (senderName) return senderName;
  if (!senderEmail) return "Unknown organisation";

  return senderEmail.split("@")[1]?.split(".")[0] || senderEmail;
}

function buildDescription(text) {
  const cleaned = normalizeWhitespace(text);
  if (cleaned.length <= 260) return cleaned;

  return `${cleaned.slice(0, 257).trim()}...`;
}

function cleanTitle(subject) {
  return normalizeWhitespace(
    subject
      .replace(/^(fw|fwd|re):\s*/i, "")
      .replace(/\[[^\]]+\]/g, "")
  );
}

function extractHostOrganisation(title, text) {
  const explicitHostMatch = text.match(
    /(?:Host|Partner) University\s*:(?!\s*Website\b)([\s\S]{1,240})/i
  );
  if (explicitHostMatch) {
    const explicitHost = normalizeWhitespace(explicitHostMatch[1]).split(
      /\b(?:Host University Website|Programme Location|Programme Dates|Application (?:Deadline|Period|Window|Dates))\s*:/i
    )[0].trim();

    if (explicitHost && !/^https?:\/\//i.test(explicitHost)) {
      return explicitHost;
    }
  }

  const normalisedTitle = cleanTitle(title);
  const universityOfMatch = normalisedTitle.match(
    /^(University of [A-Za-z&.' -]+?)(?=\s+(?:\(|School|International|Global|Winter|Summer|Short-Term|Programme|Program|Session)|$)/i
  );
  if (universityOfMatch) return universityOfMatch[1].trim();

  const universitySuffixMatch = normalisedTitle.match(
    /^([A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]*){0,5}\s+University)\b/
  );
  if (universitySuffixMatch) return universitySuffixMatch[1].trim();

  return "";
}

function extractRequirementSnippets(text) {
  const patterns = [
    /NUS(?:'|’)?\s+generic eligibility requirements apply[^.]{0,260}\.?/i,
    /NUS students should apply[^.]{0,260}\.?/i,
    /You must apply concurrently[^.]{0,260}\.?/i,
    /The programme period overlaps[^.]{0,260}\.?/i,
    /All participants must[^.]{0,260}\.?/i,
    /Applicants must[^.]{0,260}\.?/i,
    /Participants must[^.]{0,260}\.?/i,
    /Students must[^.]{0,260}\.?/i,
  ];
  const snippets = [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) snippets.push(normalizeWhitespace(match[0]));
  }

  return [...new Set(snippets)];
}

function buildProgrammeDescription({ title, organisation, location, dates, courseInfo }) {
  const details = [];
  const host = organisation || "a partner university";

  details.push(`${cleanTitle(title)} at ${host}.`);
  if (location) details.push(`Location: ${location}.`);
  if (dates) details.push(`Programme dates: ${dates}.`);

  if (courseInfo && !/^https?:\/\//i.test(courseInfo)) {
    details.push(`Course information: ${courseInfo.slice(0, 220)}.`);
  }

  return details.join(" ").slice(0, 700);
}

function getProgrammeDetailOverrides(document, fallbackEligibility) {
  if (!document.programmeDetails) return {};

  const location = extractLabeledValue(document.text, ["Programme Location"]);
  const dates = extractLabeledValue(document.text, ["Programme Dates"]);
  const courseInfo = extractLabeledValue(document.text, [
    "Courses Available In",
    "Course Information",
  ]);
  const organisation =
    extractHostOrganisation(document.title, document.text) || document.sourceName;
  const requirements = extractRequirementSnippets(document.text);
  const deliveryMode = /information on this page is for (?:the )?(?:on-site|onsite|in-person)/i.test(
    document.text
  )
    ? "in_person"
    : /information on this page is for (?:the )?online/i.test(document.text)
      ? "online"
      : undefined;

  return {
    organisation: organisation || undefined,
    location: location || undefined,
    description: buildProgrammeDescription({
      title: document.title || document.sourceName,
      organisation,
      location,
      dates,
      courseInfo,
    }),
    eligibility: requirements.length ? requirements.join(" ") : fallbackEligibility,
    deliveryMode,
    requireExplicitMajorEligibility: true,
    unknownYearWhenUnstated: true,
  };
}

const NUS_INTERNAL_DEADLINE_SIGNALS = [
  /\bnus (?:application|internal) deadline\b/i,
  /\binternal application deadline\b/i,
  /\bapply (?:directly )?(?:through|via|to) nus\b/i,
  /\bsubmit (?:the )?(?:application|particulars) to nus\b/i,
  /\bnus students? must apply by\b/i,
];

function isNusEmailAddress(address) {
  return /@(?:[a-z0-9-]+\.)*nus\.edu\.sg$/i.test(address || "");
}

function isNusWebUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "nus.edu.sg" || hostname.endsWith(".nus.edu.sg");
  } catch {
    return false;
  }
}

function determineDeadlineSource({
  deadline,
  sourceType,
  sourceUrl,
  rawSender,
  text,
  override,
}) {
  if (!deadline) return null;
  if (override === "nus" || override === "organiser") return override;

  if (sourceType === "public_web" && isNusWebUrl(sourceUrl)) {
    return "nus";
  }

  if (
    sourceType === "outlook_email" &&
    (isNusEmailAddress(rawSender) ||
      NUS_INTERNAL_DEADLINE_SIGNALS.some((signal) => signal.test(text)))
  ) {
    return "nus";
  }

  return "organiser";
}

export function parseTextToOpportunityCandidate({
  sourceType,
  sourceId,
  sourceUrl,
  rawTitle = "",
  rawSender = "",
  receivedAt = null,
  title = "Untitled opportunity",
  descriptionText = "",
  fullText = "",
  organisation = "Unknown organisation",
  schoolSlug = "nus",
  defaultCategory = "other",
  sourcePriority = 99,
  scoreBoost = 0,
  requiresNusStudentEligibility = true,
  trustedForNusStudents = false,
  minScore = 4,
  organisationOverride,
  descriptionOverride,
  eligibilityOverride,
  locationOverride,
  deadlineOverride,
  deadlineHasTimeOverride,
  deadlineSourceTimezoneOverride,
  deadlineSourceTextOverride,
  deadlineSourceOverride,
  deliveryModeOverride,
  applicationUrlOverride,
  sourcePublishedAt = null,
  lastSeenAt = null,
  requireExplicitMajorEligibility = false,
  unknownYearWhenUnstated = true,
  ownerUserId = null,
  hostCountry = null,
}) {
  const text = normalizeWhitespace(
    [title, descriptionText, fullText].filter(Boolean).join(" ")
  );

  if (hasClosedApplicationSignal(text)) return null;

  if (
    sourceType === "public_web" &&
    isHistoricalPublicWebPage({ sourceUrl, title, descriptionText, fullText })
  ) {
    return null;
  }

  const candidateScore = scoreOpportunityText(text) + scoreBoost;

  if (candidateScore < minScore) {
    return null;
  }

  const eligibilityAssessment = assessNusStudentEligibility(text, {
    hostCountry,
    sourceUrl,
    trustedForNusStudents,
  });

  if (requiresNusStudentEligibility && !eligibilityAssessment.eligible) {
    return null;
  }

  const category = detectCategory(text, defaultCategory, title);
  const deliveryMode = deliveryModeOverride || detectDeliveryMode(text);
  const yearRange = detectYearRange(text, { unknownWhenUnstated: unknownYearWhenUnstated });
  const majorEligibility = detectMajorEligibility(text, {
    requireExplicitEligibility: requireExplicitMajorEligibility,
  });
  const deadlineDetails = extractDeadlineDetails(text);
  const resolvedTitle = cleanTitle(title);
  const resolvedOrganisation = organisationOverride || organisation;
  const resolvedSourceUrl = sourceUrl || extractFirstUrl(text);
  const applicationUrl = applicationUrlOverride || extractApplicationUrl(text);
  const deadline = deadlineOverride ?? deadlineDetails.deadline;
  const deadlineSource = determineDeadlineSource({
    deadline,
    sourceType,
    sourceUrl: resolvedSourceUrl,
    rawSender,
    text,
    override: deadlineSourceOverride,
  });

  if (!applicationUrl && !deadline) {
    return null;
  }

  const eligibility = eligibilityOverride || eligibilityAssessment.reason;
  const normalizedPublishedAt = normalizeIsoTimestamp(sourcePublishedAt);
  const normalizedLastSeenAt = normalizeIsoTimestamp(lastSeenAt) || new Date().toISOString();
  const listingExpiresAt = !deadline && applicationUrl
    ? addDaysToIsoTimestamp(normalizedLastSeenAt, 60)
    : null;
  const contentHash = createContentHash(text);
  const yearRequirementsStated = hasExplicitYearRequirement(text);
  const confidenceScore = calculateConfidenceScore({
    title: resolvedTitle,
    organisation: resolvedOrganisation,
    category,
    sourceUrl: resolvedSourceUrl,
    applicationUrl,
    deadline,
    eligibility,
    sourcePublishedAt: normalizedPublishedAt,
    yearRequirementsStated,
    contentHash,
  });
  const reviewReasons = buildReviewReasons({
    title: resolvedTitle,
    organisation: resolvedOrganisation,
    category,
    sourceUrl: resolvedSourceUrl,
    applicationUrl,
    deadline,
    sourcePublishedAt: normalizedPublishedAt,
    yearRequirementsStated,
    majorEligibilityType: majorEligibility.type,
  });

  const visibilityDecision = getOpportunityVisibilityDecision({
    majorEligibilityType: majorEligibility.type,
    ownerUserId,
    sourceType,
  });
  reviewReasons.push(...visibilityDecision.reasons);

  const opportunity = {
    school_slug: schoolSlug,
    source_priority: sourcePriority,
    title: resolvedTitle,
    description: descriptionOverride || buildDescription(descriptionText || fullText || text),
    category,
    organisation: resolvedOrganisation,
    source_url: resolvedSourceUrl,
    application_url: applicationUrl,
    source_published_at: normalizedPublishedAt,
    last_seen_at: normalizedLastSeenAt,
    content_hash: contentHash,
    confidence_score: confidenceScore,
    eligibility,
    eligibility_scope: eligibilityAssessment.scope,
    host_country: eligibilityAssessment.hostCountry,
    ...yearRange,
    eligible_majors: majorEligibility.majors,
    major_eligibility_type: majorEligibility.type,
    delivery_mode: deliveryMode,
    location: locationOverride || detectLocation(text, deliveryMode),
    deadline,
    deadline_has_time: deadlineHasTimeOverride ?? deadlineDetails.deadline_has_time,
    deadline_source_timezone:
      deadlineSourceTimezoneOverride ?? deadlineDetails.deadline_source_timezone,
    deadline_source_text: deadlineSourceTextOverride ?? deadlineDetails.deadline_source_text,
    deadline_source: deadlineSource,
    external_deadline: null,
    external_deadline_has_time: false,
    external_deadline_source_timezone: null,
    external_deadline_source_text: null,
    deadline_conflict: false,
    deadline_note: null,
    listing_expires_at: listingExpiresAt,
    visibility: visibilityDecision.visibility,
    owner_user_id: visibilityDecision.ownerUserId,
    mailbox_owner_user_id: sourceType === "outlook_email" ? ownerUserId : null,
  };
  const dedupeKey = scopeOpportunityDedupeKey(
    buildOpportunityDedupeKey(opportunity),
    visibilityDecision.visibility,
    visibilityDecision.ownerUserId
  );
  opportunity.dedupe_key = dedupeKey;

  const extractionEvidence = {
    application_url: applicationUrl,
    category,
    deadline: opportunity.deadline_source_text,
    deadline_source: deadlineSource,
    eligibility: eligibilityAssessment.reason,
    eligibility_scope: eligibilityAssessment.scope,
    host_country: eligibilityAssessment.hostCountry,
    major_eligibility_type: majorEligibility.type,
    organisation: resolvedOrganisation,
    source_url: resolvedSourceUrl,
    year_eligibility_type: yearRange.year_eligibility_type,
  };
  const candidate = {
    school_slug: schoolSlug,
    source_type: sourceType,
    source_message_id: sourceId || sourceUrl || null,
    source_url: resolvedSourceUrl,
    application_url: applicationUrl,
    raw_subject: rawTitle,
    raw_sender: rawSender,
    received_at: receivedAt,
    source_published_at: normalizedPublishedAt,
    last_seen_at: normalizedLastSeenAt,
    content_hash: contentHash,
    source_priority: sourcePriority,
    candidate_score: candidateScore,
    confidence_score: confidenceScore,
    review_reasons: reviewReasons,
    dedupe_key: dedupeKey,
    extraction_evidence: extractionEvidence,
    visibility: visibilityDecision.visibility,
    owner_user_id: visibilityDecision.ownerUserId,
    status: "pending",
    opportunity,
  };
  const publicationDecision = getAutomaticPublicationDecision(candidate);

  candidate.auto_publish_eligible = publicationDecision.eligible;
  candidate.auto_publish_reasons = publicationDecision.reasons;

  return candidate;
}

export function parseEmailToOpportunityCandidate(email, options = {}) {
  const text = getEmailText(email);
  const messageIdentity = email.internetMessageId || email.id || null;
  const htmlApplicationUrl =
    email.body?.contentType?.toLowerCase() === "html"
      ? extractApplicationUrlFromHtml(email.body.content)
      : null;

  return parseTextToOpportunityCandidate({
    sourceType: "outlook_email",
    sourceId: messageIdentity && options.sourceIdentityPrefix
      ? `${options.sourceIdentityPrefix}:${messageIdentity}`
      : messageIdentity,
    sourceUrl: htmlApplicationUrl || extractFirstUrl(text) || email.webLink,
    rawTitle: email.subject || "",
    rawSender: email.from?.emailAddress?.address || "",
    receivedAt: email.receivedDateTime || null,
    sourcePublishedAt: email.receivedDateTime || null,
    lastSeenAt: new Date().toISOString(),
    title: email.subject || "Untitled opportunity",
    descriptionText: getEmailBodyText(email),
    fullText: text,
    organisation: inferOrganisation(email),
    schoolSlug: options.schoolSlug || "nus",
    defaultCategory: options.defaultCategory || "other",
    sourcePriority: options.sourcePriority ?? 99,
    requiresNusStudentEligibility: options.requiresNusStudentEligibility ?? true,
    trustedForNusStudents: options.trustedForNusStudents || false,
    applicationUrlOverride: htmlApplicationUrl,
    requireExplicitMajorEligibility: true,
    ownerUserId: options.ownerUserId || null,
  });
}

export function parseEmailsToOpportunityCandidates(emails, options = {}) {
  return emails
    .map((email) => parseEmailToOpportunityCandidate(email, options))
    .filter(Boolean);
}

export function parseWebDocumentToOpportunityCandidate(document) {
  const fallbackEligibility = document.trustedForNusStudents
    ? "Trusted NUS student source."
    : "Eligibility is stated on the source page.";
  const detailOverrides = getProgrammeDetailOverrides(document, fallbackEligibility);

  return parseTextToOpportunityCandidate({
    sourceType: "public_web",
    sourceId: document.id,
    sourceUrl: document.url,
    rawTitle: document.title,
    rawSender: document.sourceName,
    receivedAt: document.fetchedAt,
    sourcePublishedAt: document.publishedAt,
    lastSeenAt: document.fetchedAt,
    title: document.title || document.sourceName,
    descriptionText: document.summary || document.text,
    fullText: document.text,
    organisation: document.sourceName,
    schoolSlug: document.school || "nus",
    defaultCategory: document.defaultCategory || "other",
    sourcePriority: document.sourcePriority ?? 99,
    scoreBoost: document.sourceTrustBoost || 0,
    requiresNusStudentEligibility: document.requiresNusStudentEligibility ?? true,
    trustedForNusStudents: document.trustedForNusStudents || false,
    minScore: document.minScore ?? 5,
    organisationOverride: detailOverrides.organisation,
    descriptionOverride: detailOverrides.description,
    eligibilityOverride: detailOverrides.eligibility,
    locationOverride: detailOverrides.location,
    deliveryModeOverride: detailOverrides.deliveryMode,
    applicationUrlOverride: document.applicationUrl,
    requireExplicitMajorEligibility:
      detailOverrides.requireExplicitMajorEligibility || false,
    unknownYearWhenUnstated: detailOverrides.unknownYearWhenUnstated ?? true,
    hostCountry: document.hostCountry || null,
  });
}

export function parseWebDocumentsToOpportunityCandidates(documents) {
  return documents
    .map((document) => parseWebDocumentToOpportunityCandidate(document))
    .filter(Boolean);
}
