import { cleanProductText, missingCommerceFields, type CommerceProductDraft } from "./commerce-product";

const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max ? v.trim() : undefined;
const lines = (v: unknown) => Array.isArray(v) && v.length <= 30 && v.every((x) => typeof x === "string" && x.length <= 500)
  ? [...new Set(v.map((x: string) => x.trim()).filter(Boolean))] : undefined;

/** Allowlisted edits only: original/affiliate URLs, source snapshots and provenance stay immutable. */
export function reviewCommerceProduct(source: CommerceProductDraft, body: Record<string, unknown>): CommerceProductDraft {
  const title = text(body.title, 300), price = text(body.price, 100), description = text(body.description, 4000);
  const options = lines(body.options), features = lines(body.features);
  const selectedImages = lines(body.selectedImages);
  const disclosureText = text(body.disclosureText, 1000);
  if (title === undefined || price === undefined || description === undefined || !options || !features || !selectedImages || disclosureText === undefined) throw new Error("입력값이 없거나 허용 길이를 초과했습니다.");
  if (body.factsConfirmed !== true || body.imageRightsConfirmed !== true) throw new Error("상품 정보와 이미지 사용 권한을 확인해 주세요.");
  if (typeof body.disclosureEnabled !== "boolean" || (body.disclosureEnabled && !disclosureText)) throw new Error("제휴 고지 문구를 입력해 주세요.");
  const known = new Map(source.images.map((img) => [img.url, img]));
  const uploadPrefix = `/api/files/products/${source.id}/`;
  const images = selectedImages.map((url) => {
    const candidate = known.get(url);
    if (candidate) return candidate;
    if (url.startsWith(uploadPrefix) && /^[a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|webp|gif|bmp)$/i.test(url.slice(uploadPrefix.length))) {
      return { url, sourceUrl: "사용자 업로드", provenance: "user" as const };
    }
    throw new Error("수집한 이미지 또는 직접 업로드한 이미지만 저장할 수 있습니다.");
  });
  if (images.length > 10) throw new Error("이미지는 최대 10장까지 선택해 주세요.");
  const result: CommerceProductDraft = {
    ...source, title: cleanProductText(title, 300), price: cleanProductText(price, 100), description: cleanProductText(description),
    options: options.map((x) => cleanProductText(x, 500)), features: features.map((x) => cleanProductText(x, 500)), images,
    disclosure: { enabled: body.disclosureEnabled, text: disclosureText, placement: "video_overlay" },
  };
  const missing = missingCommerceFields(result);
  if (missing.length) throw new Error(`다음 정보를 보완해 주세요: ${missing.join(", ")}`);
  const editedFields = (["title", "price", "description", "options", "features"] as const)
    .filter((key) => JSON.stringify(source[key]) !== JSON.stringify(result[key]));
  result.status = "reviewed";
  result.review = { confirmedAt: new Date().toISOString(), factsConfirmed: true, imageRightsConfirmed: true, editedFields, selectedImages: images.map((i) => i.url) };
  return result;
}
