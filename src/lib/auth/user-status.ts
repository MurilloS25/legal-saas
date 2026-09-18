type BanAwareUser = { banned_until?: string | null } | null | undefined;

export function isUserBanned(
  user: BanAwareUser,
  now = new Date(),
): boolean {
  if (!user?.banned_until) return false;
  const bannedUntil = new Date(user.banned_until);
  return !Number.isNaN(bannedUntil.getTime()) && bannedUntil > now;
}
