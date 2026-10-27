export const PLATFORM_ADMIN_EMAIL = "askar@automationllc.com";

export function isPlatformAdminEmail(email: string) {
  return email.trim().toLowerCase() === PLATFORM_ADMIN_EMAIL;
}
