---
name: site_abnt_ufla
description: Desenvolvimento do Site_ABNT - editor e normalizador acadêmico conforme ABNT e Manual de Normalização da UFLA.
---

# Site_ABNT_UFLA

## Objetivo

Você trabalha exclusivamente no projeto **Site_ABNT**.

O objetivo do sistema é permitir que documentos acadêmicos sejam importados, editados, normalizados e exportados conforme:

- ABNT (NBR vigentes)
- Manual de Normalização da UFLA

O projeto prioriza:

- estabilidade;
- previsibilidade;
- compatibilidade com Microsoft Word;
- código limpo;
- testes automatizados.

Nunca implemente funcionalidades fora desse objetivo sem solicitação explícita.

---

# Escopo

O Site_ABNT **não é um conversor de PDF**.

Entradas aceitas:

- DOCX
- Markdown (.md)
- Texto (.txt)

Entradas rejeitadas:

- PDF
- ODT
- RTF
- HTML

Não restaurar suporte à importação de PDF.

Caso exista código legado relacionado a PDF, considerar apenas durante manutenção até sua remoção definitiva.

---

# Objetivo funcional

O fluxo do sistema é:

DOCX / MD / TXT

↓

Importação

↓

Modelo interno

↓

Normalização acadêmica

↓

Exportação DOCX

↓

Validação automática no Microsoft Word

---

# Princípios

Sempre preservar:

- estrutura OOXML;
- compatibilidade com Microsoft Word;
- estilos;
- imagens;
- legendas;
- tabelas;
- quadros;
- referências;
- notas de rodapé;
- sumário;
- bookmarks;
- campos PAGEREF;
- TOC quando existente.

Nunca gerar DOCX que exija reparação no Word.

---

# Fluxo de desenvolvimento

Sempre trabalhar em branch própria.

Fluxo padrão:

git switch main

git pull --ff-only

git switch -c feat/nome-da-tarefa

Nunca alterar diretamente a branch main.

Nunca utilizar worktrees, salvo solicitação explícita.

---

# Implementação

Antes de alterar código:

1. localizar os arquivos envolvidos;

2. localizar testes existentes;

3. entender dependências;

4. implementar somente o necessário;

5. evitar alterações colaterais.

Nunca fazer refatorações grandes sem solicitação.

---

# Arquitetura

Priorizar:

- funções pequenas;
- baixo acoplamento;
- alta coesão;
- código puro sempre que possível;
- reutilização;
- tipagem consistente;
- testes próximos da implementação.

Evitar:

- duplicação;
- efeitos colaterais;
- dependências desnecessárias;
- código morto.

---

# Dependências

Não instalar novas bibliotecas sem necessidade clara.

Sempre preferir utilizar dependências já existentes.

Evitar alterações desnecessárias em:

package-lock.json

---

# Microsoft Word

Todo DOCX produzido deve ser compatível com Microsoft Word.

O pipeline oficial utiliza:

ReadOnly = true

OpenAndRepair = false

Fields.Update()

ExportAsFixedFormat()

Caso o Word somente consiga abrir usando OpenAndRepair=true:

o documento deve ser considerado reprovado.

---

# Pipeline de aceitação

O pipeline possui duas etapas.

## Etapa estrutural

Valida:

- estrutura OOXML;
- relacionamentos;
- imagens;
- bookmarks;
- PAGEREF;
- TOC;
- mídia;
- integridade.

## Etapa Word

Valida:

- abertura sem reparação;
- atualização dos campos;
- atualização do sumário;
- exportação PDF;
- número de páginas;
- fechamento correto do Word.

---

# Playwright

Playwright é utilizado para testes E2E.

Os testes devem validar:

- carregamento da aplicação;
- importação DOCX;
- importação TXT;
- importação Markdown;
- edição;
- exportação;
- integração futura com o pipeline Word.

Não implementar regressão visual sem solicitação.

Não instalar bibliotecas de comparação visual sem necessidade.

---

# Testes

Antes de qualquer commit executar:

npm test

npm run build

Executar testes E2E apenas quando houver alteração relacionada.

Não ignorar falhas.

Corrigir apenas a causa real.

---

# CI

GitHub Actions é o principal validador.

Vercel é o principal validador de deploy.

Não realizar auditorias completas após cada alteração.

Executar investigação apenas quando ocorrer:

- falha do CI;
- falha do deploy;
- regressão observada.

---

# Commits

Utilizar mensagens curtas.

Exemplos:

feat:

fix:

refactor:

docs:

test:

chore:

Cada commit deve representar uma alteração lógica única.

---

# Pull Requests

Após o push:

abrir Pull Request.

Aguardar:

- GitHub Actions;
- Vercel.

Não realizar merge antes das verificações estarem aprovadas.

---

# Relatório final

Ao concluir uma tarefa informar:

- arquivos alterados;
- testes executados;
- resultado do npm test;
- resultado do npm run build;
- resultado dos testes E2E (quando aplicável);
- git status;
- SHA do commit;
- resultado do push.

Não incluir auditorias extensas quando não forem necessárias.

---

# Nunca fazer

Nunca:

- alterar main diretamente;
- usar force push;
- fazer merge automático;
- restaurar suporte a PDF;
- remover testes existentes sem motivo;
- ignorar falhas do build;
- aprovar DOCX reparados pelo Word;
- instalar dependências sem justificativa;
- modificar código não relacionado à tarefa.

---

# Prioridades

Sempre priorizar, nesta ordem:

1. Correção funcional.

2. Compatibilidade com Microsoft Word.

3. Conformidade ABNT/UFLA.

4. Testes automatizados.

5. Simplicidade da implementação.

6. Desempenho.

7. Refatoração.

---

# Filosofia do projeto

O Site_ABNT deve ser um editor e normalizador acadêmico confiável.

A prioridade é produzir documentos corretos e compatíveis com o Microsoft Word, preservando a estrutura acadêmica e facilitando a normalização conforme ABNT e Manual da UFLA.

Toda implementação deve privilegiar estabilidade, previsibilidade e facilidade de manutenção.