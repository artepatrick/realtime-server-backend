/**
 * Gerenciador de sessões de clientes
 *
 * Mantém o controle das sessões ativas de clientes e suas
 * conexões com a API OpenAI Realtime.
 */
const { v4: uuidv4 } = require("uuid");
const openaiService = require("../services/openaiService");
const logger = require("../utils/logger");

class SessionManager {
  constructor() {
    this.sessions = new Map(); // Mapa de sessões ativas
    this.clientToSession = new Map(); // Mapeamento cliente -> sessão
  }

  /**
   * Cria uma nova sessão
   * @param {string} clientId - ID do cliente WebSocket
   * @param {Object} ws - Conexão WebSocket do cliente
   * @returns {Promise<Object>} - Objeto de sessão criado
   */
  async createSession(clientId, ws) {
    try {
      // Verificar se o cliente já tem uma sessão
      if (this.clientToSession.has(clientId)) {
        const existingSessionId = this.clientToSession.get(clientId);
        logger.warn(
          `Cliente já possui uma sessão ativa: ${existingSessionId}`,
          { clientId }
        );

        // Retornar a sessão existente
        return this.sessions.get(existingSessionId);
      }

      // Criar nova sessão
      const sessionId = uuidv4();
      logger.info(`Criando nova sessão`, { clientId, sessionId });

      // Estabelecer conexão com OpenAI
      const openaiConnectionId = await openaiService.createConnection(clientId);

      // Criar objeto de sessão
      const session = {
        id: sessionId,
        clientId,
        openaiConnectionId,
        ws,
        created: Date.now(),
        state: {
          // Estado da conversa
          sessionId: null,
          conversationId: null,
          isRecording: false,
          isConnected: true,
        },
      };

      // Configurar handler para mensagens da OpenAI
      openaiService.setMessageHandler(openaiConnectionId, (message) => {
        this.handleOpenAIMessage(sessionId, message);
      });

      // Armazenar a sessão
      this.sessions.set(sessionId, session);
      this.clientToSession.set(clientId, sessionId);

      return session;
    } catch (error) {
      logger.error(`Erro ao criar sessão: ${error.message}`, {
        clientId,
        error,
      });
      throw error;
    }
  }

  /**
   * Processa mensagens recebidas da API OpenAI
   * @param {string} sessionId - ID da sessão
   * @param {Object} message - Mensagem recebida da OpenAI
   */
  handleOpenAIMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.error(`Sessão não encontrada: ${sessionId}`);
      return;
    }

    try {
      // Atualizar o estado da sessão com base na mensagem
      this.updateSessionState(session, message);

      // Enviar a mensagem para o cliente
      if (session.ws && session.ws.readyState === 1) {
        // OPEN
        session.ws.send(JSON.stringify(message));
        logger.debug(`Mensagem enviada ao cliente`, {
          sessionId,
          messageType: message.type,
        });
      }
    } catch (error) {
      logger.error(`Erro ao processar mensagem da OpenAI: ${error.message}`, {
        sessionId,
        error,
      });
    }
  }

  /**
   * Atualiza o estado da sessão com base em mensagens da OpenAI
   * @param {Object} session - Objeto de sessão
   * @param {Object} message - Mensagem recebida da OpenAI
   */
  updateSessionState(session, message) {
    switch (message.type) {
      case "session.created":
        session.state.sessionId = message.session.id;
        logger.info(`Sessão OpenAI criada: ${session.state.sessionId}`, {
          sessionId: session.id,
        });
        break;

      case "conversation.created":
        session.state.conversationId = message.conversation.id;
        logger.info(`Conversa criada: ${session.state.conversationId}`, {
          sessionId: session.id,
        });
        break;

      case "error":
        logger.error(`Erro da API OpenAI: ${message.error.message}`, {
          sessionId: session.id,
          error: message.error,
        });
        break;
    }
  }

  /**
   * Envia um evento para a API OpenAI
   * @param {string} sessionId - ID da sessão
   * @param {Object} event - Evento a ser enviado
   * @returns {Promise<string>} - ID do evento enviado
   */
  async sendToOpenAI(sessionId, event) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Sessão não encontrada: ${sessionId}`);
    }

    return await openaiService.sendEvent(session.openaiConnectionId, event);
  }

  /**
   * Encerra uma sessão
   * @param {string} sessionId - ID da sessão a ser encerrada
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Tentativa de fechar sessão inexistente: ${sessionId}`);
      return;
    }

    logger.info(`Encerrando sessão`, { sessionId, clientId: session.clientId });

    // Fechar conexão com OpenAI
    if (session.openaiConnectionId) {
      openaiService.closeConnection(session.openaiConnectionId);
    }

    // Remover mapeamentos
    this.clientToSession.delete(session.clientId);
    this.sessions.delete(sessionId);
  }

  /**
   * Fecha todas as sessões associadas a um cliente
   * @param {string} clientId - ID do cliente
   */
  closeClientSessions(clientId) {
    const sessionId = this.clientToSession.get(clientId);
    if (sessionId) {
      this.closeSession(sessionId);
    }
  }

  /**
   * Obtém uma sessão pelo ID
   * @param {string} sessionId - ID da sessão
   * @returns {Object|null} - Objeto de sessão ou null se não encontrada
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Obtém a sessão de um cliente
   * @param {string} clientId - ID do cliente
   * @returns {Object|null} - Objeto de sessão ou null se não encontrada
   */
  getClientSession(clientId) {
    const sessionId = this.clientToSession.get(clientId);
    if (sessionId) {
      return this.sessions.get(sessionId);
    }
    return null;
  }
}

module.exports = new SessionManager();
