# Modelo de verificação contínua

A ferramenta remota bloqueou a criação direta de arquivos em `.github/workflows` nesta rodada. Enquanto isso, o repositório mantém o comando local obrigatório:

```bash
npm run verify
```

Quando a escrita de workflow estiver liberada, criar `.github/workflows/verify.yml` com o conteúdo abaixo:

```yaml
name: Verify

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

Critério de aceite: qualquer alteração deve passar em `npm test`, `npm run build` e `npm run verify` antes de ser considerada estável.
