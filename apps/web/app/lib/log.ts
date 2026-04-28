type LogArgs = readonly unknown[];

const isProduction = (): boolean => {
  const env = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  return env === undefined || env === "production";
};

export const webLog = {
  debug(...args: LogArgs): void {
    if (isProduction()) return;
    console.log(...args);
  },
  warn(...args: LogArgs): void {
    console.warn(...args);
  },
  error(...args: LogArgs): void {
    console.error(...args);
  },
};
