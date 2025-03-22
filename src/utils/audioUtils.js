/**
 * Utilitários para processamento de áudio
 *
 * Fornece funções para converter entre formatos de áudio,
 * codificar/decodificar Base64, e validar formatos de áudio.
 */
const config = require("../config/config");
const logger = require("./logger");

/**
 * Verifica se o formato de áudio é suportado
 * @param {string} format - Formato de áudio
 * @returns {boolean} - true se o formato é suportado
 */
function isAudioFormatSupported(format) {
  return config.audio.supportedFormats.includes(format);
}

/**
 * Converte um buffer base64 para Uint8Array
 * @param {string} base64 - String em Base64
 * @returns {Uint8Array} - Array de bytes
 */
function base64ToUint8Array(base64) {
  const binary = Buffer.from(base64, "base64");
  return new Uint8Array(binary);
}

/**
 * Converte Uint8Array para base64
 * @param {Uint8Array|Buffer} buffer - Buffer ou Uint8Array
 * @returns {string} - String em formato Base64
 */
function uint8ArrayToBase64(buffer) {
  if (buffer instanceof Uint8Array) {
    return Buffer.from(buffer).toString("base64");
  }
  return buffer.toString("base64");
}

/**
 * Converte PCM16 para formato Float32
 * Este é um exemplo simplificado - a implementação real dependerá
 * dos detalhes específicos de como você deseja processar o áudio
 * @param {Buffer|Uint8Array} pcm16Buffer - Buffer PCM16
 * @returns {Float32Array} - Dados de áudio em formato Float32
 */
function pcm16ToFloat32(pcm16Buffer) {
  // Garantir que temos um buffer do Node.js
  const buffer = Buffer.isBuffer(pcm16Buffer)
    ? pcm16Buffer
    : Buffer.from(pcm16Buffer);

  // Criar um array de Int16 a partir do buffer
  const int16Array = new Int16Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 2
  );

  // Converter para Float32
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    // Normalizar para valores entre -1 e 1
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
  }

  return float32Array;
}

/**
 * Converte Float32 para formato PCM16
 * @param {Float32Array} float32Array - Dados de áudio em formato Float32
 * @returns {Buffer} - Buffer PCM16
 */
function float32ToPcm16(float32Array) {
  // Criar um array Int16 para armazenar os dados
  const int16Array = new Int16Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    // Limitar os valores entre -1 e 1 e converter para Int16
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Criar um Buffer a partir do Int16Array
  return Buffer.from(int16Array.buffer);
}

/**
 * Ajusta a taxa de amostragem do áudio (downsampling/upsampling)
 * Nota: Esta é uma implementação simplificada - ajuste conforme necessário
 * @param {Float32Array} audioData - Dados de áudio em Float32
 * @param {number} originalSampleRate - Taxa de amostragem original
 * @param {number} targetSampleRate - Taxa de amostragem desejada
 * @returns {Float32Array} - Dados de áudio com nova taxa de amostragem
 */
function resampleAudio(audioData, originalSampleRate, targetSampleRate) {
  // Se as taxas são iguais, retornar o áudio original
  if (originalSampleRate === targetSampleRate) {
    return audioData;
  }

  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    // Interpolação linear simples
    const indexOriginal = i * ratio;
    const index = Math.floor(indexOriginal);
    const fraction = indexOriginal - index;

    if (index + 1 < audioData.length) {
      result[i] =
        audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
    } else {
      result[i] = audioData[index];
    }
  }

  return result;
}

module.exports = {
  isAudioFormatSupported,
  base64ToUint8Array,
  uint8ArrayToBase64,
  pcm16ToFloat32,
  float32ToPcm16,
  resampleAudio,
};
