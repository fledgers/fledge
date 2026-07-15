# Crawler Operations

## Migration order

Run every migration in `backend/database/migrations` in filename order. The
Phase 3 through Phase 6 migrations require the Phase 1 quality fields and the
Phase 2 idempotent ingestion function to exist first.

## Local commands

```bash
npm run crawl:demo
npm run crawl:web
npm run crawl:nus
npm run crawl:outlook
npm run crawl:all
```

Add `-- --save` to persist results in Supabase:

```bash
npm run crawl:web -- --save
```

Saved crawls now perform this sequence:

1. Start a `crawler_runs` record.
2. Expire pending candidates whose deadlines passed.
3. Insert or refresh candidates by stable source identity.
4. Record a version when a source content hash changes.
5. Synchronize changed candidates that were already approved.
6. Auto-publish eligible public-web candidates.
7. Finish the run record with counts and source errors.

## Automatic publication policy

Public-web candidates can publish automatically when all of these are true:

- Confidence is at least 75 for priority-1 NUS sources or 95 for other sources.
- The title, organisation, category, source URL, and deadline are present.
- External sources include a direct application URL.
- The deadline is still active.

Outlook candidates always remain pending for review. This is intentional until
the product has an explicit mailbox consent, retention, and sharing policy.

## GitHub Actions secrets

For scheduled public-web crawling, add these repository Actions secrets:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

For manually triggered Outlook crawling, also add:

```text
MICROSOFT_CLIENT_ID
MICROSOFT_TENANT_ID
MICROSOFT_CLIENT_SECRET
OUTLOOK_REFRESH_TOKEN
```

The scheduled workflow runs public-web crawling every six hours in the
`Asia/Singapore` timezone. Outlook is available only through the workflow's
manual `include_outlook` option.

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
