-- Búsqueda de Clientes por identificación, tolerante a guiones y espacios.
--
-- Por qué hace falta una migración:
--
-- `identification_number` conserva el valor tal como se guardó: una cédula
-- jurídica lleva guiones ("3-101-123456") y una física normalmente no
-- ("208390123"), pero pueden existir filas físicas con guiones o espacios
-- (datos previos a la normalización de `ClientSchema`). Buscar "3101123456"
-- y encontrar "3-101-123456" sin falsos positivos no es expresable con un
-- `ILIKE` sobre la columna original (un patrón con `%` entre dígitos acepta
-- letras u otros caracteres arbitrarios entre ellos).
--
-- Solución: una columna GENERADA y almacenada, `identification_search`, que
-- contiene la identificación sin guiones ni espacios y en minúsculas. Al ser
-- generada por la base:
--   * no puede quedar desincronizada (se recalcula en INSERT y en UPDATE);
--   * no requiere trigger ni cambios en las acciones de la aplicación;
--   * no altera `identification_number`, que sigue siendo el valor visible;
--   * sirve igual para personas físicas y jurídicas.
--
-- La misma regla la aplica la aplicación al normalizar el texto buscado
-- (`normalizeIdentificationForSearch`): quitar guiones y espacios y pasar a
-- minúsculas.
--
-- Compatibilidad: no se reescribe ningún dato de negocio ni se agregan
-- constraints. RLS no cambia (las políticas de `clients` son por fila). No se
-- crea un índice: la búsqueda es "contiene" acotada por `workspace_id` (ya
-- indexado) sobre el directorio de un solo Workspace, donde un índice B-tree
-- no aplica y uno trigram (pg_trgm) sería una dependencia nueva sin
-- beneficio medido.
--
-- Rollback práctico (nada depende de la columna fuera de la búsqueda):
--   alter table public.clients drop column identification_search;

alter table public.clients
  add column identification_search text
  generated always as (
    lower(regexp_replace(identification_number, '[[:space:]-]', '', 'g'))
  ) stored;
