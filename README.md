# Jujubordados 2.0

Vitrine digital da Jujubordados com catálogo responsivo, carrinho e registro de pedidos no Cloudflare D1. A loja usa fotos e informações do catálogo público original; disponibilidade e prazos ainda devem ser confirmados com a loja.

## Stack

- Next.js App Router, React e TypeScript para a experiência da loja.
- vinext/Vite para executar e publicar no Cloudflare Workers.
- Cloudflare D1 para persistir pedidos e seus itens.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Crie `.env.local` a partir de `.env.example` e configure o número oficial do WhatsApp com DDI e DDD antes de ativar o envio de pedidos.

## D1

Aplique o esquema no banco remoto:

```bash
npx wrangler d1 migrations apply jujubordados-production --remote
```

As migrações ficam em `migrations/`. O endpoint `POST /api/orders` grava o pedido e os itens no D1 antes de direcionar o cliente ao WhatsApp.

## Publicação

A aplicação está configurada para Cloudflare Workers com cache, otimização de imagens e prerender desativados. Para publicar:

```bash
npm run deploy:vinext
```

O binding `DB` é definido em `cloudflare.config.ts`. Não coloque tokens ou segredos no repositório.

## Painel administrativo

O painel existente continua disponível localmente para desenvolvimento. Em produção, `/painel` fica bloqueado enquanto não houver autenticação e persistência administrativa seguras. O conteúdo do painel ainda usa armazenamento local do navegador e não é sincronizado com D1.
