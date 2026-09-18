import { type NextRequest, NextResponse } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
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
  { params }: { params: Promise<{ id: string }> },
  recordActivity: boolean,
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const result = await (recordActivity
      ? prepareAndRecordDocumentDocxExport(id)
      : prepareDocumentDocxExport(id));
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
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handleExport(context, false);
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return handleExport(context, true);
}
