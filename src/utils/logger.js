/**
 * Logger usando Winston
 *
 * Configura o sistema de logging para a aplicação
 */
const winston = require("winston");
const path = require("path");
const fs = require("fs");

// Garantir que o diretório de logs existe
const logDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define o formato para os logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Criar o logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "openai-realtime-server" },
  transports: [
    // Escrever todos os logs no console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          // Limitar metadados para evitar logs muito extensos
          const metaStr =
            Object.keys(meta).length > 0 && meta.service
              ? ` [${meta.service}]`
              : "";

          return `${timestamp} ${level}:${metaStr} ${message}`;
        })
      ),
    }),
    // Adicionar arquivo de log para níveis error
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Arquivo de log geral
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
