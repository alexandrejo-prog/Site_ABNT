# PRD — Site único para criação de documentos acadêmicos normalizados pela UFLA

## 1. Nome provisório

**Site Normas UFLA**

Site único para importar, editar, validar e gerar arquivos acadêmicos em formato `.docx`, seguindo o **Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA** e o **template oficial de formato padrão da UFLA**.

---

## 2. Objetivo do produto

Criar um site simples, estático e funcional, sem separação entre backend e frontend, capaz de gerar documentos acadêmicos normalizados conforme o padrão da UFLA.

O sistema deverá atender, inicialmente, aos seguintes tipos de trabalho:

- artigo;
- monografia;
- dissertação;
- tese;
- outros formatos acadêmicos compatíveis.

A saída principal será um arquivo `.docx`, pois o documento acadêmico precisa permanecer editável no Word ou em editor compatível.

O PDF poderá ser tratado futuramente apenas como exportação secundária, para conferência visual ou envio final, mas não será a base do sistema.

---

## 3. Regra central do produto

O sistema não será um sistema acadêmico grande. Será um **site único**, com uma única tela principal, sem módulos separados, sem painel administrativo, sem banco de dados obrigatório, sem autenticação e sem arquitetura backend/frontend separada.

Toda a lógica principal deverá rodar no navegador do usuário.

---

## 4. Fontes normativas e estruturais

O sistema deverá seguir, nesta ordem de prioridade:

1. **Manual de Normalização e Estrutura de Trabalhos Acadêmicos da UFLA**;
2. **Template oficial de formato padrão da UFLA em Word**;
3. **Conteúdo importado ou digitado pelo usuário**;
4. **Configurações editáveis definidas pelo usuário dentro da página**.

O template oficial deve ser usado como referência estrutural para capa, folha de rosto, resumo, abstract, indicadores de impacto, sumário, corpo textual, referências, anexos e apêndices.

O template enviado contém a estrutura visual real esperada, incluindo logo da UFLA na capa, autor, título, local, ano, folha de rosto, resumo, abstract, introdução, referências, anexos e apêndices. :contentReference[oaicite:0]{index=0}

---

## 5. Escopo obrigatório

O site deverá permitir dois fluxos de uso.

### 5.1. Usar arquivo próprio já elaborado

O usuário poderá importar um arquivo já existente. O sistema deverá tentar identificar automaticamente os campos e seções do trabalho, tais como:

- autor;
- título;
- subtítulo;
- curso;
- programa;
- orientador;
- coorientador;
- local;
- ano;
- resumo;
- palavras-chave;
- abstract;
- keywords;
- introdução;
- desenvolvimento;
- conclusão ou considerações finais;
- referências;
- anexos;
- apêndices.

Após a importação, tudo deverá ficar editável.

### 5.2. Editar o texto diretamente no site

O usuário poderá preencher os campos acadêmicos manualmente e escrever ou colar o texto no editor da própria página.

Antes da geração do arquivo final, o usuário deverá poder revisar e editar todos os dados.

---

## 6. Fora do escopo

Este projeto **não terá**:

- backend;
- API própria;
- banco de dados;
- login;
- autenticação;
- painel administrativo;
- múltiplas telas;
- rotas separadas;
- editor colaborativo;
- integração com sistemas da UFLA;
- geração automática de conteúdo acadêmico;
- sugestões automáticas de escrita;
- interação com serviços externos de texto;
- uso de chaves de API;
- integração com IA.

---

## 7. Formato de saída

### 7.1. Saída principal

A saída principal deverá ser:

```text
.docx