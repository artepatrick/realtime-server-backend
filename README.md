# OpenAI Realtime Server

Servidor de ponte para a API OpenAI Realtime, facilitando a conexão entre clientes web e a API de streaming da OpenAI.

## Funcionalidades

- Servidor WebSocket para conexão de clientes frontend
- Proxying de mensagens para a API OpenAI Realtime
- Gerenciamento de sessões de clientes
- Suporte para streaming de áudio e texto
- Formatação e conversão de formatos de áudio

## Pré-requisitos

- Node.js 14.x ou superior
- Conta na OpenAI com acesso à API Realtime
- Chave de API da OpenAI

## Instalação

1. Clone o repositório:
   ```
   git clone <url-do-repositorio>
   cd openai-realtime-server
   ```

2. Instale as dependências:
   ```
   npm install
   ```

3. Copie o arquivo de exemplo de ambiente e configure as variáveis:
   ```
   cp .env.example .env
   ```

4. Edite o arquivo `.env` e adicione sua chave de API da OpenAI.

## Configuração

Edite o arquivo `.env` para configurar:

- Porta do servidor WebSocket (WS_PORT)
- Porta do servidor HTTP (HTTP_PORT)
- Chave de API da OpenAI (OPENAI_API_KEY)
- ID da organização OpenAI (OPENAI_ORG_ID) - opcional
- ID do projeto OpenAI (OPENAI_PROJECT_ID) - opcional
- Modelo a ser usado (OPENAI_MODEL) - padrão é 'gpt-4o-realtime-preview'
- Nível de logging (LOG_LEVEL)

## Uso

### Iniciar o servidor

```
npm start
```

Para desenvolvimento com recarga automática:

```
npm run dev
```

### Conectar clientes

Os clientes podem se conectar ao servidor WebSocket na porta configurada (padrão: 8080):

```javascript
const ws = new WebSocket('ws://localhost:8080');
```

O servidor também oferece uma API HTTP para verificação de status:

- `GET /health` - Verificar status do servidor
- `GET /info` - Obter informações sobre o servidor

## Estrutura do projeto

- `src/app.js` - Ponto de entrada da aplicação
- `src/config/` - Configurações
- `src/services/` - Serviços para API da OpenAI
- `src/utils/` - Utilitários
- `src/websocket/` - Servidor e handlers WebSocket

## Integração com o Frontend

Este servidor foi projetado para trabalhar com o cliente frontend `realtime-client-front`. O servidor WebSocket funciona como intermediário entre o cliente web e a API OpenAI Realtime, gerenciando sessões, formatos de áudio e transmissão de eventos.

## Formatos de áudio suportados

- PCM16 (16-bit PCM, 24kHz, monocanal, little-endian)
- G.711 µ-law (g711_ulaw)
- G.711 A-law (g711_alaw)

O formato padrão é PCM16, conforme esperado pela API OpenAI Realtime.

## Licença

MIT