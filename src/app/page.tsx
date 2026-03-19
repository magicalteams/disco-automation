export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Antonym Intelligence Layer</h1>
      <p>Automated opportunity matching engine. API-only — no UI needed.</p>
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /api/extract/newsletter</code> — Extract opportunities from newsletter markdown</li>
        <li><code>POST /api/ingest/dossiers</code> — Import partner dossiers (paste or Drive)</li>
        <li><code>POST /api/match/weekly</code> — Trigger weekly matching (supports dryRun, threshold override)</li>
        <li><code>GET /api/match/review?week=</code> — Review match results with quality metrics</li>
        <li><code>POST /api/match/reset</code> — Reset a match run to allow re-running</li>
        <li><code>GET /api/cron/sheet-reminder</code> — Monday 2PM UTC: Slack reminder to review Sheet</li>
        <li><code>GET /api/cron/weekly-match</code> — Monday 5PM UTC: sync overrides, auto-expire, match</li>
      </ul>
    </main>
  );
}
