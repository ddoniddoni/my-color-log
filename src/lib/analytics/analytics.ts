type AnalyticsProperties = Record<string, string | number | boolean | undefined>;

export function track(event: string, properties?: AnalyticsProperties): void {
  if (__DEV__) console.info(`[mycolorlog] analytics:${event}`, properties);
}
