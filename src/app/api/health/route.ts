// Liveness: the process is up and serving. No database call, so an outage
// elsewhere never makes the platform restart healthy instances.
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
