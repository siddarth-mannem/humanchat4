export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'SESSION_ACTIVE'
  | 'TARGET_OFFLINE'
  | 'TARGET_BUSY'
  | 'REQUEST_REQUIRED'
  | 'REQUESTER_BUSY';

export class ApiError extends Error {
  public status: number;
  public code: ErrorCode;
  public details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
