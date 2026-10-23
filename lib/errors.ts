export class ConfigError extends Error {
  constructor() {
    super("ParkPulse needs an NPS API key before it can load park conditions.");
    this.name = "ConfigError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}
