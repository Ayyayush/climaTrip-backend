const winston = require("winston");
const { env } = require("../config/env");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp({ format: "HH:mm:ss" }),
    errors({ stack: true }),
    printf(({ level, message, timestamp: ts, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `[${ts}] ${level}: ${stack || message}${metaStr}`;
    })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
    level: env.logLevel,
    format: env.isProduction ? prodFormat : devFormat,
    transports: [new winston.transports.Console()],
    exitOnError: false,
});

module.exports = logger;
