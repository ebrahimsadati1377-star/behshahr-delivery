# WooCommerce Connector

This integration sends WooCommerce orders into Behshahr Delivery without exposing the Delivery API port publicly.

## Scope

The connector supports order import and manual courier assignment from WooCommerce admin:

1. WooCommerce reaches a configured order status (default `processing`).
2. The WordPress connector sends the order to Delivery.
3. Delivery validates the service area, calculates route/pricing, and creates a `REQUESTED` delivery order.
4. The dispatcher assigns a courier as usual.
5. The connector stores the Delivery order ID/public code in WooCommerce order meta.
6. WooCommerce `completed` / `approved` does not confirm courier delivery.
7. Delivery marks the order `DELIVERED` only after courier confirmation. Legacy status-sync calls are ignored until courier delivery.

Delivery-to-WooCommerce callbacks remain intentionally deferred. WooCommerce order completion and courier delivery completion are separate workflows.

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

### Create/import order

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

### Sync completed status

`POST /api/integrations/woocommerce/orders/status`

Uses the same `X-Delivery-Key` header.

```json
{
  "storeId": "dekan",
  "externalOrderId": "38124",
  "status": "completed"
}
```

The update is idempotent. Calling it again for an already `DELIVERED` order returns the same linked order without creating a duplicate or repeating the transition. A cancelled Delivery order is not resurrected as delivered.

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

The connector also checks several common latitude/longitude meta names automatically. Version `0.3.1` no longer automatically queues WooCommerce completion callbacks; previously queued callbacks are discarded by the plugin.

## Coordinate requirement

WooCommerce core does not store geographic coordinates for shipping addresses. The checkout/site must already save destination latitude/longitude in order meta. If coordinates are missing, the connector leaves an order note and does not create a Delivery mission.

## Payment mapping

For the initial connector, a WooCommerce order that is already paid is imported as `ONLINE / PAID` for the Delivery quote amount. An unpaid WooCommerce order is imported as `CASH / PENDING`. The original WooCommerce payment details and totals remain in the external source payload for audit/debugging.

## Deployment on Dekan

Set the key in `ops/dekan.env`:

```text
WOOCOMMERCE_INTEGRATION_KEY=<strong random value>
```

Then recreate the API after deploying the code:

```bash
ENV_FILE=ops/dekan.env bash ops/dekan-deploy.sh
```

Do not copy `ops/dekan.env.example` over an existing production env file.

## Assign a WooCommerce order to a courier

WooCommerce order edit screens (classic and HPOS) contain a **«تخصیص راننده ارسال»** box (WordPress connector version 0.3.0).

1. Open **WooCommerce → Orders**, then edit the WooCommerce order.
2. The box queries the Delivery API for current couriers and linked-order state. Select an **AVAILABLE** courier with the order's vehicle type.
3. Click **«ارسال سفارش به راننده»**. If the order has not been imported, the plugin first imports it through the existing idempotent WooCommerce connector. Then it assigns the linked Delivery order.
4. The order becomes **ASSIGNED** and appears in that courier's current job in the Courier PWA. Reassigning is supported before pickup; once picked up or delivered, assignment is rejected.

The plugin shows the assigned courier name in a WooCommerce orders-list column and adds an audit note to the order. The assignment action is authenticated with a WooCommerce manager session and order-specific WordPress nonce (server-side AJAX); API requests use the private **X-Delivery-Key** via loopback. Key values never enter browser JavaScript.

### Endpoints (private integration key required)

- `GET /api/integrations/woocommerce/couriers`: active courier profiles with current availability (phone, name, vehicle type and status).
- `GET /api/integrations/woocommerce/orders/assignment?storeId=...&externalOrderId=...`: current Woo order linking and assigned courier, scoped to the configured store.
- `POST /api/integrations/woocommerce/orders/assign`: `{storeId,externalOrderId,courierId}`. For a linked REQUESTED order assigns to an available courier; for ASSIGNED order reassigns before pickup. Duplicate same-courier assignment is idempotent. Concurrency-safe; mismatch, unavailable couriers, and non-dispatchable order states are rejected.

**Important:** If the original WooCommerce order lacks shipping coordinates, importing the order will fail; this will appear in its WooCommerce order notes. The system does not guess an address or bypass service-area validation. GPS in the driver app works while the PWA is open. No driver wallet or salary calculation is provided by this feature.

### WordPress deployment

Copy the entire updated `integrations/wordpress/behshahr-delivery-connector` directory into the installed WordPress plugin directory, preserving the existing plugin settings. The new `includes/` PHP file and `assets/` JS file are required. The Delivery API code must be deployed **before** the updated WordPress plugin, or the new assignment controls will fail with a 404. No new database migration is required for this change.
