# Nexa Agency OS

Data: 2026-05-16

Objetivo: organizar a Nexa como uma operacao leve de agentes especializados, sem criar custo computacional continuo. Nesta fase, os agentes sao arquivos de instrucao, checklists e contratos de saida. Eles so consomem IA quando forem chamados por uma tarefa especifica.

## Principio central

A Nexa nao deve operar como um chatbot unico. Ela deve operar como uma empresa com papeis claros:

- editorial decide o que vira noticia;
- crescimento decide como a noticia circula;
- produto decide como a experiencia melhora;
- operacoes protege custo, deploy e estabilidade;
- marca protege tom, identidade e consistencia.

Cada agente tem uma missao curta, entradas esperadas, saidas padronizadas e criterios de bloqueio. Isso evita prompts gigantes tentando resolver tudo ao mesmo tempo.

## Camadas da empresa

### 1. Redacao

Responsavel por pauta, sintese, edicao, checagem, SEO e publicacao.

Agentes iniciais:

- Editor de Pauta
- Redator Setorial
- Editor-Chefe
- Reality Checker
- Mesa de Imagens

### 2. Growth e externo

Responsavel por distribuicao, redes sociais, parcerias, comunidade e monetizacao.

Agentes iniciais:

- Growth Strategist
- Social Desk
- Partner Scout
- Newsletter Editor
- AdSense Analyst

### 3. Produto

Responsavel por UX, admin, performance, search, mobile e retencao.

Agentes iniciais:

- Product Editor
- UX Reviewer
- Performance Watcher

### 4. Operacoes

Responsavel por Cloudflare, D1, R2, KV, GitHub Actions, custos e alertas.

Agentes iniciais:

- Cloudflare Operator
- Cost Sentinel
- Deploy Reviewer

### 5. Marca

Responsavel por linguagem, tom editorial, identidade visual e consistencia da Nexa/Novo Alvo.

Agentes iniciais:

- Brand Guardian
- Voice Curator

## Como isso funciona sem pesar

Os agentes nao ficam vivos em memoria. Cada arquivo e uma receita operacional. O custo so aparece quando:

1. uma automacao chama um agente com IA;
2. um editor clica em um botao no admin;
3. um workflow do GitHub executa uma tarefa;
4. uma verificacao programada usa LLM.

O que pode rodar sem IA:

- deduplicacao de pautas;
- score de fontes;
- validacao de categoria;
- deteccao de titulo copiado;
- limpeza de HTML;
- leitura de metricas;
- comparacao de posts publicados;
- verificacao de fila vencida.

O que deve usar IA:

- sintese editorial;
- reescrita por persona;
- analise de risco de tom;
- criacao de chamadas para redes;
- diagnostico de pauta complexa;
- revisao final antes de publicar.

## Fluxo operacional recomendado

```txt
RSS / pauta manual
  -> Editor de Pauta
  -> Reality Checker
  -> Redator Setorial
  -> Editor-Chefe
  -> Mesa de Imagens
  -> SEO / Discover
  -> Fila editorial
  -> Social Desk
  -> Newsletter Editor
  -> Metricas
```

## Regras de custo

- IA nunca deve rodar em pauta de baixa qualidade.
- Toda chamada deve ter objetivo unico.
- Evitar "agentes conversando entre si" sem necessidade.
- Salvar decisoes no D1 para nao pagar duas vezes pelo mesmo raciocinio.
- Usar regras locais antes de chamar IA.
- Rodar agentes externos em lote, nao em tempo real, quando possivel.

## Primeira fase implementavel

Sem mexer no runtime atual:

1. Versionar os agentes em `docs/agents/`.
2. Usar estes arquivos como fonte de prompts para o admin.
3. Criar depois um painel "Agencia" no admin.
4. Conectar um agente por vez.

Ordem recomendada:

1. Growth Strategist
2. Social Desk
3. Newsletter Editor
4. Partner Scout
5. Cost Sentinel

## Contrato padrao de saida

Quando um agente for chamado por IA, ele deve responder em JSON puro:

```json
{
  "status": "ok",
  "summary": "decisao em uma frase",
  "actions": [],
  "risks": [],
  "next_check": "quando revisar novamente"
}
```

## Criterios de bloqueio

Um agente deve bloquear ou pedir revisao humana quando:

- o dado principal nao tem fonte forte;
- a categoria esta incoerente;
- o texto parece clipping;
- a chamada social promete mais do que a materia entrega;
- o risco juridico/reputacional e alto;
- a publicacao pode gerar custo operacional inesperado;
- ha repeticao de pauta ja publicada.

