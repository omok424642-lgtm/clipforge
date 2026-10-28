import { mkdir, writeFile, stat, readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { getUploadsDir } from "./paths";
import { publicRequest, readBounded } from "./commerce-collection";
import { validateMediaFile } from "./media-validate";
import { allowedCommerceImage, type CommerceProductDraft } from "./commerce-product";

/** Restricted platform CDNs only; user URLs and page-derived internal/foreign destinations are never fetched. */
function imageExtension(bytes: Uint8Array, type: string): string | undefined {
  if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (type === "image/png" && Buffer.from(bytes.slice(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (type === "image/webp" && Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" && Buffer.from(bytes.slice(8,12)).toString() === "WEBP") return "webp";
  if (type === "image/gif" && /^GIF8[79]a$/.test(Buffer.from(bytes.slice(0,6)).toString())) return "gif";
  if (type === "image/bmp" && Buffer.from(bytes.slice(0,2)).toString() === "BM") return "bmp";
}
export async function retainCommerceImages(draft: CommerceProductDraft, request = publicRequest): Promise<CommerceProductDraft> {
  const result = { ...draft, warnings: [...draft.warnings], images: [...draft.images] };
  const dir = join(getUploadsDir(), "products", draft.id);
  await mkdir(dir, { recursive: true });
  const retained = [];
  for (const img of result.images) {
    if (img.url.startsWith(`/api/files/products/${draft.id}/`)) {
      const name = img.url.split("/").pop()!;
      const file = join(dir, name);
      try {
        const info = await stat(file);
        if (!info.isFile() || info.size > 12 * 1024 * 1024) throw new Error();
        const ext = name.split(".").pop()!.toLowerCase();
        const type = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
        if (!imageExtension(await readFile(file), type)) throw new Error();
        if (!await validateMediaFile(file, "image")) throw new Error();
        retained.push(img);
      } catch { result.warnings.push("업로드 이미지가 없거나 실제 이미지가 아닙니다. 다시 업로드해 주세요."); }
      continue;
    }
    if (!allowedCommerceImage(img.url, draft.link.platform)) {
      result.warnings.push("플랫폼 공식 이미지 호스트로 확인되지 않은 이미지는 저장하지 않았습니다. 사용 가능한 이미지를 직접 업로드해 주세요."); continue;
    }
    try {
      // Redirects are refused: no login, hotlink or access-control workaround.
      const res = await request(img.url, { headers: { "User-Agent": "ClipForgeProductImport/1.0", Accept: "image/*" } });
      if (!res.ok || res.status >= 300) throw new Error("다운로드 제한");
      const bytes = await readBounded(res, 12 * 1024 * 1024);
      const ext = imageExtension(bytes, (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase());
      if (!ext) throw new Error("실제 이미지가 아닙니다");
      const name = `import-${createHash("sha256").update(bytes).digest("hex").slice(0,24)}.${ext}`;
      const file = join(dir, name);
      await writeFile(file, bytes);
      if (!await validateMediaFile(file, "image")) throw new Error("이미지를 읽을 수 없습니다");
      retained.push({ ...img, url: `/api/files/products/${draft.id}/${name}` });
    } catch { result.warnings.push("이미지 다운로드가 제한되거나 이미지 형식이 올바르지 않습니다. 직접 업로드해 주세요."); }
  }
  result.images = retained;
  return result;
}
