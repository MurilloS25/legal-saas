/**
 * Detección de variables legacy al pegar contenido en el editor.
 *
 * La sintaxis oficial es `{{clave}}` con el alfabeto de `FIELD_KEY_PATTERN`
 * (minúsculas, números, guion bajo, puntos). Los machotes antiguos usan la
 * misma delimitación `{{ }}` pero con claves en MAYÚSCULAS_CON_GUION_BAJO
 * (p. ej. `{{TOMO_NUMERO}}`), que hoy no coincide con ese patrón y por eso
 * el pegado no las detecta.
 *
 * Este módulo NO amplía la sintaxis aceptada por el editor: sigue exigiendo
 * el mismo alfabeto (letras, números, guion bajo, puntos) dentro de `{{ }}`,
 * solo que sin distinguir mayúsculas/minúsculas. Cualquier `{{...}}` con
 * otro contenido (espacios, dos puntos, símbolos) no se reconoce como
 * variable y se deja como texto literal — por ejemplo `{{SMART:block_id}}`,
 * que usa `:` y por tanto nunca coincide con este patrón.
 *
 * Sin `eval`, sin expresiones, sin inferencia semántica: solo un regex
 * simple (sin backtracking catastrófico posible, alfabeto acotado) más una
 * normalización mecánica (minúsculas + separadores → espacios) para
 * proponer una clave y una etiqueta legibles. La conversión real solo
 * ocurre si el usuario confirma cada variable en el diálogo de revisión.
 */

import { FIELD_KEY_PATTERN } from "./variable-key";
import { TEMPLATE_DOC_LIMITS } from "./types";

/**
 * Caracteres invisibles que algunos orígenes (Word, PDFs) pueden insertar:
 * espacio de ancho cero, non-joiner, joiner y BOM.
 */
const INVISIBLE_CHARS_PATTERN = /[​‌‍﻿]/g;

/**
 * Mismo alfabeto que `FIELD_KEY_PATTERN` pero sin distinguir mayúsculas —
 * es la única ampliación: sigue delimitado por `{{ }}` y sin espacios,
 * dos puntos ni otros símbolos.
 */
const LEGACY_PLACEHOLDER_PATTERN = /\{\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}/g;

/** Límite defensivo de candidatas por pegado (independiente del límite de variables distintas del documento). */
const MAX_CANDIDATES_PER_PASTE = TEMPLATE_DOC_LIMITS.maxDistinctVariables;

export type LegacyVariableMatch = {
  /** Texto exacto encontrado entre `{{` y `}}`, tal como aparece en el pegado. */
  raw: string;
  /** Clave normalizada (minúsculas), lista para usarse como `field_key`. */
  key: string;
  /** Etiqueta inicial legible, editable por el usuario antes de convertir. */
  label: string;
};

/** Quita caracteres invisibles comunes (cero-ancho, BOM) antes de analizar el texto pegado. */
export function stripInvisibleCharacters(text: string): string {
  return text.replace(INVISIBLE_CHARS_PATTERN, "");
}

/**
 * Etiqueta inicial legible a partir del texto detectado: separadores (`_`,
 * `.`) se convierten en espacios, todo en minúsculas salvo la primera letra.
 * Ej: "NOMBRE_DEL_COMPRADOR" → "Nombre del comprador".
 */
export function humanizeLegacyLabel(raw: string): string {
  const spaced = raw.replace(/[_.]+/g, " ").trim().toLowerCase();
  if (spaced === "") return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Detecta placeholders `{{...}}` con el alfabeto legacy (mismo que el
 * oficial, sin distinguir mayúsculas) que AÚN NO son válidos según
 * `FIELD_KEY_PATTERN` — es decir, los que la regla de pegado actual ya
 * ignora. Los placeholders ya válidos (`{{clave.valida}}`) se excluyen a
 * propósito: esos los sigue convirtiendo directamente la regla de pegado
 * existente, sin pasar por el diálogo de revisión.
 *
 * Deduplicado por clave normalizada, en orden de primera aparición, con un
 * tope defensivo de candidatas por pegado.
 */
export function detectLegacyVariables(text: string): LegacyVariableMatch[] {
  const clean = stripInvisibleCharacters(text);
  const seen = new Set<string>();
  const matches: LegacyVariableMatch[] = [];

  for (const match of clean.matchAll(LEGACY_PLACEHOLDER_PATTERN)) {
    const raw = match[1];
    if (FIELD_KEY_PATTERN.test(raw)) continue; // ya válido: lo maneja la regla de pegado existente.
    if (raw.length > TEMPLATE_DOC_LIMITS.maxVariableKeyLength) continue;

    const key = raw.toLowerCase();
    if (!FIELD_KEY_PATTERN.test(key)) continue; // normalización defensiva; no debería ocurrir con este alfabeto.
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      raw,
      key,
      label: humanizeLegacyLabel(raw).slice(
        0,
        TEMPLATE_DOC_LIMITS.maxVariableLabelLength,
      ),
    });

    if (matches.length >= MAX_CANDIDATES_PER_PASTE) break;
  }

  return matches;
}
