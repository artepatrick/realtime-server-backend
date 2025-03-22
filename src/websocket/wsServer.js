/**
 * Servidor WebSocket
 *
 * Gerencia conexões WebSocket de clientes, encaminhando
 * mensagens para o serviço OpenAI Realtime.
 */
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const sessionManager = require("./sessionManager");
const logger = require("../utils/logger");
const { handleClientMessage } = require("./wsHandler");

class WebSocketServer {
  constructor(server) {
    this.server = null;
    this.clients = new Map(); // Mapa de clientes conectados
    this.pingInterval = null;
  }

  /**
   * Inicializa o servidor WebSocket
   * @param {Object} options - Opções para o servidor WebSocket
   */
  initialize(options = {}) {
    logger.info("Inicializando servidor WebSocket");

    // Criar servidor WebSocket
    this.server = new WebSocket.Server({
      port: options.port,
      perMessageDeflate: true,
      clientTracking: true,
      ...options,
    });

    // Configurar handlers de eventos
    this.server.on("connection", this.handleConnection.bind(this));
    this.server.on("error", this.handleServerError.bind(this));

    // Iniciar verificação de ping para conexões ativas
    this.startPingInterval();

    logger.info(`Servidor WebSocket inicializado na porta ${options.port}`);
  }

  /**
   * Inicia verificação periódica de conexões ativas
   */
  startPingInterval() {
    // Verificar clientes a cada 30 segundos
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          // Enviar ping para verificar se o cliente está ativo
          client.ws.ping(JSON.stringify({ type: "ping" }));

          // Verificar se o cliente respondeu ao último ping
          if (client?.lastPong && Date.now() - client?.lastPong > 60000) {
            // 60 segundos
            logger.warn(`Cliente não respondeu ao ping, fechando conexão`, {
              clientId,
            });
            this.handleClientDisconnect(clientId);
          }
        } else if (client.ws.readyState !== WebSocket.CONNECTING) {
          // Cliente desconectado, limpar
          this.handleClientDisconnect(clientId);
        }
      });
    }, 30000);
  }

  /**
   * Processa nova conexão de cliente
   * @param {WebSocket} ws - WebSocket do cliente
   * @param {Object} req - Request HTTP original
   */
  async handleConnection(ws, req) {
    const clientId = uuidv4();
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    logger.info(`Nova conexão WebSocket`, { clientId, clientIp });

    // Armazenar cliente
    this.clients.set(clientId, {
      ws,
      ip: clientIp,
      connected: Date.now(),
      lastPong: Date.now(),
    });

    try {
      // Criar sessão para o cliente
      await sessionManager.createSession(clientId, ws);

      // Configurar handlers para o cliente
      ws.on("message", (data, isBinary) => {
        logger.info(
          `CHegou alguma coisa! ${JSON.stringify(data).substring(0, 100)}`
        );
        const message = isBinary ? data : data.toString();
        this.handleClientMessage(clientId, message);

        // Enviar mensagem de erro e fechar conexão
        ws.send(
          JSON.stringify({
            type: "message",
            error: {
              message: `Teste de mensagem..... opa`,
              code: "no_code_here",
            },
          })
        );
      });

      ws.on("close", () => this.handleClientDisconnect(clientId));
      ws.on("error", (error) => this.handleClientError(clientId, error));
      ws.on("pong", () => (this.clients.get(clientId).lastPong = Date.now()));

      // Enviar mensagem de conexão bem-sucedida
      ws.send(
        JSON.stringify({
          type: "connection.established",
          clientId,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      logger.error(`Erro ao inicializar sessão: ${error.message}`, {
        clientId,
        error,
      });

      // Enviar mensagem de erro e fechar conexão
      ws.send(
        JSON.stringify({
          type: "error",
          error: {
            message: `Erro ao inicializar: ${error.message}`,
            code: "initialization_failed",
          },
        })
      );

      ws.close();
      this.clients.delete(clientId);
    }
  }

  /**
   * Processa mensagens recebidas de um cliente
   * @param {string} clientId - ID do cliente
   * @param {Buffer|string} data - Dados recebidos
   */
  handleClientMessage(clientId, data) {
    try {
      logger.debug("Mensagem recebida", { clientId, data, type: typeof data });

      const message = JSON.parse(data.toString());
      handleClientMessage(clientId, message);
    } catch (error) {
      logger.error(`Erro ao processar mensagem: ${error.message}`, {
        clientId,
        error,
      });

      // Enviar mensagem de erro ao cliente
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(
          JSON.stringify({
            type: "error",
            error: {
              message: `Erro no formato da mensagem: ${error.message}`,
              code: "invalid_message_format",
            },
          })
        );
      }
    }
  }

  /**
   * Processa desconexão de um cliente
   * @param {string} clientId - ID do cliente
   */
  handleClientDisconnect(clientId) {
    logger.info(`Cliente desconectado`, { clientId });

    // Fechar sessões do cliente
    sessionManager.closeClientSessions(clientId);

    // Remover cliente
    this.clients.delete(clientId);
  }

  /**
   * Processa erros de um cliente
   * @param {string} clientId - ID do cliente
   * @param {Error} error - Erro ocorrido
   */
  handleClientError(clientId, error) {
    logger.error(`Erro em conexão de cliente: ${error.message}`, {
      clientId,
      error,
    });
  }

  /**
   * Processa erros do servidor
   * @param {Error} error - Erro ocorrido
   */
  handleServerError(error) {
    logger.error(`Erro no servidor WebSocket: ${error.message}`, { error });
  }

  /**
   * Fecha o servidor
   */
  close() {
    if (this.server) {
      logger.info("Encerrando servidor WebSocket");

      // Parar intervalo de ping
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Fechar todas as conexões de clientes
      this.clients.forEach((client, clientId) => {
        try {
          sessionManager.closeClientSessions(clientId);
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close();
          }
        } catch (error) {
          logger.error(`Erro ao fechar conexão de cliente: ${error.message}`, {
            clientId,
            error,
          });
        }
      });

      // Limpar mapa de clientes
      this.clients.clear();

      // Fechar servidor
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = new WebSocketServer();
