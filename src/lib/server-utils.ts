import { createHash } from "node:crypto";
import he from "he";

export function sha1(input: string) {
  return createHash("sha1").update(input).digest("hex");
}

/** Strip tags/entities from feed HTML and collapse whitespace. */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  const noTags = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return he.decode(noTags).replace(/\s+/g, " ").trim();
}
