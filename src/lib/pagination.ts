export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 10;
const MAX_PAGE = 100_000;

export function normalizePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_PAGE);
}

export function normalizePageSize(
  value: string | undefined,
): PageSizeOption {
  const parsed = Number.parseInt(value ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as PageSizeOption)
    : DEFAULT_PAGE_SIZE;
}

export function buildPageSizeOptions(
  hrefFor: (pageSize: PageSizeOption) => string,
): { value: PageSizeOption; href: string }[] {
  return PAGE_SIZE_OPTIONS.map((value) => ({ value, href: hrefFor(value) }));
}
