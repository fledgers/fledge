# Crawler Operations

## Migration order

Run every migration in `backend/database/migrations` in filename order. The
Phase 3 through Phase 6 migrations require the Phase 1 quality fields and the
Phase 2 idempotent ingestion function to exist first.

## Local commands

```bash
npm run crawl:demo
npm run crawl:web
npm run crawl:discover
npm run crawl:nus
npm run crawl:outlook
npm run crawl:all
```

Add `-- --save` to persist results in Supabase:

```bash
npm run crawl:web -- --save
```

`crawl:web` combines the fixed source list with broad web discovery when
`TAVILY_API_KEY` is configured. `crawl:discover` runs only broad discovery.
The discovery client uses eight NUS/student-focused searches per run and sends
the returned pages through the normal eligibility, quality, expiry, and
deduplication pipeline.

Saved crawls now perform this sequence:

1. Start a `crawler_runs` record.
2. Expire pending candidates whose deadlines or rolling windows passed.
3. Delete opportunities and candidates that have been expired for 15 days.
4. Insert or refresh candidates by stable source identity.
5. Record a version when a source content hash changes.
6. Synchronize changed candidates that were already approved.
7. Auto-publish eligible public-web candidates.
8. Finish the run record with counts and source errors.

## Automatic publication policy

Public-web candidates can publish automatically when all of these are true:

- Confidence is at least 75 for priority-1 NUS sources or 95 for other sources.
- The title, organisation, category, and source URL are present.
- Either an active deadline exists, or there is a usable-looking application
  URL and a fixed 60-day rolling window.
- External sources include a direct application URL.
- The deadline or rolling window is still active.

This means a known external source or broad-discovery result can auto-publish
at confidence `95` or above; automatic publication is not limited to NUS
websites. External results below `95` remain pending for review. Outlook email
candidates never use this public-web auto-publication path.

An opportunity with no deadline and no application URL is not a publishable
opportunity. When an application URL exists but no deadline is stated, the
crawler sets `listing_expires_at` to 60 days after first discovery. The Phase 8
database trigger preserves that original timestamp during repeated crawls, so
the listing does not remain online forever just because its source is revisited.

For this policy, a "usable-looking" application URL means a valid HTTP(S) URL
was extracted and the source does not contain an explicit closed/cancelled
signal. The crawler does not submit third-party forms and therefore cannot
guarantee that a final form submission will succeed.

Outlook candidates always remain pending for review. This is intentional until
the product has an explicit mailbox consent, retention, and sharing policy.

## External student eligibility

An external opportunity does not have to name NUS. It can pass the student
eligibility check when the source clearly states any of the following:

- NUS, Singapore, university, tertiary, or undergraduate students are eligible.
- The stated university year range includes Years 1 to 4.
- The stated age range overlaps the usual university range of 18 to 25.
- Applications are worldwide, global, open to all nationalities, or explicitly
  welcome international students.

The host being outside Singapore does not reject an opportunity. For example,
an iGEM opportunity hosted overseas remains eligible when applications are
worldwide. The crawler rejects an opportunity only when the source explicitly
limits applicants to another country's citizens, residents, students, or
institutions. `Domestic students only` and `local students only` are also
rejected when the host country is known to be outside Singapore.

Restriction checks run before broad student or global wording. This prevents a
page containing both `open to university students` and `American students
only` from being accepted. Generic `youth` wording by itself is not enough to
prove that NUS students may apply.

## Unknown eligibility

Unknown or inferred major/year eligibility is not used as a hard filter. The
opportunity remains visible to every student, but the frontend shows a `Check
eligibility` badge and asks the student to verify their major and year on the
official source. Only explicitly stated `specific` eligibility removes an
opportunity from a student's filtered results.

## GitHub Actions secrets

For scheduled public-web crawling, add these repository Actions secrets:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
TAVILY_API_KEY
```

For manually triggered Outlook crawling, also add:

```text
MICROSOFT_CLIENT_ID
MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_SECRET
OUTLOOK_REFRESH_TOKEN
OUTLOOK_OWNER_USER_ID
```

`OUTLOOK_OWNER_USER_ID` is the Supabase `auth.users.id` UUID belonging to the
mailbox refresh token. For the current single-mailbox MVP it is an environment
variable; a multi-user version should store each encrypted refresh token with
its owner UUID in the database.

The scheduled workflow runs public-web crawling every six hours in the
`Asia/Singapore` timezone. Outlook is available only through the workflow's
manual `include_outlook` option.

Outlook candidates use source priority `0`, NUS websites use `1`, known
external sources use `3`, and broad discovery uses `4`. Outlook is collected
and ranked first, but it still requires review before shared publication.

Outlook visibility is conservative:

- Explicitly open to all majors: public after approval.
- Explicitly restricted, inferred, or unstated majors: private to the mailbox
  owner after approval.
- A private candidate with no valid owner UUID cannot be published.

Apply `20260715_phase7_add_outlook_visibility.sql` before relying on this rule.
Its row-level security policies, rather than the frontend, prevent other users
from selecting private opportunities.

Apply `20260715_phase8_add_rolling_opportunity_expiration.sql` to enforce the
60-day rolling rule in Supabase and update `active_opportunities`.

Apply `20260716_phase9_add_15_day_expired_retention.sql` to retain expired
opportunities for 15 days and then delete them. Explore reads only
`active_opportunities`; Saved can continue reading bookmarked rows from
`opportunities` during the retention window. Deleting an opportunity also
deletes its `saved_opportunities` rows through the existing foreign-key cascade.
The cleanup RPC runs during every saved crawler run.

## Student opportunity reports

Apply `20260716_phase10_add_opportunity_reporting.sql` before enabling the
frontend report action. The Vite frontend also needs these public environment
variables in Netlify (and in the root `.env` for local frontend development):

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Never use `SUPABASE_SECRET_KEY` in a `VITE_` variable. The report form uses the
student's Supabase session and Row Level Security. Students can insert reports
only under their own user ID, report only opportunities they can view, and read
only reports they submitted. A partial unique index permits only one pending or
reviewing report from the same student for the same opportunity.

A report does not automatically hide an opportunity. Review pending reports in
the Supabase SQL editor with:

```sql
select
  report.id,
  report.reason,
  report.details,
  report.created_at,
  opportunity.title,
  opportunity.source_url
from public.opportunity_reports as report
join public.opportunities as opportunity
  on opportunity.id = report.opportunity_id
where report.status = 'pending'
order by report.created_at;
```

After checking the official source, update the report to `resolved` or
`dismissed` and set `resolved_at = now()`. Use the service role from trusted
backend code or the Supabase SQL editor for administrator actions.

## Monitoring queries

Recent crawler runs:

```sql
select *
from public.crawler_runs
order by started_at desc
limit 20;
```

Candidates needing review:

```sql
select
  id,
  confidence_score,
  review_reasons,
  auto_publish_reasons,
  source_url
from public.opportunity_candidates
where status = 'pending'
order by confidence_score desc;
```

Source history for an opportunity:

```sql
select *
from public.opportunity_sources
where opportunity_id = 'replace-with-opportunity-uuid'
order by first_seen_at;
```
