/**
 * Helper to localize user / staff roles consistently across the application.
 */
export function formatUserRole(
  role: string | null | undefined,
  t: (key: string, fallback?: string) => string,
): string {
  if (!role) return "";
  const normalized = role.toLowerCase().trim();
  const fallback = role.replace(/_/g, " ");
  return t(`roles.${normalized}`, fallback);
}
