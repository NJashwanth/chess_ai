export class MissingApiKeyError extends Error {
  constructor(public readonly envVar: string, message: string) {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}
