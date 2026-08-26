import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role, SessionUser } from "./types";

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

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
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
  return role === "ADMINISTRATOR" || role === "COORDINATOR";
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

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    schoolId: user.schoolId,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    teacherId: user.teacherId,
    assignedBus: user.assignedBus ?? null,
  } satisfies SessionUser;
}
