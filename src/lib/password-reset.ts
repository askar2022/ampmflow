import { SignJWT, jwtVerify } from "jose";
import { sendMail, smtpConfigured } from "./email";
import { prisma } from "./prisma";
import { APP_ORIGIN, schoolLoginPath, schoolSlugForId } from "./school-slug";
import { PENDING_ROLE } from "./types";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-only-change-me",
);

type ResetPayload = {
  purpose: "pwreset";
  id: string;
  email: string;
};

function resetUrl(token: string, slug?: string) {
  const origin = APP_ORIGIN.replace(/\/$/, "");
  const path = `/login/reset?token=${encodeURIComponent(token)}`;
  const school = slug ? `&school=${encodeURIComponent(slug)}` : "";
  return `${origin}${path}${school}`;
}

export async function createPasswordResetToken(userId: string, email: string) {
  return new SignJWT({ purpose: "pwreset", id: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export async function readPasswordResetToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== "pwreset" || !payload.id || !payload.email) {
      return null;
    }
    return {
      id: String(payload.id),
      email: String(payload.email),
    } satisfies Omit<ResetPayload, "purpose">;
  } catch {
    return null;
  }
}

export async function sendPasswordResetEmail(email: string, schoolSlug?: string) {
  const value = email.trim().toLowerCase();
  if (!value.includes("@") || !value.includes(".")) {
    return { ok: false as const, error: "Enter the email you use to sign in." };
  }
  if (!smtpConfigured()) {
    return {
      ok: false as const,
      error: "Email is not configured yet. Try again after AMPM Flow is connected.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: value },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      schoolId: true,
    },
  });

  if (user && user.active && user.role !== PENDING_ROLE) {
    const slug = schoolSlug || (await schoolSlugForId(user.schoolId));
    const token = await createPasswordResetToken(user.id, user.email);
    const link = resetUrl(token, slug);
    const result = await sendMail({
      to: user.email,
      subject: "Reset your AMPM Flow password",
      text: [
        `Hello ${user.name},`,
        "",
        "Use this link to choose a new AMPM Flow password. It expires in one hour.",
        "",
        link,
        "",
        "If you did not ask for this, you can ignore this email.",
      ].join("\n"),
      html: `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#102a43;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="padding:24px 20px;">
        <p style="margin:0 0 12px;font-size:16px;">Hello ${user.name},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
          Use this button to choose a new AMPM Flow password. The link expires in one hour.
        </p>
        <p style="margin:0 0 20px;">
          <a href="${link}" style="display:inline-block;background:#102a43;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">
            Choose a new password
          </a>
        </p>
        <p style="margin:0;font-size:13px;color:#5b6d7e;line-height:1.4;">
          If you did not ask for this, you can ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
    if (!result.sent) {
      return {
        ok: false as const,
        error: result.reason || "Could not send the reset email.",
      };
    }
  }

  return { ok: true as const };
}

export function schoolSignInPath(slug?: string) {
  return slug ? schoolLoginPath(slug) : "/login";
}
