/**
 * Handlers para eventos WebSocket
 *
 * Processa mensagens recebidas dos clientes e executa as ações
 * correspondentes no serviço OpenAI.
 */
const { v4: uuidv4 } = require("uuid");
const sessionManager = require("./sessionManager");
const logger = require("../utils/logger");
const audioUtils = require("../utils/audioUtils");
const config = require("../config/config");

/**
 * Processa uma mensagem recebida do cliente
 * @param {string} clientId - ID do cliente
 * @param {Object} message - Mensagem recebida
 */
async function handleClientMessage(clientId, message) {
  try {
    // Obter a sessão do cliente
    const session = sessionManager.getClientSession(clientId);
    if (!session) {
      logger.error(`Cliente não possui sessão ativa`, { clientId });
      return;
    }

    const sessionId = session.id;
    logger.debug(`Mensagem recebida do cliente: ${message.type}`, {
      clientId,
      sessionId,
      messageType: message.type,
    });

    // Processar a mensagem de acordo com o tipo
    switch (message.type) {
      case "session.update":
        await handleSessionUpdate(sessionId, message);
        break;

      case "input_audio_buffer.append":
        await handleAudioBufferAppend(sessionId, message);
        break;

      case "input_audio_buffer.commit":
        await handleAudioBufferCommit(sessionId, message);
        break;

      case "input_audio_buffer.clear":
        await handleAudioBufferClear(sessionId, message);
        break;

      case "response.create":
        await handleResponseCreate(sessionId, message);
        break;

      case "response.cancel":
        await handleResponseCancel(sessionId, message);
        break;

      case "conversation.item.create":
        await handleConversationItemCreate(sessionId, message);
        break;

      case "conversation.item.delete":
        await handleConversationItemDelete(sessionId, message);
        break;

      default:
        logger.warn(`Tipo de mensagem desconhecido: ${message.type}`, {
          clientId,
          sessionId,
        });
    }
  } catch (error) {
    logger.error(`Erro ao processar mensagem do cliente: ${error.message}`, {
      clientId,
      error,
    });

    // Enviar mensagem de erro ao cliente
    const session = sessionManager.getClientSession(clientId);
    if (session && session.ws && session.ws.readyState === 1) {
      const errorMessage = {
        type: "error",
        error: {
          message: `Erro ao processar solicitação: ${error.message}`,
          code: "internal_error",
        },
        event_id: message.event_id,
      };

      session.ws.send(JSON.stringify(errorMessage));
    }
  }
}

/**
 * Processa atualização de configuração de sessão
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleSessionUpdate(sessionId, message) {
  await sessionManager.sendToOpenAI(sessionId, message);
}

/**
 * Processa adição de áudio ao buffer
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleAudioBufferAppend(sessionId, message) {
  // Validar o formato de áudio
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Sessão não encontrada: ${sessionId}`);
  }

  logger.info(`Recebido buffer de áudio para encaminhar à OpenAI`, {
    sessionId,
    audioLength: message.audio ? message.audio.length : "nenhum",
  });

  // Repassar o buffer para a API OpenAI
  try {
    await sessionManager.sendToOpenAI(sessionId, message);
    logger.info(`Buffer de áudio encaminhado com sucesso à OpenAI`, {
      sessionId,
    });
  } catch (error) {
    logger.error(`Falha ao encaminhar áudio para OpenAI: ${error.message}`, {
      sessionId,
      error,
    });
    throw error;
  }
}

/**
 * Confirma o buffer de áudio
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleAudioBufferCommit(sessionId, message) {
  logger.info(`Recebida solicitação para commit do buffer de áudio`, {
    sessionId,
  });

  try {
    await sessionManager.sendToOpenAI(sessionId, message);
    logger.info(`Commit do buffer de áudio enviado com sucesso à OpenAI`, {
      sessionId,
    });
  } catch (error) {
    logger.error(`Falha no commit do buffer de áudio: ${error.message}`, {
      sessionId,
      error,
    });
    throw error;
  }
}

/**
 * Limpa o buffer de áudio
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleAudioBufferClear(sessionId, message) {
  await sessionManager.sendToOpenAI(sessionId, message);
}

/**
 * Cria uma nova resposta (solicita ao modelo)
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleResponseCreate(sessionId, message) {
  await sessionManager.sendToOpenAI(sessionId, message);
}

/**
 * Cancela uma resposta em andamento
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleResponseCancel(sessionId, message) {
  await sessionManager.sendToOpenAI(sessionId, message);
}

/**
 * Adiciona um item à conversa
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleConversationItemCreate(sessionId, message) {
  await sessionManager.sendToOpenAI(sessionId, message);
}

/**
 * Remove um item da conversa
 * @param {string} sessionId - ID da sessão
 * @param {Object} message - Mensagem recebida
 */
async function handleConversationItemDelete(sessionId, message) {
  await sessionManager.sendToOpenAI(sessionId, message);
}

// Exportar funções
module.exports = {
  handleClientMessage,
};
