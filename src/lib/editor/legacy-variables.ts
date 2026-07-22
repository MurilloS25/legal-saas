/**
 * Detección de variables pegadas en el editor.
 *
 * La sintaxis es `{{clave}}` con el alfabeto de `FIELD_KEY_PATTERN`
 * (letras, números, guion bajo, puntos) — sin distinguir mayúsculas de
 * minúsculas: `{{NOMBRE}}`, `{{nombre}}` y `{{Nombre}}` se detectan por
 * igual y normalizan a la misma clave en minúsculas. El pegado nunca
 * convierte en silencio (no hay una regla de pegado en el editor): TODO
 * `{{...}}` con este alfabeto pasa por el diálogo de revisión antes de
 * convertirse, sin importar el caso. Cualquier `{{...}}` con otro contenido
 * (espacios, dos puntos, símbolos) no se reconoce como variable y se deja
 * como texto literal — por ejemplo `{{SMART:block_id}}`, que usa `:` y por
 * tanto nunca coincide con este patrón.
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
 * sigue delimitado por `{{ }}` y sin espacios, dos puntos ni otros símbolos.
 */
const PLACEHOLDER_ALPHABET_PATTERN = /\{\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}/g;

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
 * Detecta todos los placeholders `{{...}}` con el alfabeto válido (letras,
 * números, guion bajo, puntos), sin distinguir mayúsculas de minúsculas.
 * Es la única vía de detección al pegar contenido: no hay conversión
 * silenciosa para ningún caso, ni siquiera para claves ya en minúsculas.
 *
 * Deduplicado por clave normalizada, en orden de primera aparición, con un
 * tope defensivo de candidatas por pegado.
 */
export function detectLegacyVariables(text: string): LegacyVariableMatch[] {
  const clean = stripInvisibleCharacters(text);
  const seen = new Set<string>();
  const matches: LegacyVariableMatch[] = [];

  for (const match of clean.matchAll(PLACEHOLDER_ALPHABET_PATTERN)) {
    const raw = match[1];
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
