/**
 * La metadata notarial queda pendiente de revisión cuando el contenido de la
 * escritura cambió después del último guardado de esa metadata.
 */
export function requiresNotarialReview(
  latestContentUpdateAt: string | null,
  metadataUpdatedAt: string,
): boolean {
  if (!latestContentUpdateAt) return false;

  const contentTimestamp = Date.parse(latestContentUpdateAt);
  const metadataTimestamp = Date.parse(metadataUpdatedAt);

  return (
    Number.isFinite(contentTimestamp) &&
    Number.isFinite(metadataTimestamp) &&
    contentTimestamp > metadataTimestamp
  );
}
