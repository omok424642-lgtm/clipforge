import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, settings } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { referenceIdentity, validateProductReference } from "@/lib/discovery-products";

// fetch project list, most recently edited first (the /start "continue" cards rely on this order)
export async function GET() {
  try {
    const db = getDb();
    const result = await db.select().from(projects).orderBy(desc(projects.updatedAt));
    return NextResponse.json(result);
  } catch (error) {
    console.error("获取项目列表失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取项目列表失败" },
      { status: 500 }
    );
  }
}

// create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();
    let reference;
    try { reference = validateProductReference(body.productReference); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "상품 연결 정보를 확인해 주세요." }, { status: 400 }); }

    // validate videoMode / sourceType against enum allowlists; fall back to default for invalid values
    const VIDEO_MODES = ["product_closeup", "graphic_montage", "scene_demo", "live_presenter"];
    const videoMode = VIDEO_MODES.includes(body.videoMode) ? body.videoMode : undefined;
    const sourceType = body.sourceType === "clone" ? "clone" : undefined;

    const newProject = db.transaction((tx) => {
      const project = tx
      .insert(projects)
      .values({
        name: body.name || "未命名项目",
        productName: body.productName,
        productCategory: body.productCategory,
        productDescription: body.productDescription,
        productImages: body.productImages || [],
        ...(reference && { productId: reference.libraryId, shopUrl: reference.originalUrl ?? null }),
        ...(videoMode && { videoMode }),
        ...(sourceType && { sourceType }),
        ...(body.sourceVideoUrl && { sourceVideoUrl: body.sourceVideoUrl }),
      })
      .returning().get();
      if (reference) tx.insert(settings).values({ key: `discovery:project:${project.id}`, value: referenceIdentity(reference) }).run();
      return project;
    });

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error("创建项目失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建项目失败" },
      { status: 500 }
    );
  }
}
