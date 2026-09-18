import { type NextRequest, NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import {
  DEFAULT_MARGIN_PROFILE,
  parseMarginProfile,
} from "@/lib/documents/docx/margin-profile";
import {
  DocumentExportError,
  prepareAndRecordDocumentDocxExport,
  prepareDocumentDocxExport,
} from "@/features/documents/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function genericError(status: number): NextResponse {
  return NextResponse.json(
    { error: "No fue posible generar el documento." },
    { status },
  );
}

async function handleExport(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  recordActivity: boolean,
): Promise<NextResponse> {
  const { id } = await params;

  // `?margins=front|back` elige el perfil de márgenes (Frente por defecto);
  // un valor presente pero desconocido se rechaza en vez de ignorarse.
  const marginsParam = request.nextUrl.searchParams.get("margins");
  const marginProfile =
    marginsParam === null
      ? DEFAULT_MARGIN_PROFILE
      : parseMarginProfile(marginsParam);
  if (!marginProfile) return genericError(400);

  try {
    const result = await (recordActivity
      ? prepareAndRecordDocumentDocxExport(id, marginProfile)
      : prepareDocumentDocxExport(id, marginProfile));
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
    if (error instanceof UnauthorizedError) return genericError(401);
    if (error instanceof ForbiddenError) return genericError(403);
    if (error instanceof DocumentExportError) return genericError(error.status);
    console.error("[docx] export request failed");
    return genericError(500);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handleExport(request, context, false);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handleExport(request, context, true);
}
