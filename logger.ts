import pino from "pino";
import pinoCaller from "pino-caller";

const baseLogger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
    },
  },
});

export const logger = pinoCaller(baseLogger);
