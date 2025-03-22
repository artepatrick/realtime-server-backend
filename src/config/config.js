/**
 * Configurações do servidor
 */
require("dotenv").config();

const config = {
  // Servidor WebSocket
  server: {
    port: process.env.WS_PORT || 8080,
  },

  // API OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organizationId: process.env.OPENAI_ORG_ID,
    projectId: process.env.OPENAI_PROJECT_ID,
    model: process.env.OPENAI_MODEL || "gpt-4o-realtime-preview",
    apiUrl: "wss://api.openai.com/v1/realtime",
  },

  // Configurações de áudio
  audio: {
    // Formatos suportados pela API OpenAI Realtime
    supportedFormats: ["pcm16", "g711_ulaw", "g711_alaw"],
    defaultInputFormat: "pcm16",
    defaultOutputFormat: "pcm16",
    defaultSampleRate: 24000, // 24kHz como esperado pela API
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

module.exports = config;
