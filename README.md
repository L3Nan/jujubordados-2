# Jujubordados 2.0

Vitrine responsiva da Jujubordados com catálogo, carrinho, pedidos e painel administrativo protegido. As fotos e informações iniciais vieram do catálogo público original; prazos e disponibilidade devem ser confirmados com a loja.

## Stack

- Next.js App Router, React e TypeScript.
- vinext/Vite em Cloudflare Workers.
- Cloudflare D1 para catálogo, pedidos, pagamentos, clientes, financeiro, orçamentos, cupons e regras de entrega.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Crie `.env.local` a partir de `.env.example` para informar o WhatsApp oficial com DDI e DDD. Sem esse número, o checkout grava o pedido e mostra a confirmação. Com ele, também abre a conversa da loja.

## Banco D1

As migrações aditivas ficam em `migrations/`. Para aplicar migrações pendentes:

```bash
npx cf d1 migrations apply d811afc3-f795-4545-a58f-7ad5682a4a17 --dir migrations
```

O endpoint público de pedidos valida catálogo, preços, quantidades, descontos e frete no servidor. Cupons e tarifas usados pelo checkout vêm das configurações ativas no banco.

## Painel

Acesse `/painel` e use a senha administrativa. A sessão usa cookie HttpOnly, Secure e SameSite Strict, com validade de 12 horas. Pedidos, catálogo, categorias e áreas de gestão persistem no D1; a tela do painel sincroniza alterações e consulta atualizações recentes.

A senha fica no segredo `ADMIN_PASSWORD` do Worker, não no repositório. Para trocá-la:

```bash
npx cf workers secrets update ADMIN_PASSWORD --worker jujubordados-2 --type secret_text --text <nova-senha>
```

## Publicação

O Worker usa Cloudflare sem cache extra, Cloudflare Images ou prerender:

```bash
npm run deploy:vinext
```

O binding `DB` está em `cloudflare.config.ts`. Nunca versione tokens, senhas ou dados de clientes.
Fotos enviadas pelo painel são convertidas para WebP e armazenadas separadamente no D1; a vitrine as entrega por URLs públicas imutáveis, sem serviço de imagens externo.

A vitrine também pode ser instalada como PWA em dispositivos compatíveis; o painel informa como adicionar à tela inicial no iOS e Android.

O painel gera QR Codes localmente para a vitrine, produtos publicados e categorias, com download PNG e impressão.

Métricas da vitrine são contagens agregadas por dia em America/Sao_Paulo: cada abertura, cada pedido salvo e cada tentativa de saída ao WhatsApp. Não são armazenados IP, identificadores de visitante ou cookies analíticos. O painel protegido exibe períodos de 7 e 30 dias.

O painel tem calendário de campanhas e eventos e permite registrar aniversários de clientes (com autorização). Os registros ficam junto aos dados operacionais protegidos no D1.
