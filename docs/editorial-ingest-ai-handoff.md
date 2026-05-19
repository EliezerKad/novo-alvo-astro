# Relatorio tecnico: ingestao editorial, IA e imagens

Projeto: Portal Novo Alvo / Astro + Cloudflare Pages  
Data: 2026-05-14  
Objetivo deste documento: orientar um analista/dev externo a entender rapidamente o problema atual, as tentativas ja feitas e os caminhos provaveis de solucao.

## Resumo do problema

O portal possui um CMS editorial proprio em Astro/Cloudflare Pages. As pautas chegam por RSS do Google News, sao clusterizadas, salvas no Cloudflare D1 e depois revisadas no admin. Ao clicar em "Ver materia" ou enviar para fila, a funcao deveria gerar uma materia completa com IA, selecionar imagens e preparar o payload final para publicacao.

O estado atual e misto:

- A ingestao RSS funciona, mas as pautas ainda podem parecer repetitivas.
- O D1 recebe pautas e registros de ingestao.
- O admin exibe pautas, fontes, tags e botao de ver materia.
- O Groq foi configurado e aparece no selo do preview como `deepseek-r1-distill-llama-70b`.
- Mesmo com Groq ativo, algumas respostas caem no modelo de seguranca/fallback porque a validacao considera que a IA nao retornou `content_html` editorial completo.
- Imagens reais das fontes ainda sao instaveis. Muitas vezes o sistema cai em fallback de Unsplash ou fica sem imagem.

Erro visto no admin:

```txt
Atencao: esta previa caiu no modelo de seguranca, nao na geracao final do Gemini.
Motivo: Gemini respondeu sem uma materia editorial completa em content_html.
```

Observacao importante: a mensagem ainda fala "Gemini" por texto legado, mesmo quando o selo mostra `deepseek-r1-distill-llama-70b`. Portanto o problema nao e necessariamente Gemini; e a validacao/fallback da geracao editorial.

## Arquitetura atual

### Frontend/admin

- Admin de pautas: `src/pages/admin/pautas.astro`
- Admin de nova materia: `src/pages/admin/nova.astro`
- Listagem de noticias administrativas: `src/pages/admin/noticias.astro`

### Functions Cloudflare

- Criacao/atualizacao/listagem de pautas:
  - `functions/api/admin/pitches.ts`
- Geracao de materia a partir da pauta e publicacao/fila:
  - `functions/api/admin/queue.ts`
- IA editorial usada no editor manual:
  - `functions/api/editorial-ai/index.ts`
- Gemini helper:
  - `functions/lib/gemini.ts`
- Groq helper:
  - `functions/lib/groq.ts`

### Scripts

- Ingestao RSS e montagem de pautas:
  - `scripts/ingest-news.mjs`
- Extracao de assets das fontes:
  - `scripts/extract-source-assets.py`
- Pulso/publicacao de fila:
  - `scripts/pulse-queue.mjs`

### Dados

- Banco Cloudflare D1:
  - Binding: `EDITORIAL_DB`
  - Tabelas relevantes:
    - `articles`
    - `editorial_pitches`
    - `editorial_queue`
    - `ingest_runs`

### Storage

- R2 foi assinado e configurado pelo usuario.
- O fluxo manual de capa no admin consegue subir imagem para R2 quando uma URL valida e inserida manualmente.
- A extracao automatica de imagem real das fontes ainda falha com frequencia.

## Variaveis e bindings esperados no Cloudflare Pages

### Obrigatorias

```txt
ADMIN_TOKEN
GITHUB_TOKEN
GEMINI_API_KEY
GROQ_API_KEY
```

### Recomendadas

```txt
EDITORIAL_AI_PROVIDER=groq
GROQ_MODEL=deepseek-r1-distill-llama-70b
GEMINI_MODEL=gemini-2.5-flash
```

### Bindings

```txt
EDITORIAL_DB -> D1
VISITOR_COUNTER -> KV
AI -> Workers AI
```

Se `EDITORIAL_AI_PROVIDER=groq`, a ordem pretendida e:

```txt
Groq -> Gemini -> Workers AI
```

Sem essa variavel, a ordem pretendida e:

```txt
Gemini -> Groq -> Workers AI
```

## Tentativas ja feitas

### 1. Gemini como motor principal

Foi usado Gemini para gerar materia completa com `content_html`, titulo, meta description, imagem e campos auxiliares. O Gemini teve bons momentos, mas em varios casos:

- gerou tom errado;
- citou processo interno;
- citou fontes de forma inadequada;
- criou textos com cara de resumo de pauta;
- retornou conteudo incompleto;
- vazou termos como "pauta consolidada", "engine", "cluster" ou "Portal Novo Alvo".

Ha validadores em `functions/api/admin/queue.ts` para barrar esses vazamentos:

- `hasEditorialBody`
- `hasInternalLeak`
- `stripLeadingDuplicateTitle`
- `isBorrowedTitle`

### 2. Workers AI como fallback

Foi usado Workers AI como fallback inicial. Problema: qualidade inferior para materia longa e maior risco de texto generico.

### 3. Groq como fallback/principal

Foi criado `functions/lib/groq.ts` e adicionada chamada em:

- `functions/api/admin/queue.ts`
- `functions/api/editorial-ai/index.ts`

O Groq aparece no selo do admin, o que indica que a chamada esta acontecendo. O problema atual e que a resposta retornada ainda nao passa na validacao `hasEditorialBody`, ou o JSON vem sem `content_html` completo.

Possiveis causas:

- modelo `deepseek-r1-distill-llama-70b` pode estar retornando raciocinio, resumo ou JSON parcial;
- `response_format: { type: "json_object" }` pode nao ser suficiente para garantir `content_html` longo;
- `max_tokens` pode ainda ser insuficiente para algumas pautas;
- prompt ficou muito grande, reduzindo janela efetiva para resposta;
- validacao pode estar dura demais em alguns casos;
- erro de fallback ainda cita Gemini por mensagem legada.

### 4. Scrapling e Crawl4AI para imagens

Foram tentadas camadas de extracao:

- `scripts/extract-source-assets.py`
- Scrapling
- Crawl4AI

Objetivo: abrir URLs reais das fontes do Google News, extrair `og:image`, `twitter:image`, imagens do corpo e trechos.

Problemas observados:

- muitas fontes bloqueiam scraping;
- Google News redireciona ou mascara URL;
- algumas imagens extraidas eram logos, placeholders ou branding do Google;
- imagens reais raramente chegaram ao admin;
- fallback Unsplash ficou repetitivo;
- quando o usuario insere manualmente a URL da imagem, o sistema salva no R2 corretamente.

Conclusao: o R2 funciona; a falha principal esta antes, na descoberta automatica confiavel das imagens.

### 5. Expansao agressiva da matriz RSS

`scripts/ingest-news.mjs` foi alterado para usar varias queries por categoria e filtrar itens frescos.

Pontos relevantes:

- `FEEDS` agora usa arrays por categoria.
- `MAX_ITEM_AGE_HOURS=30`.
- Radar clusters deixaram de usar bucket de 6 horas, para evitar que pauta descartada voltasse como nova.
- `functions/api/admin/pitches.ts` foi ajustado para nao atualizar `updated_at` de pauta repetida sem ganho real de score ou fontes.

Mesmo assim, o usuario ainda viu pautas repetidas em alguns ciclos.

## Problemas atuais prioritarios

### Problema 1: Groq chama, mas materia cai no fallback

Sintoma:

- Selo mostra `deepseek-r1-distill-llama-70b`.
- Preview mostra aviso de fallback.
- Texto gerado pode ser curto, incompleto ou parecer resumo.

Arquivo principal:

```txt
functions/api/admin/queue.ts
```

Trechos a revisar:

- funcao `generateArticleWithAi`
- chamada `runGroqJson`
- validacao `hasEditorialBody`
- montagem de `prompt`
- fallback dentro do `catch`

Possiveis solucoes:

1. Separar prompt em duas fases:
   - fase A: gerar JSON estrutural curto: titulo, slug, tese, agente ativo, causa, plano de texto;
   - fase B: gerar somente `content_html` com base no plano.

2. Remover excesso do prompt principal. Hoje ele carrega personas, micro-personas, regras de imagem e regras editoriais no mesmo bloco. Pode estar grande demais.

3. Para Groq, usar modelo com melhor aderencia a JSON longo, se disponivel na conta:
   - `llama-3.3-70b-versatile`
   - `deepseek-r1-distill-llama-70b`
   - testar ambos.

4. Trocar o fallback por erro visivel mais honesto:
   - "Groq/Gemini respondeu sem content_html completo."
   - Evitar mensagem fixa citando Gemini.

5. Melhorar `hasEditorialBody` para registrar a razao exata da rejeicao:
   - texto curto;
   - sem pontuacao final;
   - vazamento interno;
   - HTML quebrado;
   - titulo duplicado;
   - content_html ausente.

### Problema 2: pautas repetitivas e categorias enviesadas

Sintoma:

- duas ingestoes trazem pautas muito parecidas;
- algumas categorias aparecem mais que outras;
- algumas pautas sao classificadas em categoria errada;
- pauta descartada pode voltar em situacoes especificas.

Arquivos:

```txt
scripts/ingest-news.mjs
functions/api/admin/pitches.ts
```

Possiveis solucoes:

1. Criar tabela `discarded_pitch_signatures` no D1:
   - armazenar `cluster_key`, `normalized_title`, `category`, `expires_at`;
   - ingestao consulta antes de salvar nova pauta.

2. Criar taxonomia deterministica antes da categoria final:
   - se titulo/fonte contem futebol/clube/jogador, forcar `Futebol`, nao `Moda` ou `Entretenimento`;
   - se contem filme/cinema/streaming, forcar `Cinema`;
   - se contem ENEM/MEC/escola, forcar `Educacao`.

3. Separar "headline topics" de "radar search":
   - headlines geram clusters principais;
   - radar so preenche lacunas por categoria.

4. Registrar metricas de ingest no admin:
   - quantos itens por categoria;
   - quantos descartados por duplicidade;
   - quantos rejeitados por idade;
   - quantos viraram pauta.

### Problema 3: imagens reais nao chegam

Sintoma:

- R2 funciona quando imagem e inserida manualmente.
- A descoberta automatica cai em Unsplash ou fica vazia.
- Algumas imagens extraidas sao logos/branding.

Arquivos:

```txt
scripts/extract-source-assets.py
scripts/ingest-news.mjs
functions/api/admin/queue.ts
```

Possiveis solucoes:

1. Criar "mesa de imagens" no admin:
   - para cada pauta, mostrar todas as imagens candidatas por fonte;
   - permitir selecionar capa e imagens internas;
   - apos selecao, subir ao R2 usando a API atual que ja funciona.

2. Fazer extracao assíncrona por pauta, nao durante ingest:
   - ingest salva fontes rapidamente;
   - admin chama endpoint `/api/admin/pitch-images?id=...`;
   - endpoint tenta extrair imagens das fontes sob demanda;
   - resultado fica salvo em `editorial_pitches.image_candidates`.

3. Usar API de busca de imagem como fallback controlado:
   - Bing Image Search ou Brave Search API;
   - query gerada por categoria + agente ativo;
   - filtrar por dominio, tamanho, licenca e safe search;
   - usar apenas se fontes reais nao fornecerem imagem.

4. Evitar baixar imagem do Google News:
   - bloquear `news.google`, `gstatic`, `googleusercontent`, logos e placeholders.

5. Se usar R2:
   - baixar a imagem escolhida;
   - validar content-type;
   - converter/normalizar nome;
   - salvar metadados de origem;
   - usar URL propria no artigo.

### Problema 4: publicacao final deve usar modelo visual oficial

Ja foi corrigido em etapas anteriores, mas deve ser preservado:

- materias publicadas pelo admin precisam cair no mesmo layout de noticia usado pelo portal;
- nao criar rota paralela isolada;
- publicacao deve gerar Markdown/content ou payload equivalente compativel com a rota `/noticia/[slug]`.

Arquivos provaveis:

```txt
functions/api/admin/queue.ts
functions/api/admin/articles.ts
src/pages/noticia/[slug].astro
src/lib/articles.ts
```

## Recomendacao tecnica de proxima intervencao

Eu recomendo atacar em tres commits pequenos, nessa ordem:

### Commit 1: observabilidade da IA

- Trocar mensagem de erro legada "Gemini respondeu..." por mensagem baseada no provider real.
- Logar motivo de rejeicao do `content_html`.
- Retornar no admin:
  - provider usado;
  - modelo;
  - erro exato;
  - tamanho do texto retornado;
  - se `content_html` veio ausente ou invalido.

Resultado esperado: parar de operar no escuro.

### Commit 2: Groq em duas fases

- Fase 1: planejar materia em JSON curto.
- Fase 2: gerar `content_html` a partir do plano.
- Validar apenas a fase 2.
- Se Groq falhar, tentar Gemini com o mesmo plano.

Resultado esperado: menos fallback, textos mais completos.

### Commit 3: mesa de imagens manual assistida

- Criar endpoint para extrair imagens por pauta sob demanda.
- Exibir cards no admin.
- Usuario seleciona capa/imagem interna.
- Sistema sobe a imagem escolhida para R2.

Resultado esperado: resolver imagem sem depender 100% de automacao fragil.

## Ponto de atencao: custo e limites

O objetivo do projeto e manter custo baixo/free quando possivel.

Cuidados:

- Nao usar scraping pesado em todas as fontes a cada 45 minutos.
- Evitar abrir navegador headless para centenas de URLs por ingest.
- Fazer extracao de imagem sob demanda no admin.
- Cachear resultado no D1.
- Usar Groq/Gemini apenas quando a pauta passar score minimo.

## Checklist rapido para o analista

1. Rodar build:

```bash
npm run build
```

2. Ver variaveis Cloudflare:

```txt
ADMIN_TOKEN
GITHUB_TOKEN
GEMINI_API_KEY
GROQ_API_KEY
EDITORIAL_AI_PROVIDER=groq
GROQ_MODEL=deepseek-r1-distill-llama-70b
```

3. Revisar:

```txt
functions/api/admin/queue.ts
functions/lib/groq.ts
functions/lib/gemini.ts
scripts/ingest-news.mjs
scripts/extract-source-assets.py
```

4. Testar uma pauta:

- abrir `/admin/pautas/`;
- clicar em "Ver materia";
- conferir modelo usado;
- conferir se `content_html` veio completo;
- conferir se imagens candidatas existem.

5. Se cair no fallback:

- verificar se `content_html` veio ausente;
- verificar se `hasInternalLeak` barrou;
- verificar se `hasEditorialBody` barrou por tamanho ou frase incompleta;
- verificar resposta crua do provedor, se logada.

## Diagnostico resumido

O sistema nao esta longe. A estrutura principal existe: D1, admin, fila, Gemini, Groq, R2, RSS e layout editorial. O problema atual nao e "falta de arquitetura"; e falta de observabilidade fina e excesso de responsabilidade num unico prompt/execucao.

A solucao mais solida e dividir:

```txt
ingestao -> pauta densa -> plano editorial -> materia completa -> mesa de imagem -> fila/publicacao
```

Hoje o sistema tenta pular de "pauta densa" direto para "materia completa com imagem perfeita". Isso e possivel, mas instavel com providers gratuitos/baratos e fontes jornalisticas que bloqueiam scraping.
