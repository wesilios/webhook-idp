export interface ApiEnvelope<T> {
  Data: T | null;
  StatusCode: number;
  Code: string;
  Message: string;
  Errors: ApiErrorItem[];
}

export interface ApiErrorItem {
  ErrorCode: string;
  ErrorMessage: string;
}
