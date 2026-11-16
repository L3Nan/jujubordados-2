# Matriz de requisitos do Manual Vitrine Lucrativa v2.0

**Fonte analisada:** PDF de 39 páginas, versão 2.0, atualizado em 09/09/2026. O manual foi usado como referência funcional. Marca, textos, imagens e código da Vitrine Lucrativa não são reutilizados no produto.

**Status**

- **Implementado:** há evidência direta no código e no deploy atual.
- **Parcial:** existe um fluxo relacionado, mas faltam partes descritas no manual.
- **Pendente:** não há implementação identificada.
- **Condicional:** exige dados, credenciais, serviço externo ou uma decisão comercial ainda não fornecida.

## Capítulos 1 a 14

| Cap. | Requisito do manual | Status | Evidência e lacuna atual |
| --- | --- | --- | --- |
| 1. Comece por aqui | Checklist para publicar e receber o primeiro pedido | Parcial | Painel mostra progresso para nome/apresentação, WhatsApp, produto publicável, formas de pagamento e opções de recebimento, com atalhos de configuração. Endereço e regras comerciais confirmadas continuam pendentes. |
| 2. Cadastro e acesso | Criar conta, entrar com e-mail/senha e recuperar senha | Pendente | Existe login administrativo com senha compartilhada em segredo Cloudflare, sessão assinada e limite de tentativas. Não existe conta por usuário, recuperação por e-mail nem login Google. Envio de e-mail exigiria domínio/serviço e dados de contato. |
| 3. Tela inicial e painel | Resumo, meta, pendências, atalhos e navegação adaptada a celular | Parcial | Há painel responsivo com módulos, totais, atalhos e metas. Falta onboarding/progresso e notificações com histórico/filtros. |
| 4. Personalizar vitrine | Identidade visual, conteúdo, formas de pagamento/entrega e preferências | Parcial | Nome, apresentação, links sociais, WhatsApp e formas de pagamento informativas podem ser editados no painel e persistidos no D1. Não há editor completo de logo/banner/cores, modelos de tema ou processamento de pagamento online. |
| 5. Categorias e subcategorias | Criar, ordenar, ilustrar e relacionar categorias | Parcial | Categorias e subcategorias são gerenciáveis e podem ser usadas em links/QR. Não há imagem de categoria nem ordenação manual persistente. |
| 6. Cadastro de produtos | Até cinco fotos, variações, tipo de preço, prazo, estoque, mínimo, peso e dimensões | Parcial | Há edição de produtos, fotos, preço/variações, disponibilidade, prazo e estoque. Peso, dimensões e mínimo não estão completos no formulário/checkout; falta tipo de preço do manual e duplicação em lote. |
| 7. Página inicial da loja | Escolher e ordenar produtos em destaque e configurar banner | Parcial | Existe sinalizador de produto em destaque. Não há editor dedicado para ordenar destaques nem gerenciar banner/seções. |
| 8. Pedidos | Pedidos da vitrine, WhatsApp/presenciais manuais, itens avulsos, status, PDF e etiqueta | Parcial | Checkout e pedidos manuais gravam no D1. O formulário manual aceita linhas de catálogo/variações e itens/serviços avulsos; produtos com estoque finito são deduzidos pela mesma trigger transacional do checkout, e falta de estoque bloqueia a gravação. Painel acompanha status/pagamentos e baixa PDF do pedido e etiqueta de endereçamento para entregas. Etiqueta de transportadora com código/rastreio ainda depende de integração externa. |
| 9. Orçamentos | Itens múltiplos, validade, entrega, sinal, PDF, edição e conversão | Implementado | Aceita até 30 itens, permite editar propostas em aberto, seleciona clientes do CRM e produtos/variações ativos do catálogo, compõe resumo para WhatsApp, baixa um PDF independente ou imprime e converte todos os itens/valores em pedido. Propostas anteriores de item único continuam compatíveis. |
| 10. Clientes | CRM, endereço, aniversário, gasto total, busca, histórico e WhatsApp | Parcial | Cadastro básico, aniversário e histórico derivado de pedidos existem. Endereço, totais agregados, busca robusta e política de consentimento no fluxo não estão completos. Dados operacionais são sincronizados ao D1 em um documento JSON. |
| 11. Cobranças e vendas a prazo | Central, parcelas, atrasos, pagamentos parciais e lembretes | Parcial | Pedidos têm vencimento, saldo e recebimentos parciais; painel filtra saldos em aberto, vencidos e que vencem hoje e prepara lembrete WhatsApp para revisão manual (exige número com DDI 55). Não há entidade de parcelas/cobranças independente nem envio/registro do lembrete. |
| 12. Financeiro | Receitas efetivamente recebidas, despesas, categorias e meta mensal | Parcial | Recebimentos de pedidos e despesas/entradas avulsas são persistidos em tabela D1. Novo recebimento grava pagamento e receita em lote transacional com chave idempotente; migração 0009 importa os lançamentos antigos do snapshot. Meta e demais dados operacionais seguem no JSON; relatórios financeiros avançados continuam pendentes. |
| 13. Cupons | Percentual/valor, ativar/pausar e uso único por cliente | Parcial | Cupons percentuais/fixos são validados pelo servidor e podem ser ativados. Não há regra de uso único por cliente, limite de validade ou auditoria de utilizações. |
| 14. Frete tradicional | CEP/cidade/UF, retirada, grátis, prazo e regra mais específica | Parcial | Regras por CEP/cidade/UF/região e retirada são suportadas no checkout. Pedidos manuais podem registrar endereço completo e gerar etiqueta de endereçamento em PDF. Não há prazo de entrega, nome/método exibido completo nem configuração de entrega grátis como modalidade distinta. |

## Capítulos 15 a 27

| Cap. | Requisito do manual | Status | Evidência e lacuna atual |
| --- | --- | --- | --- |
| 15. SuperFrete | Credencial, CEP de origem e cotação em transportadoras | Condicional / pendente | Não há integração. Exige conta/token SuperFrete, CEP de origem, pesos e dimensões confiáveis e validação com a API atual. A etiqueta continuaria sendo comprada na plataforma externa. |
| 16. InfinitePay | Checkout hospedado, confirmação e atualização do pagamento | Condicional / pendente | Não há integração. Exige conta liberada, documentação/API vigente, credenciais e testes de webhook/assinatura. Não armazenar dados de cartão no sistema. |
| 17. Formas de pagamento | Pix, dinheiro, cartão, a combinar, sinal e ajustes | Parcial | Loja pode informar formas aceitas e elas aparecem no checkout como orientação para combinar diretamente. Pedidos e recebimentos podem ser registrados manualmente; não há escolha de forma no checkout, sinal, desconto Pix ou acréscimo no cartão. |
| 18. Vendedora IA | Atendimento configurável com catálogo e políticas da loja | Pendente | Não há chat de IA no site nem configuração de instruções/serviço/modelo. Depende de escolher provedor, orçamento e regras de tratamento de dados. |
| 19. Métricas e relatórios | Visitas, cliques, pedidos, conversão e série diária | Parcial | Contagens agregadas de visitas, WhatsApp e pedidos, com períodos e gráfico, são persistidas no D1. Não mede receita, origem/campanha ou desempenho por produto; métricas começam após implantação. |
| 20. Notificações | Histórico, filtros, pedidos e estoque, push em celular | Parcial | Push para novo pedido está implementado; chaves VAPID estão nos segredos e inscrição é por dispositivo com consentimento. Falta provar entrega em dispositivo real e criar histórico, filtros e alertas de estoque. |
| 21. Estoque | Controle opcional, dedução automática e alerta de baixo/zero | Parcial | Estoque finito é mantido em tabela D1 e deduzido por trigger na mesma transação que grava pedidos da vitrine ou manuais com itens associados; excesso de venda falha e cancelamento/reabertura devolvem/reservam uma vez. Quantidade é sincronizada para catálogo e checkout. Ainda falta alerta ativo de estoque baixo/zerado. |
| 22. QR Code e compartilhamento | QR/link de loja, produto e categoria | Implementado | QR PNG e impressão são gerados no cliente para a loja e itens/categorias publicados. |
| 23. Instalar aplicativo | PWA para iOS, Android e desktop | Parcial | Manifest, ícones, prompt e service worker existem. Instalação depende do navegador/dispositivo; ainda não há funcionamento offline completo. |
| 24. Calendário | Eventos, datas, campanhas e aniversários | Parcial | Eventos manuais, aniversários e sugestões sazonais nacionais existem. Falta integração de lembretes/notificações e cobertura de calendário local. |
| 25. Configurações e suporte | Conta/loja, endereço, integrações, ajuda e exclusão | Parcial | Painel permite baixar backup JSON autenticado de configurações, catálogo, pedidos, recebimentos, financeiro, estoque e métricas. Fotos e inscrições push são excluídas do arquivo; restauração automatizada, redefinição de senha, suporte e fluxo de exclusão ainda pendentes. |
| 26. Tabela de planos | Comparação de planos da plataforma de referência | Fora do escopo atual | O manual descreve planos/licenciamento da Vitrine Lucrativa. A Jujubordados atual é uma loja única, sem assinaturas; SaaS/plano seria decisão futura separada, não copiar a oferta do produto de referência. |
| 27. Solução de problemas | Ajuda para login, pedidos, catálogo e notificações | Pendente | Não há central de ajuda nem página de diagnóstico/autossuporte identificada. |

## Sugestões adicionais para Jujubordados

Estes itens são adaptações ou extensões, não requisitos exclusivos do manual: arquitetura inicial preparada para várias lojas; histórico de campanhas sazonais nacionais; persistência de fotos próprias em D1; QR por produto/categoria; métricas agregadas sem identificação de visitante; e notificações Web Push com payload sem dados pessoais.

## Prioridade recomendada

1. **Confiabilidade operacional:** pedidos manuais associam itens e atualizam estoque na mesma transação; pagamentos e receitas agora são gravados juntos no D1 e evitam repetição por reenvio da mesma tentativa.
2. **Conta e privacidade:** definir o modelo de usuários da loja, contato de recuperação, e-mail/domínio, aviso de privacidade, restauração de backup e fluxo de exclusão de dados.
3. **Finalização da vitrine:** editor de aparência/conteúdo, opções de pagamento, destaque ordenável e prazo de frete.
4. **Documentos comerciais:** orçamento com múltiplos itens, edição e conversão fiel, além de PDF do pedido e etiqueta de endereçamento. Etiqueta oficial/rastreio depende de integração de frete.
5. **Serviços externos opcionais:** validar SuperFrete e InfinitePay com contas/credenciais da proprietária; escolher provedor e custos antes da vendedora IA.
6. **Notificações e suporte:** validar push num dispositivo real, histórico de notificações, alertas de estoque e central de ajuda.

## Dependências que não devem ser inventadas

- WhatsApp oficial, e-mail de recuperação e dados/endereço da loja.
- Produtos, preços, estoque, medidas, pesos, regras e prazos confirmados pela proprietária.
- Contas, chaves e liberação comercial de SuperFrete/InfinitePay.
- Provedor/modelo, política de dados e orçamento da vendedora IA.
- Política de retenção, contato de privacidade e fluxo operacional de solicitações de titulares.

## Evidência no código

A matriz foi comparada com as rotas em `src/app/api`, telas em `src/app/painel`, modelos em `src/data`, service worker em `public/sw.js` e migrações em `migrations`. Status parcial significa que a tela pode existir sem cobrir todo o fluxo documentado; não equivale a aprovação funcional de ponta a ponta.
