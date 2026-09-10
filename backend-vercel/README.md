# Trilheiros — backend Mercado Pago (V40)

Backend separado para confirmação automática por Mercado Pago sem expor credenciais no navegador.

## Variáveis de ambiente
- `FIREBASE_SERVICE_ACCOUNT`: JSON da conta de serviço Firebase.
- `MERCADO_PAGO_ACCESS_TOKEN`: token de produção do Mercado Pago.
- `MP_WEBHOOK_URL`: URL HTTPS pública de `/api/webhook`.
- `PUBLIC_RETURN_URL`: URL pública do site de reservas.

Nunca coloque esses valores no JavaScript público nem envie as chaves em conversa.

## Fluxo
1. O site cria a venda no Firestore.
2. O cliente solicita `/api/checkout` autenticado com o ID token Firebase; o backend cria uma preferência única com `external_reference = saleId`.
3. Mercado Pago envia o evento de pagamento para `/api/webhook`.
4. O webhook consulta o pagamento diretamente na API do Mercado Pago e só então atualiza a venda/reserva como `paid`/`partial`.
5. `payment_events` impede processar o mesmo pagamento duas vezes.

Observação: PIX feito pela cópia de uma chave bancária fora do checkout Mercado Pago não possui vínculo técnico suficiente para confirmação automática. Para automação total, o PIX também deve passar por um checkout/pagamento identificável pelo provedor.
