type SignOutError = { code?: string } | null;

type LogoutClient = {
  auth: {
    signOut(options: { scope: "global" }): Promise<{ error: SignOutError }>;
  };
};

export async function revokeAndClearSession(
  client: LogoutClient,
  clearLocal: () => Promise<void>,
  warn: (message: string) => void = console.warn,
): Promise<void> {
  const { error } = await client.auth.signOut({ scope: "global" });
  if (error) {
    warn(`[auth] global sign-out failed (${error.code ?? "unknown"})`);
  }
  await clearLocal();
}
