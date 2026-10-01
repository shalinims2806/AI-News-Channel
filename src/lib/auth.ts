import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/session";

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await verifySession(token);
  if (!s) return null;
  // Re-check against DB so deleted users lose access immediately.
  const user = await db.user.findUnique({ where: { id: s.uid }, select: { id: true, role: true, email: true } });
  return user ? { uid: user.id, email: user.email, role: user.role } : null;
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  return s;
}
