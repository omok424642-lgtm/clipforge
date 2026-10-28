import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { compositions, projects, settings } from "@/lib/db/schema";
import { like, desc } from "drizzle-orm";
import type { DiscoveryHistoryEntry } from "@/lib/discovery-products";

export const runtime = "nodejs";
/** Read production records without rendering, media backfills, or external API calls. */
export async function GET() {
  try {
    const db = getDb();
    const projectRows = db.select({ id: projects.id, productId: projects.productId, shopUrl: projects.shopUrl, name: projects.name, updatedAt: projects.updatedAt }).from(projects).orderBy(desc(projects.updatedAt)).all();
    const outputs = db.select({ projectId: compositions.projectId, status: compositions.status, outputPath: compositions.outputPath }).from(compositions).all();
    const references = db.select().from(settings).where(like(settings.key, "discovery:project:%")).all();
    const identities = new Map(references.map((r) => [r.key.slice("discovery:project:".length), r.value]));
    const byProject = new Map<string, { done: number; active: number; failed: number }>();
    for (const row of outputs) {
      const counts = byProject.get(row.projectId) ?? { done: 0, active: 0, failed: 0 };
      if (row.status === "done" && row.outputPath) counts.done++;
      if (row.status === "pending" || row.status === "composing") counts.active++;
      if (row.status === "failed") counts.failed++;
      byProject.set(row.projectId, counts);
    }
    const history: DiscoveryHistoryEntry[] = projectRows.map((p) => {
      const counts = byProject.get(p.id), identity = identities.get(p.id);
      return { projectId: p.id, productId: p.productId, identity: typeof identity === "string" ? identity : null, originalUrl: p.shopUrl, name: p.name,
        completedCount: counts?.done ?? 0, activeCount: counts?.active ?? 0, failedCount: counts?.failed ?? 0, updatedAt: p.updatedAt?.toISOString() ?? null };
    });
    return NextResponse.json({ history }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "제작 이력을 불러오지 못했습니다. 다시 확인한 뒤 제작을 시작해 주세요." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
