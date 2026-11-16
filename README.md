# Jujubordados 2.0

Vitrine responsiva da Jujubordados com catálogo, carrinho, registro de pedidos e painel protegido para consultar pedidos. As fotos e informações dos produtos foram importadas do catálogo público original; disponibilidade, estoque e prazos devem ser confirmados com a loja.

## Stack

- Next.js App Router, React e TypeScript.
- vinext/Vite no Cloudflare Workers.
- Cloudflare D1 para pedidos e itens.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Crie `.env.local` a partir de `.env.example` para informar o número oficial do WhatsApp com DDI e DDD. Sem esse número, o checkout registra o pedido e mostra a confirmação; com ele, também abre a conversa para revisão.

## D1

As migrações ficam em `migrations/`. Para aplicar as pendentes:

```bash
npx cf d1 migrations apply d811afc3-f795-4545-a58f-7ad5682a4a17 --dir migrations
```

`POST /api/orders` valida o catálogo, preços, quantidades e totais no servidor antes de gravar o pedido.

## Painel administrativo

Acesse `/painel`. A senha inicial é armazenada como segredo `ADMIN_PASSWORD` no Worker e não está no repositório. Para trocar a senha:

```bash
npx cf workers secrets update ADMIN_PASSWORD --worker jujubordados-2 --type secret_text --text <nova-senha>
```

A sessão usa cookie HttpOnly, Secure e SameSite Strict, com validade de 12 horas. A lista e a atualização de status consultam o D1 através de rotas autenticadas.

O painel antigo com cadastro de produtos, categorias, financeiro, orçamentos, cupons e frete continua local e ainda não foi migrado para persistência compartilhada. Não use seus dados como fonte operacional em múltiplos dispositivos até essa etapa ser concluída.

## Publicação

A aplicação usa Cloudflare Workers sem cache extra, Cloudflare Images ou prerender:

```bash
npm run deploy:vinext
```

O binding `DB` está em `cloudflare.config.ts`. Não versione tokens, senhas ou dados de clientes.
