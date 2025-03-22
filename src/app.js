/**
 * Ponto de entrada da aplicação
 *
 * Inicializa o servidor WebSocket e gerencia ciclo de vida
 * da aplicação.
 */
const express = require("express");
const http = require("http");
const wsServer = require("./websocket/wsServer");
const config = require("./config/config");
const logger = require("./utils/logger");

// Verificar variáveis de ambiente necessárias
if (!process.env.OPENAI_API_KEY) {
  logger.error(
    "API key da OpenAI não encontrada. Defina a variável de ambiente OPENAI_API_KEY."
  );
  process.exit(1);
}

// Criar aplicação Express para disponibilizar uma API REST simples
const app = express();

// Middleware para JSON
app.use(express.json());

// Rota simples para verificar se o servidor está online
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Informações sobre o servidor
app.get("/info", (req, res) => {
  res.json({
    name: "OpenAI Realtime Server",
    version: "1.0.0",
    wsPort: config.server.port,
    environment: process.env.NODE_ENV || "development",
  });
});

// Criar servidor HTTP
const server = http.createServer(app);

// Iniciar o servidor WebSocket
wsServer.initialize({
  port: config.server.port,
});

// Iniciar o servidor HTTP
const httpPort = process.env.HTTP_PORT || 3000;
server.listen(httpPort, () => {
  logger.info(`Servidor HTTP iniciado na porta ${httpPort}`);
  logger.info(`Servidor WebSocket iniciado na porta ${config.server.port}`);
});

// Tratar sinal de interrupção para encerramento limpo
process.on("SIGINT", () => {
  logger.info("Sinal SIGINT recebido. Encerrando aplicação...");
  shutdown();
});

process.on("SIGTERM", () => {
  logger.info("Sinal SIGTERM recebido. Encerrando aplicação...");
  shutdown();
});

// Função para encerramento limpo da aplicação
function shutdown() {
  // Fechar servidor WebSocket
  wsServer.close();

  // Fechar servidor HTTP
  server.close(() => {
    logger.info("Servidor HTTP encerrado");

    // Encerrar o processo
    process.exit(0);
  });

  // Forçar encerramento após 10 segundos se não encerrar normalmente
  setTimeout(() => {
    logger.error("Encerramento forçado após timeout");
    process.exit(1);
  }, 10000);
}

// Tratar erros não capturados
process.on("uncaughtException", (error) => {
  logger.error(`Erro não capturado: ${error.message}`, { error });
  // Em produção, pode ser melhor reiniciar a aplicação após um erro não capturado
  if (process.env.NODE_ENV === "production") {
    shutdown();
  }
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Rejeição de Promise não tratada", { reason });
});
