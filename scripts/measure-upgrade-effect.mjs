// Read-only weekly upgrade-effect measurement (2026-11-09). Aggregates only, no personal data.
// Run: node --env-file=.env.local scripts/measure-upgrade-effect.mjs  (edit P for new periods; dates are KST)
// "suspect" = desktop single-page landing on /guide or /inquiry (unexplained bursts, see docs/reviews/2026-11-03-구매전환진단).
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const P=[["before 10/20-10/29","2026-10-20","2026-10-30"],["ad 10/31-11/05","2026-10-31","2026-11-06"],["post 11/06-11/08","2026-11-06","2026-11-09"]];
for (const [n,f,t] of P){
const [r] = await sql.query(`
WITH s AS (SELECT s.*,
  ((s.landing_path IN ('/guide','/inquiry') OR s.landing_path LIKE '/inquiry?%' OR s.landing_path LIKE '/guide?%') AND s.event_count<=1 AND s.device='desktop') suspect,
  (lower(coalesce(s.source,'')) IN ('meta','facebook','fb') OR lower(coalesce(s.referrer_host,'')) LIKE '%facebook%') paid
 FROM analytics_sessions s WHERE started_at >= $1::timestamptz AND started_at < $2::timestamptz),
x AS (SELECT s.*, EXISTS(SELECT 1 FROM analytics_events e WHERE e.session_id=s.session_id AND e.event_type='artwork_view') viewed,
  EXISTS(SELECT 1 FROM analytics_events o WHERE o.session_id=s.session_id AND o.event_type='inquiry_open' AND cardinality(o.artworks)>0
     AND EXISTS(SELECT 1 FROM analytics_events v WHERE v.session_id=s.session_id AND v.event_type='artwork_view' AND v.created_at<=o.created_at)) opened
 FROM s WHERE NOT suspect)
SELECT count(*)::int all_ns, count(*) FILTER (WHERE event_count<=1)::int b_ns,
 count(*) FILTER (WHERE NOT paid)::int org, count(*) FILTER (WHERE NOT paid AND event_count<=1)::int b_org,
 count(*) FILTER (WHERE paid)::int paid, count(*) FILTER (WHERE paid AND event_count<=1)::int b_paid,
 count(*) FILTER (WHERE viewed)::int viewed, count(*) FILTER (WHERE viewed AND event_count>=2)::int viewed2,
 count(*) FILTER (WHERE viewed AND event_count<=1 AND device='desktop')::int view_single_desk,
 count(*) FILTER (WHERE opened)::int opened, count(*) FILTER (WHERE device='mobile' AND NOT paid)::int mob, count(*) FILTER (WHERE device='mobile' AND NOT paid AND event_count<=1)::int b_mob
FROM x`,[f+" 00:00+09",t+" 00:00+09"]);
const inq = await sql.query(`SELECT kind, receipt_ref, (created_at AT TIME ZONE 'Asia/Seoul')::text t FROM analytics_inquiries WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz AND kind='artwork'`,[f+" 00:00+09",t+" 00:00+09"]);
console.log(n, JSON.stringify(r), "artworkInq:", JSON.stringify(inq));}
