import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
  AI_GENERATION_ERROR_STATUS,
  aiGenerationErrorMessage,
  type AiGenerationErrorCode,
} from "@/features/templates/domain";
import {
  generateTemplateFromFormData,
  readAiTemplateConfig,
} from "@/features/templates/server";
import { requireApiWorkspace } from "@/lib/server/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors";
import { hasPermission } from "@/lib/server/permissions";
import { isSameOriginRequest } from "@/lib/security/same-origin";

/**
 * POST /api/templates/ai-generation — "Crear con IA".
 *
 * Route Handler (no Server Action) para acotar el tamaño del cuerpo solo en
 * esta ruta, sin subir el límite global de 1 MB de las Server Actions. El
 * proxy de Next.js bufferiza hasta 10 MiB; el límite de archivo (10 MB
 * decimales) más el margen multipart cabe debajo.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hasta 2 llamadas al proveedor (1 retry técnico) + extracción.
export const maxDuration = 300;

/** Margen para cabeceras multipart y campos de texto. */
const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

function failure(code: AiGenerationErrorCode): NextResponse {
  return NextResponse.json(
    { ok: false, code, message: aiGenerationErrorMessage(code) },
    {
      status: AI_GENERATION_ERROR_STATUS[code],
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOriginRequest(request.headers)) return failure("forbidden");

  let context: Awaited<ReturnType<typeof requireApiWorkspace>>;
  try {
    context = await requireApiWorkspace();
  } catch (error) {
    if (error instanceof UnauthorizedError) return failure("unauthorized");
    if (error instanceof ForbiddenError) return failure("forbidden");
    console.error("[ai-template-generation] workspace resolution failed");
    return failure("internal_error");
  }

  // Mismo permiso que crear/editar Machotes manualmente.
  if (!hasPermission(context.role, "templates.write")) return failure("forbidden");

  const configResult = readAiTemplateConfig();
  if (!configResult.available) return failure("not_configured");
  const { config } = configResult;

  const declaredLength = Number(request.headers.get("content-length") ?? "");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > config.maxFileBytes + MULTIPART_OVERHEAD_BYTES
  ) {
    return failure("file_too_large");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("invalid_input");
  }

  try {
    const outcome = await generateTemplateFromFormData(formData, {
      supabase: context.supabase,
      userId: context.user.id,
      workspaceId: context.workspaceId,
      config,
    });
    if (!outcome.ok) return failure(outcome.code);

    revalidatePath("/templates");
    return NextResponse.json(
      {
        ok: true,
        templateId: outcome.templateId,
        summary: outcome.summary,
        indexSaved: outcome.indexSaved,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Sin detalles: el error puede contener fragmentos de input o del proveedor.
    console.error("[ai-template-generation] unexpected failure");
    return failure("internal_error");
  }
}
