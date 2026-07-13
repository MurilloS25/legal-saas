import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DocumentIdSchema } from "@/lib/validations/documents";
import {
  buildEscrituraDocx,
  DocxGenerationError,
} from "@/lib/documents/docx";

// Descarga server-only del `.docx` de una escritura.
//
// Todos los datos se obtienen en servidor a partir del ID en la ruta: no se
// acepta contenido, field_values, título, ownership ni filename desde el
// cliente. Defensa en profundidad: además de RLS, se filtra por owner_id y no
// se distingue entre documento inexistente y ajeno. El archivo se genera en
// memoria y no se persiste en ningún lado.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function genericError(status: number): NextResponse {
  // Mensaje genérico, sin SQL, stack ni contenido del documento.
  return NextResponse.json(
    { error: "No fue posible generar el documento." },
    { status },
  );
}

/**
 * Content-Disposition `attachment` con filename ASCII seguro y variante
 * RFC 5987 para tildes. El filename ya viene saneado (sin comillas, CR/LF ni
 * caracteres de control); esto es una segunda barrera.
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename
    .replace(/[^ -~]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return genericError(401);

  if (!DocumentIdSchema.safeParse(id).success) {
    // ID malformado: mismo 404 genérico que un documento inexistente.
    return genericError(404);
  }

  // Documento propio. Devuelve null tanto si no existe como si es ajeno.
  const { data: document } = await supabase
    .from("documents")
    .select("id, title, template_id, field_values")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!document) return genericError(404);

  // Machote propio asociado (defensa en profundidad además de RLS).
  const { data: template } = await supabase
    .from("templates")
    .select("content_json")
    .eq("id", document.template_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!template) {
    // El machote ya no está disponible: no se puede reconstruir el documento.
    return genericError(422);
  }

  let result;
  try {
    result = await buildEscrituraDocx({
      contentJson: template.content_json,
      fieldValues: (document.field_values ?? {}) as Record<string, string>,
      title: document.title,
    });
  } catch (error) {
    // Solo se registra un código técnico no sensible; nunca field_values,
    // rendered_content ni texto del machote.
    if (error instanceof DocxGenerationError) {
      console.error(`[docx] generation failed: ${error.code}`);
      return genericError(error.code === "generation_failed" ? 500 : 413);
    }
    console.error("[docx] unexpected generation error");
    return genericError(500);
  }

  const body = new Uint8Array(result.buffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": contentDisposition(result.filename),
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
