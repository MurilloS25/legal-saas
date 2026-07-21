import { redirect } from "next/navigation";
import {
  NotarialIndexWorkspace,
  notarialIndexWarnings,
  notarialQueryToParams,
  parseNotarialQuery,
  type RawNotarialQuery,
} from "@/features/notarial-index";
import {
  getLatestNotarialExportAt,
  listNotarialIndexForExport,
  listNotarialActTypes,
  listNotarialIndex,
} from "@/features/notarial-index/server";

export const metadata = {
  title: "Índice notarial — LexCR",
};

type Props = {
  searchParams: Promise<RawNotarialQuery>;
};

export default async function NotarialIndexPage({ searchParams }: Props) {
  const query = parseNotarialQuery(await searchParams);
  const [page, actTypes, lastExportAt, exportData] = await Promise.all([
    listNotarialIndex(query),
    listNotarialActTypes(),
    getLatestNotarialExportAt(),
    listNotarialIndexForExport(query),
  ]);

  if (page.total > 0 && query.page > page.pageCount) {
    const params = notarialQueryToParams({ ...query, page: page.pageCount });
    const qs = new URLSearchParams(params).toString();
    redirect(qs ? `/dashboard/notarial-index?${qs}` : "/dashboard/notarial-index");
  }

  return (
    <NotarialIndexWorkspace
      query={query}
      page={page}
      actTypes={actTypes}
      lastExportAt={lastExportAt}
      warnings={notarialIndexWarnings(exportData.rows)}
    />
  );
}
