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

## Regras de identificação de passeio do portal
- `chapada_guimaraes` — 2026-09-26 — Chapada dos Guimarães
- `salto_nuvens` — 2026-10-10 — Salto das Nuvens
- `nobres_bom_jardim` — 2026-10-24 — Nobres – Bom Jardim
- `rio_cristalino` — 2026-11-08 — Rio Cristalino + Aldeia Dom Bosco
- `jaciara_canyon` — 2026-11-15 — Jaciara – Cânion das Índias

## Estado atual do código
O `public/index.html` carrega as camadas V28, V29, V30, V31, V32, V33, V34, V35, V36, V37, V40, V41, V42 e V43.

Arquivos mais recentes importantes:
- `public/admin-master-v40.js` — visão executiva, DRE simplificada, segurança, lista de espera, fechamento e relatórios.
- `public/admin-finance-v41.js` — financeiro refinado.
- `public/admin-stable-v42.js` — amarrações estáveis de Novo Passeio, Financeiro e Pendências.
- `public/trip-dedupe-v43.js` — consolidação de passeios duplicados.

## Último problema reportado
Na tela Passeios apareceram dois registros da Chapada na mesma data:
- `Chapada` — 26/09/2026 — 1/45 — despesas R$ 5.040,00
- `Chapada dos Guimarães` — 26/09/2026 — 2/40 — despesas R$ 0,00

Isso é incorreto. Todas as reservas da Chapada de 26/09/2026 devem ficar em UM ÚNICO passeio.

## Correção V43
`public/trip-dedupe-v43.js` foi criado para:
1. detectar duplicados dos cinco passeios do portal por template + data;
2. consolidar reservas, vendas e despesas no ID canônico do passeio;
3. preservar os dados administrativos mais ricos, inclusive `cost_items`;
4. recalcular `used_spots` e `remaining_spots` com guia + reservas ativas;
5. excluir o documento duplicado depois da migração;
6. bloquear novo cadastro manual de passeio com mesmo nome/data.

O `public/index.html` já referencia `/trip-dedupe-v43.js?v=43`.

## IMPORTANTE — NÃO ESTÁ CONFIRMADO EM PRODUÇÃO
O push que carregou V43 disparou o workflow `Publicar Trilheiros no Firebase Spark`, mas o run terminou com `failure` justamente no passo `Publicar Firestore e Hosting`.

Portanto, NÃO assumir que V43 está publicada no Firebase.

Próxima ação recomendada no Cloud Shell:
```bash
cd ~/reservaspasseios
git pull origin main
firebase deploy --project trilheiros-reservas --only hosting
```

Depois:
1. abrir `https://trilheiros-reservas.web.app/admin`;
2. fazer `Ctrl + F5`;
3. aguardar cerca de 2 segundos;
4. verificar se os dois passeios da Chapada foram consolidados em um único registro;
5. conferir se reservas, vendas e despesas permaneceram vinculadas.

Se a consolidação falhar, abrir F12 > Console e procurar `V43_DEDUPE_ERROR`.

## Novo Passeio / Despesas
A tela `+ Novo passeio` usa `tripModalV36()` via V42.

Cada despesa deve ter:
- categoria/descrição;
- tipo `VALOR TOTAL` ou `POR PESSOA`;
- valor.

Exemplos padrão:
- Ônibus / Transporte — total
- Hospedagem — por pessoa
- Alimentação — por pessoa
- Camping — por pessoa
- Entrada / Day Use / Atrativo — por pessoa
- Seguro — por pessoa
- Guia / Condutor — total
- Pedágio / Taxas — total

Custos por pessoa devem ser multiplicados pela quantidade de clientes. Custos totais entram apenas uma vez.

## Financeiro
Objetivo operacional:
- faturado no mês;
- dinheiro realmente recebido;
- despesas pagas;
- contas a pagar;
- contas a receber;
- lucro/resultado;
- PIX, cartão, PIX parcelado, dinheiro e outros;
- resultado por passeio;
- custo por pessoa e custo fixo;
- ponto de equilíbrio;
- relatório mensal profissional com gráficos.

## Pendências
Reservas do Canva devem mostrar automaticamente:
- nome;
- passeio;
- tipo/opção (individual, casal, criança, hospedagem etc.);
- forma de pagamento;
- valor da reserva;
- próxima parcela quando PIX parcelado.

O operador deve apenas conferir e confirmar o pagamento. Não deve redigitar valores.

## Relatórios de participantes
Para PDFs enviados a ônibus/atrativos/hospedagem:
- mostrar somente Nº, Nome do participante, Tipo/Opção;
- não mostrar CPF;
- não mostrar “Responsável”;
- guia permanece nº 01 como `GUIA DE TURISMO`.

## E-mail mensal
Destino do relatório mensal: `trilheiros.roomt@gmail.com`.
Há automações no repositório para relatório financeiro mensal, lembretes e PIX parcelado, dependentes dos secrets do GitHub (Firebase Admin / Resend).

## Pagamentos
Importante: clicar em PIX/cartão no Canva registra a intenção/reserva, mas NÃO prova pagamento bancário concluído. Sem webhook/API validado do provedor, o Gestão deve manter status pendente até confirmação manual.

## Diretriz para próximos chats
Antes de alterar qualquer coisa, ler este arquivo e inspecionar o código atual no GitHub. Não criar nova camada sem necessidade. Priorizar corrigir/consolidar o que já existe e evitar duplicação de versões e de passeios.
