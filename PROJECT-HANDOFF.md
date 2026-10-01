# Trilheiros Gestão — Handoff do projeto

Atualizado em 2026-09-11.

## Fonte de verdade
- Repositório: `jonatasmarruda-prog/reservaspasseios`
- Branch: `main`
- Firebase project: `trilheiros-reservas`
- App: `https://trilheiros-reservas.web.app`
- Admin: `https://trilheiros-reservas.web.app/admin`
- Canva reservas: `https://trilheirosderondonopolis.my.canva.site/`
- Logo oficial: `https://trilheiros-reservas.web.app/assets/trilheiros-logo-email.png?v=20260925-hosted1` (arquivo próprio do Firebase Hosting; não voltar a usar host externo nos e-mails).
- Cópias administrativas dos e-mails usam uma revisão separada no identificador de envio, permitindo validar mudanças de template sem reenviar mensagens aos passageiros.

## Regra operacional principal
O site do Canva é a frente de reservas. Ao clicar em PIX/cartão/PIX parcelado, os dados devem ser enviados silenciosamente ao Trilheiros Gestão.

Se o passeio já existir no Gestão, a reserva deve entrar no MESMO passeio. Nunca criar outro passeio para a mesma viagem/data. Criar passeio automaticamente apenas quando realmente não existir.

O guia `Jonatas Marques de Arruda — GUIA DE TURISMO` ocupa a vaga nº 01 e conta fisicamente na lotação.

Clicar em PIX/cartão registra intenção, forma e valor, mas NÃO comprova pagamento. A venda só deve ser considerada paga após confirmação manual do operador ou webhook/API bancária validada.

Quando uma nova pendência de pagamento entra pelo fluxo do Canva, o celular do administrador deve receber push para conferência. Depois da confirmação manual, o sistema pode emitir novo aviso de pagamento confirmado.

## Passeios do portal
- `chapada_guimaraes` — 2026-09-26 — Chapada dos Guimarães
- `salto_nuvens` — 2026-10-10 — Salto das Nuvens
- `nobres_bom_jardim` — 2026-10-24 — Nobres – Bom Jardim
- `rio_cristalino` — 2026-11-08 — Rio Cristalino + Aldeia Dom Bosco
- `jaciara_canyon` — 2026-11-15 — Jaciara – Cânion das Índias

## Estado atual do front-end
As implementações atuais relevantes são:
- `public/admin-reservation-sync-v35.js` — reserva sincronizada e confirmação manual do pagamento vindo do Canva;
- `public/admin-costs-v36.js` — cadastro/edição de passeio e despesas por pessoa/valor total;
- `public/admin-sales-v37.js` — vendas, recebimentos, edição, cancelamento e exclusão segura;
- `public/admin-email-controls.js` — status, fila e reenvio de e-mail em Vendas/Pendências;
- `public/admin-master-v40.js` — visão executiva e operações gerais;
- `public/admin-stable-v42.js` — Financeiro Premium, Pendências e relatórios;
- `public/trip-dedupe-v43.js` — consolidação de passeios duplicados;
- `public/reservation-portal-v27.js` — portal de reservas que reutiliza o passeio existente;
- `public/cadastro.html` — cadastro direto por `/cadastro/<tripId>`;
- `public/pwa.js`, `public/push-client.js` e `public/sw.js` — PWA, registro FCM e notificações no Android;
- `functions/push-notifications.js` — push em segundo plano para cadastro, pendência/pagamento e cancelamento.

Não criar nova camada versionada sem necessidade. Corrigir/consolidar o código existente e preservar o que já funciona.

## Passeios duplicados
A V27 reconhece aliases, exige a data correta, prioriza o cadastro administrativo mais rico e relê `trips` antes de criar novo documento.

A V43 consolida duplicados existentes: migra reservas, vendas e despesas para o passeio canônico, preserva `cost_items`, recalcula vagas e exclui duplicados.

Regra obrigatória: mesma viagem + mesma data = um único passeio.

## Deploy Firebase
`.github/workflows/firebase-deploy.yml` publica somente `hosting` no projeto `trilheiros-reservas` quando há mudanças em `public/**`, `firebase.json` ou no próprio workflow.

O workflow autentica com `FIREBASE_SERVICE_ACCOUNT` e executa:
`firebase deploy --project trilheiros-reservas --only hosting --non-interactive`.

Não incluir Functions ou Firestore Rules nesse deploy sem autorização e sem validar previamente as permissões da conta de serviço.

## Estabilidade do painel e Relatórios — 11/09/2026
- A causa do travamento do seletor `#reportTrip` era `public/admin-fix.js`: um listener global de clique reconstruía a Central de Relatórios com `innerHTML` depois de qualquer toque e podia envolver `window.renderAdmin` novamente a cada clique.
- A Central V7 agora é renderizada diretamente pelo fluxo oficial de `renderReportsV7()`. A escolha de `#reportTrip` fica em `state.reportTripCentral` e não dispara nova renderização.
- O seletor operacional V40 permanece separado em `#v40ReportTrip`, com estado próprio em `state.reportTripV40`.
- Foram removidos observers globais redundantes das camadas V40, V42, vendas, custos e Instagram. Os observers exclusivos do cadastro público não são mais iniciados na rota `/admin`; `admin-trip-operations.js` atual já não usa `MutationObserver`.
- O workaround que substituía globalmente `MutationObserver` e o seletor alternativo touch-safe foram removidos; a estabilidade vem da eliminação da origem da renderização repetida.
- `sales-management-v22.js` tinha erro de sintaxe e voltou a carregar normalmente.
- Build do shell: `20260911-stable-admin1`. HTML não é armazenado e JS/CSS sempre revalidam; o Service Worker usa network-first para arquivos de aplicação.

## Cadastro único de participantes — 01/10/2026
- Canva/portal e link direto passam a usar CPF como identificador principal do participante, com e-mail individual por participante.
- O portal agora coleta nome, CPF e e-mail de cada pessoa da reserva.
- O link `/cadastro/<tripId>` também coleta CPF, nome e e-mail de cada participante.
- Cada novo cadastro grava `registration_email_status: pending`; o motor de e-mail envia confirmação individual para cada e-mail único da lista de participantes.
- Pagamento e cadastro continuam separados: preencher o formulário nunca transforma sozinho uma pendência em pagamento confirmado.
- No mesmo aparelho, os dados do participante ficam reaproveitáveis localmente: ao digitar novamente o CPF em outro passeio, nome/e-mail conhecidos podem ser preenchidos automaticamente.
- Cadastro feito somente pelo link do grupo também cria uma venda pendente no controle financeiro, usando o preço padrão do passeio até conferência/ajuste; não é marcado como pago automaticamente.
- O link direto pergunta também a forma de pagamento usada. As opções são configuradas por passeio (`payment_methods`) e podem ser PIX, PIX parcelado e/ou cartão. Se já existir uma venda vinda do Canva/portal, a forma de pagamento financeira existente é preservada; a resposta do link serve para completar/conferir o cadastro sem duplicar a venda.
- Foi preparada a camada global `functions/participant-unification.js` com `participantProfileApi` e `unifiedRegistrationApi`. Ela faz deduplicação por CPF dentro do mesmo passeio, preserva venda/pagamento existente, não desconta vaga novamente quando encontra o mesmo participante e mantém perfis protegidos no servidor.
- O front-end possui fallback compatível: se essas Functions não estiverem disponíveis, a reserva continua funcionando pelo Firestore atual. No mesmo aparelho, uma venda do portal pode ser reconhecida pelo link direto sem ocupar outra vaga.
- Se o passeio estiver lotado, o link direto continua abrindo para permitir que uma pessoa que já possui vaga complete seu cadastro; somente uma nova vaga é bloqueada.
- Bloqueio atual de infraestrutura: o deploy das duas novas Functions está impedido porque `cloudbuild.googleapis.com` está desativada e a credencial de CI não possui permissão para habilitar APIs. O código passou no `node --check`; quando Cloud Build for habilitada no projeto `trilheiros-reservas`, o workflow `Publicar notificações e e-mail imediato` já está preparado para publicar `participantProfileApi` e `unifiedRegistrationApi`.
- Nunca expor perfil de participante diretamente em uma coleção pública do Firestore. O reaproveitamento global deve continuar passando pela API protegida; CPF sozinho não pode liberar e-mail/telefone de terceiros.

## Cadastro direto por link do passeio
Links no formato `https://trilheiros-reservas.web.app/cadastro/<tripId>` usam `public/cadastro.html`.

O formulário atual:
- carrega exatamente o passeio indicado pelo `tripId`;
- mostra nome do passeio, data, local e vagas com destaque;
- coleta nome completo, e-mail e quantidade de participantes;
- NÃO solicita CPF;
- para 1 pessoa, não repete o nome;
- para 2 ou mais, solicita apenas o nome dos acompanhantes a partir de `Participante 2`;
- exige aceite da política de cancelamento;
- grava em `trips/{tripId}/reservations/{uid}`;
- grava `trip_id`, `trip_name`, `trip_date`, `participants`, `registration_status: completed`, `status: active`, `registration_source: direct_trip_link` e `source: direct_trip_link`;
- atualiza `used_spots` e `remaining_spots` na mesma transação;
- bloqueia novo envio do mesmo aparelho para o mesmo passeio se a reserva já existir.

Quando `assumes_payment=true`, o link continua sendo destinado a quem já pagou antes do cadastro. O cadastro não substitui a conferência financeira do fluxo de Vendas/Pendências quando esta for necessária.

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

Custos por pessoa multiplicam a quantidade de clientes. Custos totais entram uma única vez. Despesas reais ficam sempre vinculadas ao `trip_id` e devem ser exibidas somente dentro do respectivo passeio.

No fechamento final, o custo considerado é o maior entre as despesas reais lançadas e o total de `cost_items` cadastrado no passeio. Assim, lançamentos reais parciais nunca apagam ônibus, transporte, alimentação, atrativos ou outros custos previstos; nunca grave custo zero se houver custos cadastrados. Passeios já fechados podem usar “Recalcular fechamento”, que preserva vendas e custos, atualiza o retrato financeiro e gera uma nova fila de e-mail com o resultado corrigido. Essa regra vale para todos os passeios: `lucro atual = valor recebido - custo total considerado`; o painel mantém também `lucro previsto = valor vendido - custo previsto`, sem misturar pagamentos pendentes com dinheiro já recebido.

Campos monetários de custos e despesas aceitam formato brasileiro (`5.000`, `5.000,00`, `39,98`) e formato técnico com ponto decimal (`39.98`). Não use `type="number"` nesses campos, pois em alguns celulares `5.000` era salvo como `5`.

O e-mail de fechamento financeiro deve ser entregue tanto em `trilheiros.roomt@gmail.com` quanto em `jonatasmarruda@gmail.com`. O envio só processa passeios com `financial_closure_email_status: pending`; fechamentos antigos sem esse campo precisam ser recalculados ou reenfileirados explicitamente, para não enviar retratos financeiros desatualizados. O painel agora exibe o status do relatório no fechamento e oferece **Reenviar relatório por e-mail**; cada reenvio incrementa `financial_closure_email_revision`, gerando uma nova chave idempotente sem duplicar envios normais.

O workflow `Resultado final do passeio` aceita execução manual com `trip_id` e `bus_cost`: quando preenchidos, atualiza apenas o custo fixo de ônibus/transporte daquele passeio, recalcula o fechamento com vendas, recebimentos e demais custos atuais e então envia o novo relatório. Use essa opção somente com valor confirmado pelo administrador.

## Financeiro e Pendências
A V42 usa `sales` + `expenses` e mostra:
- faturado;
- recebido confirmado;
- despesas pagas;
- contas a pagar;
- contas a receber;
- lucro/caixa;
- vagas vendidas;
- formas de pagamento;
- despesas por categoria;
- resultado por passeio;
- relatório mensal detalhado;
- lucro por passeio e lucro mensal usando `recebido - custo total considerado`, onde o custo considerado é `max(custo previsto, despesas lançadas)`. O saldo de caixa continua separado e usa somente despesas efetivamente pagas.

Reservas do Canva devem mostrar automaticamente nome, participantes, passeio, tipo/opção, forma de pagamento, valor total, valor já confirmado, saldo e próxima parcela quando aplicável.

O operador NÃO redigita valores: confere no banco/provedor e confirma.

## Vendas — exclusão segura
- venda sem valor recebido confirmado pode ser excluída;
- ao excluir, remove venda/reserva vinculada e devolve vagas quando aplicável;
- venda com dinheiro confirmado usa cancelamento/reembolso para preservar histórico;
- venda cancelada e sem saldo financeiro pode ser excluída definitivamente;
- reservas sincronizadas podem ter ID diferente da venda; o cancelamento deve localizar a reserva pelo `sale_id` quando necessário.

## E-mails automáticos
Remetente profissional:
- From: `Trilheiros de Rondonópolis <reservas@trilheirosderondonopolis.com.br>`
- Reply-To: `trilheiros.roomt@gmail.com`

Domínio Resend verificado e envio real já validado em produção.

### Boas-vindas / confirmação
Arquivos:
- `automation/send-paid-welcome-emails.mjs`;
- `.github/workflows/paid-welcome-email.yml`;
- `public/admin-email-controls.js`.

Regras:
- venda ativa e totalmente quitada;
- e-mail válido;
- idempotência por `email_dispatches`;
- retry com backoff;
- Resend com `Idempotency-Key`;
- confirmação de cadastro direto permanece separada da confirmação financeira;
- falhas fazem o workflow terminar com erro em vez de sucesso silencioso.

Commit relevante: `b1672e666a4372493cd5dd79e7edcd5a89a5f96b`.

### Pré-trilha e pós-trilha
Motor unificado: `automation/send-reminders.mjs`.

Workflow ativo: `.github/workflows/email-reminders.yml`, executado de hora em hora, com cálculo de negócio em `America/Cuiaba`.

O administrador recebe em `jonatasmarruda@gmail.com` uma única cópia de conferência por passeio e por lembrete pré-trilha (3 dias e 1 dia). A cópia usa registro próprio em `email_dispatches`, portanto as execuções repetidas do workflow não duplicam o envio.

Regras:
- pré-trilha: somente quando o início real do passeio estiver entre 24 e 48 horas;
- pós-trilha: 24 horas após o término real, com janela de recuperação até 72 horas;
- somente venda ativa e totalmente quitada;
- não envia para venda/passeio cancelado;
- respeita `email_reminder_enabled` e `post_trip_enabled`;
- não inventa horário quando o passeio não possui dados suficientes;
- idempotência e retry via `email_dispatches`;
- pós-trilha usa o link fixo de avaliação Google dos Trilheiros;
- fotos, quando houver, usam link separado do link de avaliação.

O workflow legado `trip-reminder-email.yml` ficou manual-only e chama o mesmo motor, evitando dois agendamentos concorrentes.

Commits relevantes:
- `fee745d35acab514c31f298821ffc04f3a6d0742` — motor de pré/pós-trilha;
- `54b459dd895d6c725667e3db66cbb5a2cce690d8` — workflow principal;
- `587e9bd21387b0353c53ff684194dade455a3e35` — workflow legado manual-only.

## Notificações Android / FCM
Objetivo: o administrador receber alertas mesmo com o site/PWA fechado.

Arquivos:
- `public/push-client.js` — obtém token FCM e registra o dispositivo autenticado;
- `public/sw.js` — recebe push em segundo plano e abre a tela correta ao tocar;
- `public/pwa.js` — controles, teste e integração visual;
- `functions/push-notifications.js` — envia push pelo Firebase Admin Messaging;
- `functions/entry.js` — exporta as Functions de push;
- `.github/workflows/firebase-deploy.yml` — publica somente o Firebase Hosting; as Functions têm fluxos separados e não devem ser reativadas sem autorização.

O administrador precisa abrir o sistema ao menos uma vez, estar autenticado e conceder permissão de notificações para registrar o token do celular em `push_devices`.

Eventos de push:
- novo cadastro;
- nova pendência de pagamento vinda do fluxo do Canva, para conferência;
- pagamento confirmado depois da confirmação manual;
- pedido de cancelamento.

A pendência não deve ser tratada como pagamento confirmado. A mensagem deve orientar o administrador a conferir banco/Mercado Pago e então confirmar no Gestão.

O badge problemático do Android foi removido do payload; permanece apenas o ícone principal da notificação.

Commits recentes:
- `c6ac9bde6afe4e70ddb02825fa0ce1b48a6dd7bd` — remover badge quebrado do push;
- `695d4f810f69d21c2f97f436ae3e38ff5c817049` — alertar quando a pendência de pagamento entra no sistema.

## Política de cancelamento automática
Todo Novo Passeio ou Editar Passeio abre com política padrão quando o campo estiver vazio. Política personalizada deve ser preservada.

## Assistente oficial do Instagram
Base implementada em 11/09/2026, ainda dependente da criação/configuração do aplicativo Meta e dos quatro segredos do Firebase antes do primeiro deploy das novas Functions.

Arquivos:
- `functions/instagram-assistant-core.js` — identificação de intenção/passeio e respostas humanizadas sem custo por mensagem;
- `functions/instagram-assistant.js` — webhook Meta, assinatura, idempotência, Graph API, histórico, limite e encaminhamento humano;
- `public/admin-instagram.js` e `.css` — painel, simulador, modo sugestão/automático e “Jonatas assume”;
- `INSTAGRAM-SETUP.md` — ativação Meta/Firebase;
- `.github/workflows/instagram-assistant-deploy.yml` — deploy manual após os segredos existirem.

Regras obrigatórias:
- usar somente a API oficial da Meta;
- nunca usar senha do Instagram ou robô de navegador;
- nunca confirmar pagamento informado sem conferência bancária;
- cancelamento, reembolso, reclamação, emergência e informação ausente vão para Jonatas;
- começar em modo `suggestions` e liberar automático somente após os testes;
- comentário → Direct fica desligado por padrão;
- o bot lê os dados atuais de `trips`; completar `difficulty`, `minimum_age`, `included_items`, `departure_time` e preços específicos no passeio quando quiser respostas mais completas.

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
`.github/workflows/monthly-finance-report.yml` roda diariamente; `automation/send-monthly-finance-report-v2.mjs` só envia no último dia local do mês, salvo execução manual forçada. Destino: `trilheiros.roomt@gmail.com`.

## Diretriz para próximos chats
Antes de alterar qualquer coisa:
1. ler este arquivo;
2. inspecionar o código atual no GitHub;
3. preservar tudo que já funciona;
4. não criar nova camada/versionamento sem necessidade;
5. manter um único passeio por viagem/data;
6. diferenciar sempre “pagamento informado/pendente” de “pagamento confirmado”.
