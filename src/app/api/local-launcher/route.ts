/** Local launcher readiness marker; no credentials, filesystem paths or database access. */
export const dynamic = "force-dynamic";

export async function GET() {
  const rootId = process.env.CLIPFORGE_LOCAL_ROOT;
  const instanceId = process.env.CLIPFORGE_LOCAL_INSTANCE;
  if (!rootId || !instanceId) return Response.json({ error: "not_enabled" }, { status: 404 });
  return Response.json({ app: "clipforge-local", rootId, instanceId }, { headers: { "Cache-Control": "no-store" } });
}
