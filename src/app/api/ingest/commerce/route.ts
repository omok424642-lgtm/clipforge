import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { classifyCommerceLink, sameCommerceProduct, NAVER_DISCLOSURE, COUPANG_DISCLOSURE, type CommerceProductDraft } from "@/lib/commerce-product";
import { collectCommerceProduct } from "@/lib/commerce-collection";
import { readCommerceDraft, saveCommerceDraft, validCommerceDraftId } from "@/lib/commerce-storage";
import { reviewCommerceProduct } from "@/lib/commerce-review";
import { retainCommerceImages } from "@/lib/commerce-images";

export const runtime = "nodejs";
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!validCommerceDraftId(id)) return response({ error: "올바른 상품 확인 번호가 필요합니다." }, 400);
  try {
    const draft = req.nextUrl.searchParams.get("reviewed") === "1" ? await readCommerceDraft(id, true) : await readCommerceDraft(id);
    return response({ draft });
  } catch { return response({ error: "저장된 상품 정보를 찾을 수 없습니다." }, 404); }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    if (Number(req.headers.get("content-length")) > 64000) return response({ error: "요청이 너무 큽니다." }, 413);
    const raw = await req.text();
    if (raw.length > 64000) return response({ error: "요청이 너무 큽니다." }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { return response({ error: "입력 형식이 올바르지 않습니다." }, 400); }
  if (body.action === "review") {
    if (!validCommerceDraftId(body.id)) return response({ error: "상품 확인 번호가 필요합니다." }, 400);
    let source: CommerceProductDraft;
    try { source = await readCommerceDraft(body.id); } catch { return response({ error: "수집 원본을 찾을 수 없습니다. 링크 분석부터 다시 진행해 주세요." }, 404); }
    try {
      let draft = reviewCommerceProduct(source, body);
      draft = await retainCommerceImages(draft);
      if (!draft.images.length) return response({ error: "사용할 이미지를 저장하지 못했습니다. 권한이 있는 이미지를 직접 업로드해 주세요.", warnings: draft.warnings }, 422);
      draft.review!.selectedImages = draft.images.map((i) => i.url);
      await saveCommerceDraft(draft, true);
      return response({ draft });
    } catch (e) { return response({ error: e instanceof Error ? e.message : "상품 저장에 실패했습니다." }, 400); }
  }
  if (body.action !== "analyze") return response({ error: "지원하지 않는 작업입니다." }, 400);
  let link;
  try { link = classifyCommerceLink(typeof body.url === "string" ? body.url : ""); }
  catch (e) { return response({ error: e instanceof Error ? e.message : "지원하지 않는 링크입니다." }, 400); }
  // A separately supplied direct product link can identify the product without replacing the affiliate original.
  let directUrl: string | undefined;
  if (typeof body.productUrl === "string" && body.productUrl.trim()) {
    try {
      const direct = classifyCommerceLink(body.productUrl);
      if (direct.platform !== link.platform || !direct.productId || (link.productId && !sameCommerceProduct(link, direct.originalUrl))) throw new Error();
      directUrl = direct.originalUrl;
    } catch { return response({ error: "같은 플랫폼·상품의 실제 상품 링크를 입력해 주세요." }, 400); }
  }
  const draft: CommerceProductDraft = {
    id: randomUUID(), link, resolvedUrl: directUrl, collectedAt: new Date().toISOString(), method: "manual", status: "needs_input",
    title: "", price: "", options: [], features: [], description: "", images: [], warnings: [],
    disclosure: { enabled: link.kind === "affiliate_or_share", text: link.platform === "naver" ? NAVER_DISCLOSURE : COUPANG_DISCLOSURE, placement: "video_overlay" },
  };
  if (directUrl) draft.warnings.push("별도 입력한 상품 주소입니다. 제휴 링크의 실제 도착 상품과 같은지 확인해 주세요.");
  try {
    await collectCommerceProduct(draft, typeof body.keyword === "string" ? body.keyword.trim().slice(0, 100) : "");
    await saveCommerceDraft(draft);
    return response({ draft });
  } catch { return response({ error: "수집 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500); }
}
