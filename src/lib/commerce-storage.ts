import { mkdir, readFile, writeFile, rename } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getDataDir } from "./paths";
import type { CommerceProductDraft } from "./commerce-product";

export function validCommerceDraftId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
export async function saveCommerceDraft(draft: CommerceProductDraft, reviewed = false) {
  if (!validCommerceDraftId(draft.id)) throw new Error("잘못된 상품 확인 번호입니다.");
  const dir = join(getDataDir(), "product-imports");
  await mkdir(dir, { recursive: true });
  const target = join(dir, `${draft.id}${reviewed ? ".reviewed" : ""}.json`);
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(draft, null, 2), { mode: 0o600 });
  await rename(temp, target);
}
export async function readCommerceDraft(id: string, reviewed = false): Promise<CommerceProductDraft> {
  if (!validCommerceDraftId(id)) throw new Error("잘못된 상품 확인 번호입니다.");
  return JSON.parse(await readFile(join(getDataDir(), "product-imports", `${id}${reviewed ? ".reviewed" : ""}.json`), "utf8"));
}
