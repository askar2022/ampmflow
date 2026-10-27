export const PLATFORM_ADMIN_EMAIL = "askar@automationllc.org";

export function isPlatformAdminEmail(email: string) {
  return email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
