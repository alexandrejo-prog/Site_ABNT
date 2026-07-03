# UFLA DOCX Acadêmico

Ferramenta de apoio à normalização acadêmica UFLA/ABNT para gerar documentos `.docx` editáveis em trabalhos de graduação e pós-graduação.

**Posicionamento:** este sistema não garante conformidade normativa automática e completa. Ele estrutura o documento conforme regras centrais do Manual de Normalização da UFLA, mas a revisão final pelo usuário é sempre necessária antes da submissão.

## Como rodar

```bash
npm install
npm run dev
```

Depois abra o endereço exibido pelo Vite.

## Comandos

```bash
npm test
npm run build
npm run verify
```

## MVP implementado

- Importação de `.docx`, `.txt` e `.md`.
- Extração de texto de DOCX com `mammoth`.
- Identificação provável de campos acadêmicos com indicação de confiança.
- Formulário editável para revisão manual.
- Editor em tela única com marcadores para título, subtítulo, negrito, itálico, citação longa, referência e limpeza.
- Validação normativa com erros bloqueantes e alertas não bloqueantes.
- Geração de DOCX com A4, margens 3/3/2/2 cm, Times New Roman, corpo 12, citações longas 11, capa, folha de rosto, resumo, abstract, corpo e referências.
- Fluxo recomendado: gerar DOCX, abrir no Word ou LibreOffice, atualizar sumário/campos quando necessário e exportar para PDF para submissão final.

## Observações

O `PRD.md` e o PDF do Manual da UFLA permanecem preservados na raiz do projeto. A fidelidade normativa avançada deve evoluir por comparação manual com o PDF e por novos testes de regressão.
