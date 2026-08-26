import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { PENDING_ROLE, type Role, type SessionUser } from "./types";

export type AuthResult =
  | { status: "ok"; user: SessionUser }
  | { status: "invalid" }
  | { status: "pending" }
  | { status: "disabled" };

const COOKIE = "bdt_session";
const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-only-change-me",
);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  user: SessionUser,
  options?: { remember?: boolean },
) {
  const remember = Boolean(options?.remember);
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(remember ? "30d" : "12h")
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.id),
      schoolId: String(payload.schoolId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      teacherId: (payload.teacherId as string | null) ?? null,
      assignedBus: (payload.assignedBus as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function canManageTransportation(role: Role) {
  return role === "COORDINATOR" || role === "FRONT_DESK";
}

export function canCreateRequest(role: Role) {
  return (
    role === "COORDINATOR" ||
    role === "FRONT_DESK" ||
    role === "BUS_COMPANY" ||
    role === "TEACHER"
  );
}

export function canManageUsers(role: Role) {
  return role === "ADMINISTRATOR";
}

export function canViewAll(role: Role) {
  return (
    role === "COORDINATOR" ||
    role === "ADMINISTRATOR" ||
    role === "FRONT_DESK"
  );
}

export function homePath(role: Role) {
  if (role === "TEACHER") return "/teacher";
  if (role === "BUS_COMPANY") return "/company";
  if (role === "BUS_ASSISTANT") return "/checkin";
  if (role === "ADMINISTRATOR") return "/leadership";
  return "/dashboard";
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      schoolId: true,
      email: true,
      name: true,
      role: true,
      teacherId: true,
      active: true,
      passwordHash: true,
    },
  });
  if (!user) return { status: "invalid" };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { status: "invalid" };
  if (user.role === PENDING_ROLE) return { status: "pending" };
  if (!user.active) return { status: "disabled" };
  return {
    status: "ok",
    user: {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      teacherId: user.teacherId,
      assignedBus: null,
    },
  };
}
