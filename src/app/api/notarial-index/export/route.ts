import { type NextRequest, NextResponse } from "next/server";
import { publicErrorDetails } from "@/lib/server/errors";
import {
  prepareAndRecordNotarialDocxExport,
  prepareNotarialDocxExport,
} from "@/features/notarial-index/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleExport(
  request: NextRequest,
  recordActivity: boolean,
): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  try {
    const prepare = recordActivity
      ? prepareAndRecordNotarialDocxExport
      : prepareNotarialDocxExport;
    const result = await prepare({
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      half: searchParams.get("half") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      completeness: searchParams.get("completeness") ?? undefined,
      act_type: searchParams.get("act_type") ?? undefined,
    });
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
    if (details.status === 500) {
      console.error("[notarial-export] generation failed");
    }
    return NextResponse.json(
      { error: details.status === 500 ? "No fue posible generar el índice." : details.message },
      { status: details.status },
    );
  }
}

export function GET(request: NextRequest): Promise<NextResponse> {
  return handleExport(request, false);
}

export function POST(request: NextRequest): Promise<NextResponse> {
  return handleExport(request, true);
}
