import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseNotarialQuery,
  type RawNotarialQuery,
} from "@/lib/documents/notarial-query";
import {
  listNotarialIndexForExport,
} from "../../../(dashboard)/dashboard/notarial-index/queries";
import {
  buildNotarialCsv,
  notarialExportFilename,
} from "@/lib/documents/notarial-export";

// Exportación CSV del índice notarial interno.
//
// Server-only: valida sesión, reutiliza los mismos filtros saneados del
// workspace (nunca columnas ni consultas arbitrarias), genera el CSV en
// memoria y lo devuelve. No almacena el archivo. Registra un evento de
// auditoría best-effort (el fallo del log no rompe la descarga).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readParams(request: NextRequest): RawNotarialQuery {
  const sp = request.nextUrl.searchParams;
  return {
    search: sp.get("search") ?? undefined,
    completeness: sp.get("completeness") ?? undefined,
    act_type: sp.get("act_type") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    sort: sp.get("sort") ?? undefined,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401 },
    );
  }

  const query = parseNotarialQuery(readParams(request));

  let rows;
  try {
    rows = await listNotarialIndexForExport(query);
  } catch {
    console.error("[notarial-export] query failed");
    return NextResponse.json(
      { error: "No fue posible generar el índice." },
      { status: 500 },
    );
  }

  const csv = buildNotarialCsv(rows);
  const filename = notarialExportFilename(query.from, query.to);

  // Auditoría best-effort: no debe romper la descarga.
  try {
    await supabase.rpc("log_notarial_index_export", {
      p_format: "csv",
      p_from: query.from,
      p_to: query.to,
      p_row_count: rows.length,
    });
  } catch {
    console.error("[notarial-export] activity logging failed");
  }

  const body = new TextEncoder().encode(csv);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
