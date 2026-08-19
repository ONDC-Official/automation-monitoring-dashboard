/**
 * Typed failures, and the one thing they carry that a bare `Error` cannot: the
 * HTTP status a route should answer with.
 *
 * A service never touches Fastify, so it cannot choose a status code by
 * replying — it chooses one by *throwing*. Without that, every route grows its
 * own `instanceof`-free guesswork and a "not found" eventually ships as a 500,
 * which is the difference between a caller retrying forever and a caller
 * stopping.
 *
 * The distinction that matters on the ingest path specifically: the engine's
 * `SpoolAndUploadSink` treats **any 2xx** as delivered-and-never-retry, and any
 * non-2xx as still-pending. So a 4xx is a permanent refusal of a report and a
 * 5xx is a promise to accept it later. Never blur the two by accident.
 */
export class HttpError extends Error {
  readonly status: number;
  /** Machine-readable detail for the response body. Never a raw payload. */
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

/** The body is unusable. Deliberately rare on the ingest — see `report.schema.ts`. */
export class BadRequestError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(404, message, details);
  }
}

/**
 * A dependency we do not own failed — Prometheus, Loki, Grafana.
 *
 * 502 rather than 500 on purpose: it says "the failure is not in this service",
 * which is the first thing an operator needs to know and the last thing a 500
 * tells them.
 */
export class UpstreamError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(502, message, details);
  }
}

/** True for anything carrying a status this service chose. */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
