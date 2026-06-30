# UFLA DOCX Acadêmico

Site estático de tela única para importar, revisar, validar e gerar arquivos DOCX de trabalhos acadêmicos conforme as regras centrais do Manual de normalização da UFLA.

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
- Área de IA opcional, desligada por padrão e sem chamada real de API nesta versão.

## Observações

O `PRD.md` e o PDF do Manual da UFLA permanecem preservados na raiz do projeto. A fidelidade normativa avançada deve evoluir por comparação manual com o PDF e por novos testes de regressão.
