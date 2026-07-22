import "server-only";

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly safeMessage: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(options?: ErrorOptions) {
    super(
      "Authentication is required",
      "unauthorized",
      "No autorizado.",
      options,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, options?: ErrorOptions) {
    super(
      `${resource} was not found`,
      "not_found",
      "El recurso solicitado no está disponible.",
      options,
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, safeMessage: string, options?: ErrorOptions) {
    super(message, "conflict", safeMessage, options);
  }
}

export class ValidationError extends AppError {
  constructor(safeMessage: string, options?: ErrorOptions) {
    super("Validation failed", "validation", safeMessage, options);
  }
}

export class DataAccessError extends AppError {
  constructor(operation: string, options?: ErrorOptions) {
    super(
      `Data access failed during ${operation}`,
      "data_access",
      "No fue posible cargar la información. Intenta de nuevo.",
      options,
    );
  }
}

type DatabaseError = {
  code?: string;
};

/**
 * PostgREST devuelve este código cuando el `.range()` solicitado empieza más
 * allá de las filas disponibles (p. ej. un `?page=` obsoleto o manipulado a
 * mano tras borrar registros). No es un error real: significa "esta página
 * no tiene filas", así que las consultas paginadas lo detectan para
 * responder con una página vacía en vez de un 500.
 */
const RANGE_NOT_SATISFIABLE_CODE = "PGRST103";

export function isRangeNotSatisfiable(error: DatabaseError): boolean {
  return error.code === RANGE_NOT_SATISFIABLE_CODE;
}

export function throwDataAccessError(
  operation: string,
  error: DatabaseError,
): never {
  // Log only operational context and a database error code. Query payloads,
  // user data, financial values, and Supabase error details stay out of logs.
  console.error(
    `[data-access] ${operation} failed (${error.code ?? "unknown"})`,
  );
  throw new DataAccessError(operation, { cause: error });
}

export function publicErrorDetails(error: unknown): {
  message: string;
  status: number;
} {
  if (!(error instanceof AppError)) {
    return { message: "Ocurrió un error inesperado.", status: 500 };
  }

  const statusByCode: Record<string, number> = {
    unauthorized: 401,
    validation: 400,
    not_found: 404,
    conflict: 409,
    data_access: 500,
  };

  return {
    message: error.safeMessage,
    status: statusByCode[error.code] ?? 500,
  };
}
