# WooCommerce Connector

This integration sends WooCommerce orders into Behshahr Delivery without exposing the Delivery API port publicly.

## Scope

Phase 1 is inbound only:

1. WooCommerce reaches a configured order status (default `processing`).
2. The WordPress connector sends the order to Delivery.
3. Delivery validates the service area, calculates route/pricing, and creates a `REQUESTED` delivery order.
4. The dispatcher assigns a courier as usual.
5. The connector stores the Delivery order ID/public code in WooCommerce order meta.

Delivery-to-WooCommerce status callbacks are intentionally deferred to a later phase.

## Security

The endpoint is disabled when `WOOCOMMERCE_INTEGRATION_KEY` is empty. Generate a strong key on the Delivery host:

```bash
openssl rand -hex 32
```

Place it only in the server environment and in the WordPress plugin settings. Never commit the real value.

For the Dekan co-hosted deployment, WordPress should call the loopback endpoint:

```text
http://127.0.0.1:4000/api/integrations/woocommerce/orders
```

Do not expose port `4000` publicly.

## API

`POST /api/integrations/woocommerce/orders`

Header:

```text
X-Delivery-Key: <shared integration key>
Content-Type: application/json
```

Example body:

```json
{
  "storeId": "dekan",
  "externalOrderId": "38124",
  "customer": {
    "name": "مشتری نمونه",
    "phone": "09110000000"
  },
  "pickup": {
    "title": "فروشگاه دکن",
    "formattedAddress": "بهشهر، ...",
    "latitude": 36.698,
    "longitude": 53.552
  },
  "dropoff": {
    "title": "مشتری نمونه",
    "formattedAddress": "بهشهر، ...",
    "latitude": 36.705,
    "longitude": 53.56,
    "details": "تلفن و جزئیات آدرس"
  },
  "vehicleType": "MOTORBIKE",
  "notes": "یادداشت مشتری",
  "payment": {
    "paid": true,
    "methodId": "online",
    "methodTitle": "پرداخت آنلاین"
  },
  "metadata": {
    "orderNumber": "38124"
  }
}
```

The combination `provider + storeId + externalOrderId` is unique. Re-sending the same WooCommerce order returns the existing Delivery order instead of creating a duplicate.

## WordPress plugin

Plugin path in this repository:

```text
integrations/wordpress/behshahr-delivery-connector/
```

Install that directory under `wp-content/plugins/` and activate **Behshahr Delivery Connector**.

Configure it under:

```text
WooCommerce -> Delivery Connector
```

Required settings:

- API URL
- Integration Key
- Store ID
- trigger order status
- vehicle type
- pickup address and coordinates
- WooCommerce order meta keys containing customer latitude/longitude

The connector also checks several common latitude/longitude meta names automatically.

## Coordinate requirement

WooCommerce core does not store geographic coordinates for shipping addresses. The checkout/site must already save destination latitude/longitude in order meta. If coordinates are missing, the connector leaves an order note and does not create a Delivery mission.

## Payment mapping

For the initial connector, a WooCommerce order that is already paid is imported as `ONLINE / PAID` for the Delivery quote amount. An unpaid WooCommerce order is imported as `CASH / PENDING`. The original WooCommerce payment details and totals remain in the external source payload for audit/debugging.

## Deployment on Dekan

Set the key in `ops/dekan.env`:

```text
WOOCOMMERCE_INTEGRATION_KEY=<strong random value>
```

Then recreate the API after deploying the migration/code:

```bash
ENV_FILE=ops/dekan.env bash ops/dekan-deploy.sh
```

Do not copy `ops/dekan.env.example` over an existing production env file.
