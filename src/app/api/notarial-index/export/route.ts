import { type NextRequest, NextResponse } from "next/server";
import { publicErrorDetails } from "@/lib/server/errors";
import type { RawNotarialQuery } from "@/features/documents";
import { prepareNotarialCsvExport } from "@/features/documents/server";

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
  try {
    const result = await prepareNotarialCsvExport(readParams(request));
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": result.contentDisposition,
        "Content-Length": String(result.body.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const details = publicErrorDetails(error);
    return NextResponse.json(
      {
        error:
          details.status === 401
            ? details.message
            : "No fue posible generar el índice.",
      },
      { status: details.status },
    );
  }
}
