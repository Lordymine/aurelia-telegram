# Aurelia Telegram — Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Democratizar o acesso ao ADE (Autonomous Development Engine) através de uma interface conversacional no Telegram
- Permitir que qualquer desenvolvedor controle o pipeline completo do ADE (Spec → Execute → Recover → QA → Learn) via linguagem natural
- Usar Kimi (Moonshot) como camada de tradução inteligente entre linguagem humana e comandos ADE
- Criar um produto open-source instalável via npm, com modelo BYOK (Bring Your Own Key)
- Suportar múltiplos usuários e múltiplos projetos simultaneamente
- Suportar deployment local (máquina do dev) ou remoto (VPS)

### Background Context

O Synkra AIOS é um meta-framework que orquestra agentes AI para desenvolvimento full-stack autônomo. O ADE é seu motor central — coordena 5 epics sequenciais (Spec Pipeline, Execution Engine, Recovery, QA Loop, Memory Layer) para transformar requisitos em código verificado. Porém, hoje o ADE só é acessível via Claude Code CLI no terminal, limitando seu uso a quem está no desktop.

Aurelia Telegram resolve isso criando um gateway conversacional: o usuário envia mensagens naturais no Telegram, o Kimi (escolhido por sua qualidade em interpretação de código) traduz essas mensagens em ações ADE, e traduz as respostas de volta para linguagem acessível. Isso permite controlar desenvolvimento de qualquer lugar — do celular, tablet, ou qualquer dispositivo com Telegram.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-05 | 0.1 | Initial PRD draft | Morgan (PM) |

---

## Requirements

### Functional

- **FR1:** O sistema deve registrar e operar um bot Telegram via Bot API (webhook ou long polling)
- **FR2:** O instalador deve solicitar: (a) Token do bot Telegram, (b) telegram_id do usuário para autorização, (c) autenticação Kimi via device code flow usando a assinatura do usuário no Kimi for Coding
- **FR3:** O sistema deve enviar cada mensagem do usuário ao Kimi (Moonshot) para interpretação e tradução em comandos ADE
- **FR4:** O Kimi deve receber um protocol document com contexto completo do ADE (agentes disponíveis, comandos, estado atual) para traduzir corretamente as intenções do usuário
- **FR5:** O sistema deve executar os comandos traduzidos no ADE via Claude Code CLI (spawn process)
- **FR6:** As respostas do ADE devem ser traduzidas pelo Kimi de volta para linguagem acessível e formatadas para Telegram (markdown, limites de caracteres)
- **FR7:** O sistema deve manter contexto de conversa por sessão (histórico, projeto ativo, estado do pipeline)
- **FR8:** O usuário deve poder iniciar o Spec Pipeline (enviar requisitos em linguagem natural → ADE gera spec)
- **FR9:** O usuário deve poder disparar o Execution Engine (planejar e executar subtasks)
- **FR10:** O usuário deve poder acionar agentes específicos (@dev, @qa, @architect, etc.) via chat
- **FR11:** O sistema deve suportar o fluxo de Recovery — notificar falhas e permitir decisões de retry/rollback
- **FR12:** O sistema deve expor o QA Loop — mostrar resultados de review e permitir aprovações
- **FR13:** O bot deve enviar notificações proativas de progresso (task completada, gate atingido, erro detectado)
- **FR14:** O usuário deve poder consultar status a qualquer momento ("o que está rodando?", "qual o progresso?")
- **FR15:** O sistema deve solicitar aprovações de quality gates via inline keyboards do Telegram
- **FR16:** O sistema deve ser instalável via `npm install aurelia-telegram` (ou `npx aurelia-telegram init`)
- **FR17:** O instalador deve incluir um wizard de configuração interativo (bot token, telegram_id, Kimi device code auth)
- **FR18:** O pacote deve expor CLI para gerenciar o bot (start, stop, status, config)
- **FR19:** O sistema deve funcionar com qualquer projeto que tenha AIOS instalado
- **FR20:** Múltiplos usuários Telegram devem poder usar o mesmo bot, cada um com seu contexto isolado
- **FR21:** Cada usuário se autentica no Kimi via device code flow (o bot gera um código, usuário autoriza no site do Kimi, bot recebe token da sessão vinculada à assinatura Kimi for Coding)
- **FR22:** O bot deve suportar deployment local (máquina do dev) ou remoto (VPS), com a mesma configuração e comportamento
- **FR23:** O telegram_id deve funcionar como whitelist de acesso — apenas usuários autorizados interagem com o bot

### Non Functional

- **NFR1:** Tempo de resposta para queries simples (status, help) deve ser < 3 segundos
- **NFR2:** Operações ADE devem mostrar feedback imediato ("processando...") com updates incrementais
- **NFR3:** API keys e tokens devem ser armazenados de forma segura (encriptados at rest, nunca expostos em logs)
- **NFR4:** Codebase em TypeScript com strict mode
- **NFR5:** Compatível com Node.js 18+
- **NFR6:** Cross-platform: Windows, macOS, Linux
- **NFR7:** Mensagens longas do ADE devem ser fragmentadas respeitando o limite de 4096 chars do Telegram
- **NFR8:** Logging estruturado para debugging (com níveis: debug, info, warn, error)
- **NFR9:** Tamanho do pacote npm deve ser < 5MB
- **NFR10:** Graceful shutdown — bot deve encerrar sessões ADE em andamento corretamente ao parar
- **NFR11:** Rate limiting para proteção contra abuso (por usuário)
- **NFR12:** Documentação completa: README, guia de instalação, API reference
- **NFR13:** Device code flow do Kimi deve implementar refresh token para manter sessão ativa

---

## Technical Assumptions

### Repository Structure: Monorepo (single package)

Pacote npm único contendo bot, CLI, e bridge ADE.

### Service Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Telegram    │────▶│  Aurelia     │────▶│  Claude     │
│  Bot API     │◀────│  Telegram    │◀────│  Code CLI   │
└─────────────┘     │  (Node.js)   │     │  (ADE)      │
                    │              │     └─────────────┘
                    │  ┌────────┐  │
                    │  │ Kimi   │  │
                    │  │ LLM    │  │
                    │  └────────┘  │
                    └──────────────┘
```

- **Runtime:** Node.js 18+ com TypeScript strict
- **Telegram SDK:** grammY (moderno, TypeScript-native, middleware-based)
- **CLI:** Commander.js para CLI do pacote
- **ADE Bridge:** Spawn de processo Claude Code CLI com stdin/stdout pipe
- **Kimi Auth:** Device code OAuth flow com token persistence
- **Config Storage:** Arquivo local `.aurelia/config.json` no projeto
- **Session Storage:** In-memory com opção de persistence (SQLite para VPS multi-user)

### Testing Requirements

- Unit tests com Vitest
- Integration tests para o flow Telegram → Kimi → ADE
- Mocks para Telegram API e Kimi API nos testes

### Additional Technical Assumptions

- O Claude Code CLI deve estar instalado e autenticado na máquina onde o bot roda
- Kimi for Coding device code flow segue padrão OAuth 2.0 Device Authorization Grant (RFC 8628)
- O bot usa long polling por padrão (simples), com opção de webhook para VPS com domínio
- O protocol document do Kimi será um arquivo markdown mantido no pacote, descrevendo todas as capacidades ADE
- Message splitting inteligente: quebra em pontos lógicos (parágrafos, code blocks), não no meio de frases

---

## Epic List

### Epic 1: Foundation — Bot, CLI & Infraestrutura Core
Estabelecer o projeto npm, bot Telegram funcional, CLI de gerenciamento, e sistema de configuração. Entrega: bot respondendo no Telegram com echo simples + `npx aurelia-telegram init` funcionando.

### Epic 2: Kimi Integration — Autenticação & Tradução
Implementar device code auth com Kimi, protocol document do ADE, e engine de tradução bidirecional (user→ADE, ADE→user). Entrega: usuário conversa no Telegram e Kimi traduz intenções corretamente.

### Epic 3: ADE Bridge — Execução & Monitoramento
Criar a ponte com Claude Code CLI, execução de comandos ADE, gerenciamento de jobs assíncronos, progress tracking, e notificações. Entrega: pipeline ADE completo acessível via Telegram.

### Epic 4: Multi-user, Polish & Release
Suporte multi-usuário com sessões isoladas, inline keyboards para approvals, message formatting avançado, rate limiting, documentação, e publicação npm. Entrega: v1.0.0 publicada no npm.

---

## Epic 1: Foundation — Bot, CLI & Infraestrutura Core

**Goal:** Criar a base do projeto — um pacote npm funcional com bot Telegram respondendo, CLI de gerenciamento, e wizard de configuração. Ao final, `npx aurelia-telegram init` configura tudo e `aurelia-telegram start` inicia o bot.

### Story 1.1: Project Scaffolding & npm Package Setup

As a developer,
I want to install aurelia-telegram via npm,
so that I can quickly set up the Telegram-ADE bridge in my project.

**Acceptance Criteria:**
1. Projeto TypeScript inicializado com `tsconfig.json` strict mode
2. `package.json` configurado com name `aurelia-telegram`, bin entry, e scripts (build, test, lint)
3. Estrutura de diretórios: `src/`, `src/bot/`, `src/cli/`, `src/bridge/`, `src/kimi/`, `src/config/`
4. ESLint + Prettier configurados
5. Vitest configurado para testes
6. `.gitignore` adequado (node_modules, dist, .env, .aurelia/)
7. Build gera output em `dist/` com sourcemaps

### Story 1.2: Configuration System

As a developer,
I want a configuration system that stores my bot settings securely,
so that I don't need to reconfigure every time I start the bot.

**Acceptance Criteria:**
1. Módulo `src/config/` que lê/escreve `.aurelia/config.json` no diretório do projeto
2. Schema de configuração: `botToken`, `allowedUsers` (telegram_ids), `kimiAuth`, `projectPath`, `deployMode` (local|vps)
3. Validação de config com Zod schema
4. Valores sensíveis (tokens) encriptados no arquivo de config
5. Função `loadConfig()` e `saveConfig()` exportadas
6. Fallback para variáveis de ambiente (AURELIA_BOT_TOKEN, etc.)
7. Testes unitários para load, save, validate, encrypt/decrypt

### Story 1.3: CLI & Interactive Setup Wizard

As a developer,
I want to run `npx aurelia-telegram init` to configure my bot interactively,
so that setup is guided and error-free.

**Acceptance Criteria:**
1. CLI com Commander.js: comandos `init`, `start`, `stop`, `status`, `config`
2. `init` wizard interativo: solicita bot token, telegram_id, project path
3. Validação do bot token (testa conexão com Telegram API)
4. Validação do telegram_id (formato numérico)
5. Detecção automática de projeto AIOS no path (verifica `.aios-core/`)
6. Salva configuração via config system (Story 1.2)
7. Mensagem de sucesso com instruções de próximos passos
8. `aurelia-telegram start` inicia o bot, `stop` para, `status` mostra estado

### Story 1.4: Telegram Bot Core

As a developer,
I want the Telegram bot running and responding to messages,
so that I have the communication channel established.

**Acceptance Criteria:**
1. Bot Telegram usando grammY com long polling (default) e opção webhook
2. Middleware de autorização: verifica telegram_id contra whitelist de config
3. Mensagem de rejeição para usuários não autorizados
4. Comando `/start` com mensagem de boas-vindas e instruções
5. Comando `/help` com lista de capacidades
6. Comando `/status` com estado atual do bot e conexões
7. Echo handler temporário: repete a mensagem do usuário (placeholder para Kimi)
8. Graceful shutdown (SIGINT/SIGTERM)
9. Logging estruturado com pino (info, debug, error)
10. Testes unitários com mocks do grammY

---

## Epic 2: Kimi Integration — Autenticação & Tradução

**Goal:** Integrar o Kimi for Coding via device code authentication e implementar a engine de tradução bidirecional. Ao final, o usuário conversa naturalmente no Telegram e o Kimi interpreta as intenções e traduz respostas.

### Story 2.1: Kimi Device Code Authentication

As a developer,
I want to authenticate with Kimi using my subscription via device code,
so that the bot can use my Kimi for Coding account for translation.

**Acceptance Criteria:**
1. Módulo `src/kimi/auth.ts` implementando OAuth 2.0 Device Authorization Grant (RFC 8628)
2. Flow: bot gera device code → mostra código + URL no Telegram → usuário autoriza no browser → bot recebe access token
3. Token persistence em `.aurelia/config.json` (encriptado)
4. Refresh token automático antes de expiração
5. Comando `/auth` no Telegram para iniciar o flow de autenticação
6. Comando `/auth-status` para verificar estado da autenticação
7. Mensagens claras no Telegram durante todo o flow (código, URL, status)
8. Tratamento de erros: timeout, denied, expired
9. Testes unitários com mocks do Kimi auth endpoint

### Story 2.2: ADE Protocol Document

As a developer,
I want Kimi to deeply understand all ADE capabilities,
so that it accurately translates my natural language into ADE commands.

**Acceptance Criteria:**
1. Arquivo `src/kimi/protocol.md` descrevendo completamente o ADE para o Kimi
2. Seções: agentes disponíveis (@dev, @qa, @architect, etc.), comandos de cada agente, pipeline stages, estados possíveis, formato de respostas esperado
3. Exemplos de tradução: "cria um PRD" → `@pm *create-prd`, "roda os testes" → `@qa *run-tests`
4. Instruções para Kimi sobre formatação de respostas para Telegram (concisas, markdown)
5. Instruções sobre quando pedir clarificação ao usuário vs. agir diretamente
6. Loader que injeta o protocol no system prompt de cada chamada Kimi
7. Protocol é versionado e extensível (novos agentes/comandos podem ser adicionados)

### Story 2.3: Kimi Translation Engine

As a developer,
I want my Telegram messages translated into ADE commands and vice-versa,
so that I can control development naturally.

**Acceptance Criteria:**
1. Módulo `src/kimi/translator.ts` com funções `translateUserToADE()` e `translateADEToUser()`
2. `translateUserToADE()`: envia mensagem + protocol + contexto da sessão ao Kimi, recebe comando ADE estruturado (JSON)
3. `translateADEToUser()`: envia output do ADE ao Kimi, recebe resumo legível formatado para Telegram
4. Formato de saída estruturado: `{ action, agent, command, args, confidence }`
5. Se confidence < threshold, Kimi gera pergunta de clarificação em vez de comando
6. Conversation history mantido para contexto (últimas N mensagens)
7. Message splitting: respostas longas quebradas em chunks ≤ 4096 chars
8. Testes unitários com mocks de chamadas Kimi

---

## Epic 3: ADE Bridge — Execução & Monitoramento

**Goal:** Conectar o bot ao Claude Code CLI para executar comandos ADE reais, gerenciar operações assíncronas de longa duração, e manter o usuário informado do progresso. Ao final, o pipeline ADE completo é acessível via Telegram.

### Story 3.1: Claude Code CLI Bridge

As a developer,
I want the bot to execute commands in Claude Code,
so that ADE operations run when I send messages in Telegram.

**Acceptance Criteria:**
1. Módulo `src/bridge/claude-code.ts` que spawna processo Claude Code CLI
2. Função `executeCommand(command: string): AsyncIterable<string>` que retorna output em streaming
3. Gerenciamento de processo: spawn, stdin write, stdout/stderr read, kill
4. Timeout configurável por operação
5. Detecção de estado: running, completed, failed, timeout
6. Queue de comandos (um por vez por sessão, fila para pendentes)
7. Testes unitários com mock de child_process

### Story 3.2: Async Job Management & Progress

As a developer,
I want to see real-time progress of ADE operations in Telegram,
so that I know what's happening without checking the terminal.

**Acceptance Criteria:**
1. Módulo `src/bridge/job-manager.ts` para tracking de jobs assíncronos
2. Cada operação ADE = um job com id, status, progress, output parcial
3. Mensagem de "⏳ Processing..." enviada imediatamente ao iniciar operação
4. Updates incrementais editando a mensagem existente no Telegram (não spam de novas mensagens)
5. Mensagem final com resultado completo ou resumo via Kimi
6. Comando `/jobs` para listar jobs ativos e recentes
7. Comando `/cancel` para cancelar job em andamento (kill process)
8. Testes unitários

### Story 3.3: Full Pipeline Integration

As a developer,
I want to access all ADE pipeline stages from Telegram,
so that I can manage my entire development workflow remotely.

**Acceptance Criteria:**
1. Integração com Spec Pipeline: "quero criar um spec" → inicia spec-gather-requirements
2. Integração com Execution Engine: "implementa essa story" → inicia dev-develop-story
3. Integração com QA Loop: "roda os testes" → inicia qa cycle
4. Integração com Recovery: notifica falhas, oferece opções de retry/rollback
5. Quality gate approvals via inline keyboards do Telegram
6. Agent switching: "fala com o architect" → muda contexto para @architect
7. Testes de integração para cada pipeline stage

---

## Epic 4: Multi-user, Polish & Release

**Goal:** Preparar para uso em produção com suporte multi-usuário, segurança, formatação avançada, documentação completa, e publicação no npm. Entrega: v1.0.0 publicada e pronta para uso.

### Story 4.1: Multi-user Sessions & Isolation

As a bot administrator,
I want multiple users to use the bot with isolated contexts,
so that each developer has their own workspace.

**Acceptance Criteria:**
1. Session manager com contexto isolado por telegram_id
2. Cada sessão mantém: Kimi auth, projeto ativo, conversation history, jobs ativos
3. SQLite storage para persistence de sessões (opcional, default in-memory)
4. Comando `/switch-project {path}` para mudar projeto ativo
5. Comando `/whoami` mostra info do usuário e sessão atual
6. Limpeza automática de sessões inativas (configurable TTL)
7. Testes unitários

### Story 4.2: Advanced Formatting & UX

As a Telegram user,
I want well-formatted responses and interactive controls,
so that the experience is pleasant and efficient.

**Acceptance Criteria:**
1. Inline keyboards para: aprovações, seleção de agentes, opções de retry
2. Code blocks com syntax highlighting (markdown do Telegram)
3. Message splitting inteligente: quebra em parágrafos, não no meio de código
4. Envio de arquivos pequenos (specs, stories) como documentos Telegram
5. Typing indicator enquanto processa
6. Rate limiting por usuário (configurable, default 30 msg/min)
7. Testes unitários

### Story 4.3: Documentation & npm Publish

As an open-source contributor,
I want complete documentation and easy installation,
so that I can start using aurelia-telegram quickly.

**Acceptance Criteria:**
1. README.md completo: visão geral, quick start, arquitetura, configuração
2. Guia de instalação para local e VPS
3. API reference para extensibilidade
4. CONTRIBUTING.md com guidelines
5. LICENSE (MIT)
6. Package publicável no npm com `npm publish`
7. GitHub Actions CI: lint, test, build, publish
8. Versão 1.0.0

---

## Next Steps

### Architect Prompt

> @architect — Analise este PRD para o Aurelia Telegram, um gateway conversacional Telegram → Kimi → ADE. Crie a arquitetura técnica focando em: (1) bridge com Claude Code CLI via spawn process, (2) Kimi device code auth flow, (3) protocol document structure para tradução, (4) async job management para operações ADE de longa duração, (5) estrutura do pacote npm. Use Node.js 18+, TypeScript, grammY, Commander.js.
