// 시험용 경로(읽기만 해요).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
/** aimath-next 폴더 */
export const NEXT_DIR = join(here, "..", "..");
/** 옛 체험 도구 폴더(src/aimath/widgets) — 고치지 않고 import 만 해요 */
export const LEGACY_WIDGETS = join(NEXT_DIR, "..", "src", "aimath", "widgets");
/** 새 체험 도구 폴더 */
export const NEW_WIDGETS = join(NEXT_DIR, "src", "shared", "widgets");
