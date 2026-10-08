# Courier management (Admin)

The dispatch Admin Web includes a "رانندگان" page at `/couriers`.

- `GET /api/admin/couriers`: list couriers, today's (Asia/Tehran) and lifetime delivered-trip counts, gross fares, latest GPS point.
- `POST /api/admin/couriers`: create a **new** COURIER account and profile, accepting a full name, mobile number and vehicle type.
- `PATCH /api/admin/couriers/:id`: edit full name, phone, or vehicle.
- `POST /api/admin/couriers/:id/suspend`: suspend account when no active mission exists.
- `POST /api/admin/couriers/:id/activate`: reactivate as **OFFLINE**; courier must manually start a shift.

All endpoints require authenticated ADMIN role. Duplicate phones are rejected, including existing CUSTOMER/ADMIN accounts; an existing account is never implicitly reclassified. Vehicle changes and suspension are blocked while there is an active assignment. Requests use validated DTOs. API writes are audit-logged by administrator ID (without including phone numbers).

**Database migration:** `20261008103000_courier_full_name` adds nullable `couriers.full_name` to preserve existing courier records. Apply with the normal Prisma migration deployment before using new API code. Old couriers will initially have no name; edit them from the admin UI.

**Reporting:** Fares are gross delivered-order final prices in Toman, **not** driver payouts or net earnings. The map shows the latest reported GPS coordinate via an OpenStreetMap embed; it is **not** proof of real-time foreground/background tracking. Courier PWA sends position only while open. Map availability depends on accessibility of the external tiles.

**Deployment:** Develop and test on a separate branch first; no automated production deployment is performed by adding this feature.
