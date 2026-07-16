import { type NextRequest, NextResponse } from "next/server";
import { publicErrorDetails } from "@/lib/server/errors";
import { prepareNotarialDocxExport } from "@/features/notarial-index/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  try {
    const result = await prepareNotarialDocxExport({
      year: searchParams.get("year") ?? undefined,
      month: searchParams.get("month") ?? undefined,
      half: searchParams.get("half") ?? undefined,
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
