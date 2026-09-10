# Trilheiros Gestão — Handoff do projeto

Atualizado em 2026-09-10.

## Fonte de verdade
- Repositório: `jonatasmarruda-prog/reservaspasseios`
- Branch: `main`
- Firebase project: `trilheiros-reservas`
- App: `https://trilheiros-reservas.web.app`
- Admin: `https://trilheiros-reservas.web.app/admin`
- Canva reservas: `https://trilheirosderondonopolis.my.canva.site/`

## Regra operacional principal
O site do Canva é a frente de reservas. Ao clicar em PIX/cartão/PIX parcelado, os dados devem ser enviados silenciosamente ao Trilheiros Gestão.

Se o passeio já existir no Gestão, a reserva deve entrar no MESMO passeio. Nunca criar outro passeio para a mesma viagem/data. Criar passeio automaticamente apenas quando realmente não existir.

O guia `Jonatas Marques de Arruda — GUIA DE TURISMO` ocupa a vaga nº 01 e conta fisicamente na lotação.

Importante: clicar em PIX/cartão registra intenção, forma e valor, mas NÃO comprova pagamento. A venda só deve ser considerada paga após confirmação manual do operador ou webhook/API bancária validada.

## Passeios do portal
- `chapada_guimaraes` — 2026-09-26 — Chapada dos Guimarães
- `salto_nuvens` — 2026-10-10 — Salto das Nuvens
- `nobres_bom_jardim` — 2026-10-24 — Nobres – Bom Jardim
- `rio_cristalino` — 2026-11-08 — Rio Cristalino + Aldeia Dom Bosco
- `jaciara_canyon` — 2026-11-15 — Jaciara – Cânion das Índias

## Estado atual do front-end
Para reduzir travamentos, `public/index.html` NÃO carrega mais as camadas financeiras antigas V28–V34 nem V41. As implementações atuais relevantes são:
- `public/admin-reservation-sync-v35.js` — reserva sincronizada e confirmação de pagamento do Canva;
- `public/admin-costs-v36.js` — cadastro/edição de passeio e despesas por pessoa/valor total;
- `public/admin-sales-v37.js` — vendas, recebimentos, edição, cancelamento e exclusão segura;
- `public/admin-email-controls.js` — status e reenvio de e-mail na tela de Vendas;
- `public/admin-master-v40.js` — visão executiva e operações gerais;
- `public/admin-stable-v42.js` — Financeiro Premium, Pendências e relatórios;
- `public/trip-dedupe-v43.js` — consolidação de passeios duplicados;
- `public/reservation-portal-v27.js` — portal de reservas corrigido para reutilizar passeio existente.

O Admin limita callbacks de `MutationObserver` legados a no máximo uma execução a cada ~60 ms. O PWA foi ajustado para cache menor e atualização de JS/CSS mais confiável. A logo oficial transparente é exibida maior e sem caixa/fundo visual.

## Passeios duplicados
A V27 foi corrigida para reconhecer aliases como `Chapada`, exigir a data correta, priorizar o cadastro administrativo mais rico e reler `trips` antes de criar um novo documento.

A V43 permanece responsável por consolidar duplicados já existentes: migra reservas, vendas e despesas para o passeio canônico, preserva `cost_items`, recalcula vagas e exclui duplicados.

Commits principais:
- `be8a88420908d9e5011b0df46f892f2a069be863` — impedir duplicação no portal V27;
- `f09e6784c2ec18d4a80a79f880b661187b927bff` — cache do portal;
- `e22d8e42e7eab3284a3231b3263e8e53a830ab61` — deploy Hosting sem bloquear no Firestore.

## Deploy Firebase
`.github/workflows/firebase-deploy.yml` publica apenas Firebase Hosting. O workflow antigo que incluía Firestore falhava com HTTP 403 no Service Usage.

Não alterar/deployar regras do Firestore automaticamente por esse workflow até que a conta de serviço tenha a permissão necessária. Alterações em regras devem ser tratadas separadamente.

Para mudanças apenas em `public/**`, o push em `main` publica automaticamente o Hosting; normalmente não é necessário usar Cloud Shell.

## Novo Passeio / Despesas
A tela `+ Novo passeio` usa `tripModalV36()`.

Cada custo previsto deve ter:
- categoria/descrição;
- tipo `VALOR TOTAL` (`fixed`) ou `POR PESSOA` (`per_person`);
- valor.

Padrões:
- Ônibus / Transporte — total;
- Hospedagem — por pessoa;
- Alimentação — por pessoa;
- Camping — por pessoa;
- Entrada / Day Use / Atrativo — por pessoa;
- Seguro — por pessoa;
- Guia / Condutor — total;
- Pedágio / Taxas — total.

Custos por pessoa multiplicam a quantidade de clientes. Custos totais entram uma única vez. Despesas reais ficam vinculadas ao `trip_id` e devem ser exibidas somente dentro do respectivo passeio.

## Política de cancelamento automática
Desde 2026-09-10, todo Novo Passeio ou Editar Passeio abre com política padrão quando o campo estiver vazio. Se o passeio tiver uma política personalizada, ela é preservada.

Política padrão:
- direito de arrependimento respeitado quando legalmente aplicável;
- 7 dias ou mais: 90% de reembolso ou 100% de crédito;
- entre 6 e 3 dias: 50% de reembolso ou 70% de crédito;
- menos de 72 horas: reembolso pode não ser possível por custos já comprometidos;
- transferência da vaga pode ser aceita mediante comunicação prévia;
- no-show no horário/local informado;
- cancelamento pela organização por segurança, clima, força maior ou motivo operacional gera opções ao participante;
- custos de terceiros não reembolsáveis podem ser descontados quando aplicável.

Commit principal: `6d1f68d12f22952ed0d72b1e5c5ee452b28d9e82`.

## Financeiro
A V42 usa `sales` + `expenses` e mostra:
- faturado;
- recebido confirmado;
- despesas pagas;
- contas a pagar;
- contas a receber;
- lucro/caixa;
- vagas vendidas;
- gráfico de formas de pagamento;
- gráfico de despesas por categoria;
- resultado por passeio;
- relatório mensal detalhado.

A lista de passeios fica abaixo do dashboard. Cada passeio abre somente suas próprias despesas.

Commits principais:
- `0b5e8be969c516d472280749ff73a3efe746053b` — Financeiro Premium/Pendências/relatórios na V42;
- `28af7663ba5d87adddded43ccc78319a5aeff76b` — relatório mensal alinhado a dados reais;
- `26df5dccc0f47a486dbd24e5c76398fe039a3ff3` — publicação da consolidação.

## Pendências
Reservas do Canva devem mostrar automaticamente nome, participantes, passeio, tipo/opção, forma de pagamento, valor total, valor já confirmado, saldo e próxima parcela quando aplicável. O operador não redigita valores: confere no banco/provedor e confirma.

## Vendas — exclusão segura
- venda sem valor recebido confirmado mostra `Excluir`;
- ao excluir, remove venda/reserva vinculada e devolve vagas quando aplicável;
- venda com dinheiro confirmado usa `Cancelar`/reembolso para preservar histórico financeiro;
- venda cancelada sem saldo financeiro pode ser excluída definitivamente.

Correção de 2026-09-10: o cancelamento antigo da V22 supunha que o documento da reserva tivesse sempre o mesmo ID da venda. Reservas sincronizadas podem usar ID diferente, fazendo o botão `Cancelar` falhar com `Dados não encontrados`. `public/sales-management-v22-fix.js` agora localiza a reserva pelo `sale_id`, aceita a ausência de um documento de reserva sem bloquear a venda, cancela a venda, atualiza a reserva quando existir, devolve as vagas ao passeio, corrige limite de hospedagem e respeita a vaga nº 01 do guia. A ação continua restrita a owner/admin. Se o reembolso/estorno zerar o recebido líquido, a V37 passa a oferecer `Excluir` definitivamente.

Commits:
- `ff909c255dcb2ffb095042897fca0d0e262d9bc1` — exclusão segura;
- `55b7b36a5500867738f4f857c0416f8e7e4a989f` — publicação/cache;
- `1c43f52524a184a46100d4552378d12de2bddfe6` — cancelamento robusto para vendas pagas/sincronizadas.

## E-mail automático de boas-vindas após quitação
Arquivos:
- `automation/send-paid-welcome-emails.mjs`;
- `.github/workflows/paid-welcome-email.yml`;
- `public/admin-email-controls.js`.

Regra:
1. cliente precisa ter e-mail válido;
2. venda não pode estar cancelada;
3. pagamento precisa estar totalmente quitado;
4. reserva do Canva é liberada quando o Admin confirma o saldo final;
5. venda manual criada como “já paga” é liberada automaticamente depois que o cliente conclui o cadastro e informa o e-mail;
6. o mesmo envio não é duplicado: `welcome_email_sent_at/status` controlam idempotência;
7. a tela `Vendas pagas` mostra a coluna `E-mail` com estados `Sem e-mail`, `Após quitação`, `Aguardando envio`, `Enviado` ou `Erro no envio`;
8. owner/admin/finance pode usar `Enviar agora`, `Reenviar` ou `Tentar novamente` quando aplicável; o navegador apenas coloca o envio na fila, sem expor chave do Resend.

O e-mail é Premium e inclui logo, nome do cliente, passeio, destino, data, participantes, protocolo, pagamento confirmado e botão para falar com Jonatas no WhatsApp `(66) 99692-6174`.

Workflow roda a cada 5 minutos e usa secrets `FIREBASE_SERVICE_ACCOUNT`, `RESEND_API_KEY` e `EMAIL_FROM`. Uma execução de validação em 2026-09-10 terminou com sucesso e não enviou nada indevido quando não havia elegíveis.

Commits principais:
- `7dadfb12c4e832122b8dea514678bd8cad05f609` — script inicial de boas-vindas;
- `2cc95a37349b42b0b180c924c33f7e9f8a50cbe6` — workflow inicial;
- `45d7670f58ca8ad2eb464ca988ce63ba43a229a1` — validação da automação;
- `8f87581ea5d8ccdca2014f7db032c4e79b56f878` — coluna/status/reenvio em Vendas;
- `c8be2c46fc357af13da4f18b4f9fe054747045aa` — reforço de segurança do reenvio;
- `3783495a3e4e380c58364f9c408bf76c99802899` — incluir vendas manuais quitadas após cadastro.

## Lembrete automático um dia antes do passeio
Arquivos:
- `automation/send-trip-reminders.mjs`;
- `.github/workflows/trip-reminder-email.yml`.

O workflow roda diariamente às 12:00 UTC (aproximadamente 08:00 em `America/Cuiaba`) e procura somente passeios cuja `trip_date` é o dia seguinte.

Só envia para venda ativa, totalmente quitada e com e-mail válido. Respeita `trip.email_reminder_enabled`; por padrão novos passeios têm lembrete habilitado. Não duplica o mesmo lembrete para a mesma venda/data.

O e-mail inclui:
- logo;
- aviso `SEU PASSEIO É AMANHÃ`;
- nome/destino/data;
- horário de saída, quando cadastrado;
- ponto de saída, quando cadastrado;
- retorno, quando cadastrado;
- participantes;
- `O que levar / orientações` do cadastro do passeio;
- botão para falar com Jonatas;
- link do grupo do passeio, quando cadastrado.

A primeira validação do workflow em 2026-09-10 terminou com sucesso e informou que não havia reserva quitada para 2026-09-11, portanto nenhum e-mail de teste foi enviado a cliente.

Commits:
- `0f9e70457d02aeb90343cb065fb32458aa961e06` — script do lembrete;
- `8fd1e7bd6ec12fa09f80dd572771b8731d0bcb31` — workflow diário.

## Relatórios de participantes
Para PDFs enviados a ônibus/atrativos/hospedagem:
- mostrar Nº;
- nome do participante;
- tipo/opção escolhida;
- não mostrar CPF;
- não mostrar “Responsável”;
- guia permanece nº 01 como `GUIA DE TURISMO`.

Transporte acrescenta veículo/assento; hospedagem acrescenta quarto. Seguro pode conter CPF quando necessário para a seguradora.

## Relatório financeiro mensal
A V42 usa a mesma base do dashboard (`sales` + `expenses`) para faturado, recebido, despesas, contas a pagar, lucro/caixa, a receber, vagas, gráficos e resultado por passeio.

`.github/workflows/monthly-finance-report.yml` roda diariamente; `automation/send-monthly-finance-report-v2.mjs` só envia no último dia local do mês (30/31 ou 28/29 em fevereiro), salvo execução manual forçada. Destino: `trilheiros.roomt@gmail.com`.

## Diretriz para próximos chats
Antes de alterar qualquer coisa, ler este arquivo e inspecionar o código atual no GitHub. Não criar nova camada versionada sem necessidade. Priorizar corrigir/consolidar o que já existe e evitar duplicação de versões e de passeios.
