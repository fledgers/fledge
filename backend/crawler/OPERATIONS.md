# Crawler Operations

## Migration order

Run the dated migrations in `backend/database/migrations` in phase-number
order. The Phase 3 through Phase 6 migrations require the Phase 1 quality
fields and the Phase 2 idempotent ingestion function to exist first. For the
2026-07-16 files, run Phase 9, Phase 10, Phase 11, Phase 12, then Phase 13;
alphabetical filename sorting is not the intended database order.

Phase 12 installs a Supabase Auth trigger that creates a `profiles` row for
each new account and backfills accounts that already exist. Run it after Phase
11 in the Supabase SQL Editor.

Phase 13 adds per-student Outlook connection records, one-time OAuth state,
encrypted refresh-token storage through Supabase Vault, and the RPC functions
used by the Edge Functions and crawler. Run it after Phase 12, then reload the
Data API schema:

```sql
notify pgrst, 'reload schema';
```

## Local commands

```bash
npm run crawl:demo
npm run crawl:web
npm run crawl:discover
npm run crawl:nus
npm run crawl:outlook
npm run crawl:all
npm run outlook:authorize
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

## Hosted student Outlook connection

Fledge now treats sign-in and Outlook permission as two separate decisions:

1. Supabase Auth identifies the Fledge student account.
2. The `/outlook` page asks whether that student wants to connect Outlook.
3. The student may connect Outlook or continue without it.
4. Connecting invokes the hosted `outlook-authorize` Edge Function.
5. Microsoft redirects to the hosted `outlook-callback` Edge Function.
6. The callback stores the refresh token in Supabase Vault under that student's
   user ID. The token is never returned to the browser.
7. A saved crawler run reads all connected mailboxes through the service-role
   RPC and records success or failure separately for each mailbox.

The Microsoft permission request contains `User.Read`, `Mail.Read`, and
`offline_access`. `Mail.Read` permits reading the connected mailbox;
`offline_access` permits Microsoft to issue a refresh token so scheduled crawls
can run after the student closes Fledge. Fledge does not ask for `Mail.Send`.

The production Microsoft **Web** redirect URI is:

```text
https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/outlook-callback
```

This is a backend callback, not a page students browse directly. After storing
the connection it sends the browser back to `FRONTEND_URL/outlook`.

`npm run outlook:authorize` and `MICROSOFT_SETUP_REDIRECT_URI` remain available
only as a legacy local test for one mailbox. They are not needed by the hosted
student flow and their refresh token should not be added to GitHub Actions. A
saved crawl never falls back to this environment token.

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

Outlook candidates currently remain pending for review. Explicitly all-major
Outlook opportunities can later be published publicly; restricted, inferred,
or unstated-major opportunities remain private to the mailbox owner.

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

For hosted Outlook crawling, also add:

```text
MICROSOFT_CLIENT_ID
MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_SECRET
```

Do not add a student's refresh token to GitHub. Phase 13 stores each token in
Supabase Vault and the workflow uses `SUPABASE_SECRET_KEY` to request the
connected mailbox list when the crawler starts.

During the testing stage, the scheduled workflow runs public-web and connected
Outlook crawling at 03:17 Singapore time on every second calendar day. A manual
workflow run can turn Outlook crawling off with the `include_outlook` option.

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

Apply `20260716_phase13_add_student_outlook_connections.sql` to replace the
single shared-mailbox setup with per-student, encrypted connections.

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

## Conflicting NUS and host deadlines

Apply `20260716_phase11_add_deadline_source_reconciliation.sql` after Phase 10.
The parser marks deadlines from official NUS pages and NUS email senders as
`nus`; deadlines from external websites and external email senders are marked
as `organiser`.

The publication wrapper may join two differently sourced records only when the
normalised title, organisation, category, school, and visibility match and the
two deadlines are no more than 90 days apart. Existing dedupe keys are still
checked first. This narrow fallback is intended for the same application cycle,
not for similarly named opportunities or the next yearly intake.

When linked sources disagree, `opportunities.deadline` stores the NUS internal
deadline and therefore controls `active_opportunities`, expiry, and the 15-day
retention period. The host date is retained in `external_deadline`, and
`deadline_conflict` is set to `true`. The frontend then shows both dates and
tells students to use the NUS deadline when applying through NUS.

## Netlify frontend deployment

`netlify.toml` tells Netlify to run `npm run build`, publish the generated
`dist` folder, and send application routes such as `/profile` and
`/reset-password` to `index.html` so React Router can open them directly.

In the existing Netlify site, add these variables under the site's environment
variable settings and trigger a new deployment:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Use the Supabase project base URL and publishable key. Do not add the Supabase
secret key to Netlify. In Supabase Authentication URL Configuration, set the
Netlify site URL as the Site URL and allow the deployed `/explore` and
`/reset-password` callback URLs. Also allow `/outlook`, because a student who
signs in while connecting Outlook must return to that page.

The `Verify application` GitHub workflow runs lint, automated tests, and a
production build for every pull request and every push to `main`. Add the same
two public Vite values as GitHub Actions secrets so that CI builds with the
deployed configuration.

## Deploying student Outlook consent

Repository code cannot change settings inside your Supabase, Microsoft Azure,
Netlify, or GitHub accounts. Complete these steps after Phase 13 succeeds.

### 1. Configure the Microsoft app

In Azure Portal, open **Microsoft Entra ID**, **App registrations**, then the
Fledge registration.

1. Open **Authentication** under **Manage**.
2. Add a **Web** platform if one does not exist.
3. Add both exact redirect URIs:

   ```text
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback
   https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/outlook-callback
   ```

   The first URI is only for **Continue with NUS Email** through Supabase Auth.
   The second URI is only for granting Outlook mailbox access.

4. Under **API permissions**, add delegated Microsoft Graph permissions
   `User.Read` and `Mail.Read`.
5. Keep the supported account type compatible with NUS organisational
   accounts. NUS may require administrator consent before student mailboxes can
   grant `Mail.Read`.

### 2. Configure Supabase Auth

In Supabase, open **Authentication**, **Providers**, then **Azure (Microsoft)**.
Enter the Azure client ID and client secret. Use the `organizations` tenant URL
for a multi-tenant app unless Microsoft or NUS tells you to restrict the app to
one tenant.

In **Authentication**, **URL Configuration**:

1. Set **Site URL** to the deployed Fledge website.
2. Add the deployed `/outlook`, `/explore`, and `/reset-password` URLs to the
   allowed redirect list.

### 3. Configure and deploy Edge Functions

In Supabase **Edge Functions**, add these project secrets:

```text
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_AUTHORITY_TENANT=organizations
MICROSOFT_OUTLOOK_REDIRECT_URI=https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/outlook-callback
FRONTEND_URL=https://YOUR_FLEDGE_WEBSITE
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied to hosted Edge
Functions by Supabase. Do not create `VITE_` copies of either Microsoft secret.

The Supabase CLI is not installed in this repository. From the project root,
use `npx`:

```bash
npx supabase login
npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase functions deploy outlook-authorize
npx supabase functions deploy outlook-callback
npx supabase functions deploy outlook-status
npx supabase functions deploy outlook-disconnect
```

`supabase/config.toml` requires a user JWT for all functions except the
Microsoft callback. The callback is public because Microsoft cannot send a
Fledge JWT, but it still validates a short-lived, one-use OAuth state and PKCE
verifier before accepting an authorization code.

### 4. Test the complete flow

1. Open the deployed Fledge website in a private browser window.
2. Confirm that Fledge asks whether to connect Outlook before Explore opens.
3. Test **Continue without Outlook**.
4. Sign in, return to `/outlook`, and select **Connect Outlook**.
5. Accept Microsoft consent and confirm the browser returns to Fledge showing
   the connected Microsoft account.
6. In Supabase SQL Editor, check safe connection metadata:

   ```sql
   select user_id, status, microsoft_email, connected_at, last_crawled_at
   from public.outlook_connections;
   ```

7. Run `npm run crawl:all -- --save` in the VS Code terminal. Check that
   `last_crawled_at` changes and that candidates have the correct owner UUID.
8. Test **Disconnect Outlook**. The connection token and that student's private
   Outlook-derived records should be removed.

Phase 13 also guards against a disconnect happening during a scheduled crawl.
Late crawler results cannot reactivate the deleted connection or insert new
records from that disconnected mailbox. Public opportunities that had already
been shared from that mailbox remain public; private records are removed.

Before inviting real students, publish a privacy policy explaining mailbox
access and data retention, obtain any permission required by NUS, and complete
Microsoft publisher or administrator approval if the tenant requires it.

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
