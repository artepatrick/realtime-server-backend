/**
 * Serviço de conexão com a API OpenAI Realtime
 *
 * Gerencia as conexões WebSocket com a API OpenAI Realtime,
 * enviando e recebendo eventos.
 */
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const config = require("../config/config");
const logger = require("../utils/logger");

class OpenAIService {
  constructor() {
    this.connections = new Map(); // Mapa de conexões abertas com a OpenAI
    this.pendingResponses = new Map(); // Armazena callbacks para eventos esperados
  }

  async sendEvent(connectionId, event) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Conexão não encontrada: ${connectionId}`);
    }

    try {
      // Adicionar ID ao evento se não existir
      if (!event.event_id) {
        event.event_id = `evt_${Date.now()}_${uuidv4().slice(0, 8)}`;
      }

      // Enviar evento como string JSON
      connection.ws.send(JSON.stringify(event));
      logger.debug(`Evento enviado para OpenAI`, {
        connectionId,
        eventType: event.type,
        eventId: event.event_id,
      });

      return event.event_id;
    } catch (error) {
      logger.error(`Erro ao enviar evento para OpenAI: ${error.message}`, {
        connectionId,
        error,
      });
      throw error;
    }
  }

  /**
   * Cria uma nova conexão com a API OpenAI Realtime
   * @param {string} clientId - ID do cliente que solicitou a conexão
   * @returns {Promise<string>} - ID da conexão criada
   */
  async createConnection(clientId) {
    try {
      const connectionId = uuidv4();

      logger.info(`Criando nova conexão com OpenAI para cliente ${clientId}`, {
        clientId,
        connectionId,
      });

      // Construir URL com o modelo configurado
      const url = `${config.openai.apiUrl}?model=${config.openai.model}`;

      // Criar conexão WebSocket
      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      });

      // Configurar handlers
      ws.on("open", () => {
        logger.info(`Conexão estabelecida com OpenAI`, { connectionId });
      });

      ws.on("error", (error) => {
        logger.error(`Erro na conexão OpenAI: ${error.message}`, {
          connectionId,
          error,
        });
      });

      // Armazenar a conexão
      this.connections.set(connectionId, {
        ws,
        clientId,
        created: Date.now(),
      });

      // Aguardar a conexão ser estabelecida
      await new Promise((resolve, reject) => {
        ws.on("open", resolve);
        ws.on("error", reject);

        // Timeout para estabelecer conexão
        setTimeout(
          () => reject(new Error("Timeout ao conectar com OpenAI")),
          10000
        );
      });

      return connectionId;
    } catch (error) {
      logger.error(`Falha ao criar conexão com OpenAI: ${error.message}`, {
        clientId,
        error,
      });
      throw error;
    }
  }

  /**
   * Fecha uma conexão com a API OpenAI
   * @param {string} connectionId - ID da conexão a ser fechada
   */
  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.info(`Fechando conexão com OpenAI`, { connectionId });
      connection.ws.close();
      this.connections.delete(connectionId);
    }
  }

  /**
   * Configura um callback para processar mensagens da OpenAI
   * @param {string} connectionId - ID da conexão
   * @param {Function} messageHandler - Função para processar as mensagens
   */
  setMessageHandler(connectionId, messageHandler) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Log detalhado da mensagem recebida
          logger.info(`RECEBIDO DA OPENAI: ${message.type}`, {
            connectionId,
          });

          // Tratamento especial para diferentes tipos de mensagens
          if (message.type === "response.text.delta") {
            logger.info(`Delta de texto recebido: "${message.delta}"`, {
              connectionId,
            });
          } else if (message.type === "response.audio.delta") {
            logger.info(
              `Delta de áudio recebido: ${
                message.delta ? "dados presentes" : "sem dados"
              }`,
              {
                connectionId,
              }
            );
          } else if (message.type === "error") {
            logger.error(
              `Erro recebido da OpenAI: ${JSON.stringify(message.error)}`,
              {
                connectionId,
              }
            );
          } else {
            // Para outros tipos de mensagem, logar o conteúdo completo
            const messageStr = JSON.stringify(message);
            // Limitar o tamanho do log para evitar poluir os logs
            const truncatedStr =
              messageStr.length > 1000
                ? messageStr.substring(0, 1000) + "..."
                : messageStr;

            logger.info(`Mensagem completa da OpenAI: ${truncatedStr}`, {
              connectionId,
            });
          }

          // Chamar o handler original
          messageHandler(message);
        } catch (error) {
          logger.error(
            `Erro ao processar mensagem da OpenAI: ${error.message}`,
            { connectionId, error }
          );
        }
      });

      // Adicionar handler para eventos de erro no WebSocket
      connection.ws.on("error", (error) => {
        logger.error(`Erro no WebSocket com OpenAI: ${error.message}`, {
          connectionId,
          error,
        });
      });
    }
  }

  /**
   * Aguarda por um tipo específico de evento como resposta
   * @param {string} connectionId - ID da conexão
   * @param {string} eventType - Tipo de evento esperado
   * @param {number} timeout - Tempo máximo de espera em ms
   * @returns {Promise<Object>} - Evento recebido
   */
  waitForEvent(connectionId, eventType, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return reject(new Error(`Conexão não encontrada: ${connectionId}`));
      }

      // Criar ID para este listener
      const listenerId = uuidv4();

      // Configurar timeout
      const timeoutId = setTimeout(() => {
        this.pendingResponses.delete(listenerId);
        reject(new Error(`Timeout esperando por evento: ${eventType}`));
      }, timeout);

      // Registrar listener
      const listener = (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === eventType) {
            clearTimeout(timeoutId);
            this.pendingResponses.delete(listenerId);
            connection.ws.removeListener("message", listener);
            resolve(message);
          }
        } catch (error) {
          // Ignorar erros de parsing
        }
      };

      // Armazenar o listener para limpeza posterior
      this.pendingResponses.set(listenerId, { listener, timeoutId });

      // Adicionar o listener
      connection.ws.on("message", listener);
    });
  }
}

module.exports = new OpenAIService();
