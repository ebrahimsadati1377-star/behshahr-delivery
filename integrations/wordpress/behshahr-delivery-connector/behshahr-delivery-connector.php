<?php
/**
 * Plugin Name: Behshahr Delivery Connector
 * Description: Sends WooCommerce orders to the Behshahr Delivery dispatcher.
 * Version: 0.2.0
 * Requires Plugins: woocommerce
 * Author: Behshahr Delivery
 */

if (!defined('ABSPATH')) {
    exit;
}

final class BHD_Woo_Delivery_Connector {
    private const OPTION = 'bhd_delivery_connector_settings';
    private const META_ORDER_ID = '_bhd_delivery_order_id';
    private const META_PUBLIC_CODE = '_bhd_delivery_public_code';
    private const META_LAST_SYNC = '_bhd_delivery_last_sync';
    private const ASYNC_HOOK = 'bhd_delivery_send_order';
    private const STATUS_ASYNC_HOOK = 'bhd_delivery_sync_completed_order';

    public static function boot(): void {
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('admin_menu', [self::class, 'admin_menu']);
        add_action('woocommerce_order_status_changed', [self::class, 'status_changed'], 10, 4);
        add_filter('woocommerce_order_actions', [self::class, 'order_actions']);
        add_action('woocommerce_order_action_bhd_send_to_delivery', [self::class, 'manual_send']);
        add_action(self::ASYNC_HOOK, [self::class, 'async_send'], 10, 1);
        add_action(self::STATUS_ASYNC_HOOK, [self::class, 'async_sync_completed'], 10, 1);
    }

    public static function register_settings(): void {
        register_setting(
            'bhd_delivery_connector',
            self::OPTION,
            ['sanitize_callback' => [self::class, 'sanitize_settings']]
        );
    }

    public static function admin_menu(): void {
        add_submenu_page(
            'woocommerce',
            'Behshahr Delivery',
            'Delivery Connector',
            'manage_woocommerce',
            'bhd-delivery-connector',
            [self::class, 'settings_page']
        );
    }

    public static function sanitize_settings($input): array {
        $input = is_array($input) ? $input : [];
        $vehicle = strtoupper((string)($input['vehicle_type'] ?? 'MOTORBIKE'));
        $trigger = sanitize_key((string)($input['trigger_status'] ?? 'processing'));

        return [
            'enabled' => empty($input['enabled']) ? '0' : '1',
            'api_url' => esc_url_raw((string)($input['api_url'] ?? '')),
            'api_key' => sanitize_text_field((string)($input['api_key'] ?? '')),
            'store_id' => sanitize_key((string)($input['store_id'] ?? 'dekan')),
            'trigger_status' => $trigger ?: 'processing',
            'vehicle_type' => in_array($vehicle, ['MOTORBIKE', 'CAR'], true) ? $vehicle : 'MOTORBIKE',
            'pickup_title' => sanitize_text_field((string)($input['pickup_title'] ?? 'فروشگاه')),
            'pickup_address' => sanitize_textarea_field((string)($input['pickup_address'] ?? '')),
            'pickup_latitude' => sanitize_text_field((string)($input['pickup_latitude'] ?? '')),
            'pickup_longitude' => sanitize_text_field((string)($input['pickup_longitude'] ?? '')),
            'latitude_meta_key' => sanitize_text_field((string)($input['latitude_meta_key'] ?? '_billing_latitude')),
            'longitude_meta_key' => sanitize_text_field((string)($input['longitude_meta_key'] ?? '_billing_longitude')),
        ];
    }

    public static function settings_page(): void {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }
        $settings = self::settings();
        ?>
        <div class="wrap">
            <h1>Behshahr Delivery Connector</h1>
            <p>سفارش ووکامرس را پس از رسیدن به وضعیت انتخابی به پنل دیسپچ ارسال می‌کند و وضعیت completed را با Delivery همگام می‌کند.</p>
            <form method="post" action="options.php">
                <?php settings_fields('bhd_delivery_connector'); ?>
                <table class="form-table" role="presentation">
                    <tr><th>فعال</th><td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[enabled]" value="1" <?php checked($settings['enabled'], '1'); ?>> ارسال خودکار سفارش‌ها</label></td></tr>
                    <tr><th>API URL</th><td><input class="regular-text" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[api_url]" value="<?php echo esc_attr($settings['api_url']); ?>"></td></tr>
                    <tr><th>Integration Key</th><td><input class="regular-text" type="password" autocomplete="new-password" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[api_key]" value="<?php echo esc_attr($settings['api_key']); ?>"></td></tr>
                    <tr><th>Store ID</th><td><input class="regular-text" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[store_id]" value="<?php echo esc_attr($settings['store_id']); ?>"></td></tr>
                    <tr><th>وضعیت ارسال</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[trigger_status]"><?php foreach (wc_get_order_statuses() as $key => $label) { $value = str_replace('wc-', '', $key); echo '<option value="' . esc_attr($value) . '" ' . selected($settings['trigger_status'], $value, false) . '>' . esc_html($label) . '</option>'; } ?></select></td></tr>
                    <tr><th>وسیله پیش‌فرض</th><td><select name="<?php echo esc_attr(self::OPTION); ?>[vehicle_type]"><option value="MOTORBIKE" <?php selected($settings['vehicle_type'], 'MOTORBIKE'); ?>>موتور</option><option value="CAR" <?php selected($settings['vehicle_type'], 'CAR'); ?>>خودرو</option></select></td></tr>
                    <tr><th>نام مبدا</th><td><input class="regular-text" name="<?php echo esc_attr(self::OPTION); ?>[pickup_title]" value="<?php echo esc_attr($settings['pickup_title']); ?>"></td></tr>
                    <tr><th>آدرس مبدا</th><td><textarea class="large-text" rows="2" name="<?php echo esc_attr(self::OPTION); ?>[pickup_address]"><?php echo esc_textarea($settings['pickup_address']); ?></textarea></td></tr>
                    <tr><th>Latitude مبدا</th><td><input class="regular-text" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[pickup_latitude]" value="<?php echo esc_attr($settings['pickup_latitude']); ?>"></td></tr>
                    <tr><th>Longitude مبدا</th><td><input class="regular-text" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[pickup_longitude]" value="<?php echo esc_attr($settings['pickup_longitude']); ?>"></td></tr>
                    <tr><th>Order meta برای Latitude مقصد</th><td><input class="regular-text" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[latitude_meta_key]" value="<?php echo esc_attr($settings['latitude_meta_key']); ?>"><p class="description">اگر checkout شما مختصات را در meta دیگری ذخیره می‌کند، کلید را اینجا وارد کنید.</p></td></tr>
                    <tr><th>Order meta برای Longitude مقصد</th><td><input class="regular-text" dir="ltr" name="<?php echo esc_attr(self::OPTION); ?>[longitude_meta_key]" value="<?php echo esc_attr($settings['longitude_meta_key']); ?>"></td></tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public static function status_changed($order_id, $from, $to, $order): void {
        $settings = self::settings();
        if ($settings['enabled'] !== '1') {
            return;
        }

        if ($to === $settings['trigger_status']) {
            self::enqueue((int)$order_id);
        }

        if (in_array($to, ['completed', 'approved'], true) && $order instanceof WC_Order && $order->get_meta(self::META_ORDER_ID, true)) {
            self::enqueue_completed_sync((int)$order_id);
        }
    }

    public static function order_actions(array $actions): array {
        $actions['bhd_send_to_delivery'] = 'ارسال به Behshahr Delivery';
        return $actions;
    }

    public static function manual_send($order): void {
        if ($order instanceof WC_Order) {
            self::send_order($order->get_id(), true);
        }
    }

    public static function async_send($order_id): void {
        self::send_order((int)$order_id, false);
    }

    public static function async_sync_completed($order_id): void {
        self::sync_completed_order((int)$order_id);
    }

    private static function enqueue(int $order_id): void {
        if (function_exists('as_enqueue_async_action')) {
            if (!function_exists('as_next_scheduled_action') || !as_next_scheduled_action(self::ASYNC_HOOK, [$order_id], 'behshahr-delivery')) {
                as_enqueue_async_action(self::ASYNC_HOOK, [$order_id], 'behshahr-delivery');
            }
            return;
        }
        if (!wp_next_scheduled(self::ASYNC_HOOK, [$order_id])) {
            wp_schedule_single_event(time() + 5, self::ASYNC_HOOK, [$order_id]);
        }
    }

    private static function enqueue_completed_sync(int $order_id): void {
        if (function_exists('as_enqueue_async_action')) {
            if (!function_exists('as_next_scheduled_action') || !as_next_scheduled_action(self::STATUS_ASYNC_HOOK, [$order_id], 'behshahr-delivery')) {
                as_enqueue_async_action(self::STATUS_ASYNC_HOOK, [$order_id], 'behshahr-delivery');
            }
            return;
        }
        if (!wp_next_scheduled(self::STATUS_ASYNC_HOOK, [$order_id])) {
            wp_schedule_single_event(time() + 5, self::STATUS_ASYNC_HOOK, [$order_id]);
        }
    }

    private static function send_order(int $order_id, bool $force): void {
        if (!function_exists('wc_get_order')) {
            return;
        }
        $order = wc_get_order($order_id);
        if (!$order instanceof WC_Order) {
            return;
        }
        if (!$force && $order->get_meta(self::META_ORDER_ID, true)) {
            return;
        }

        $settings = self::settings();
        $validation = self::validate_settings($settings);
        if (is_wp_error($validation)) {
            self::record_error($order, $validation->get_error_message());
            return;
        }

        $coordinates = self::dropoff_coordinates($order, $settings);
        if (is_wp_error($coordinates)) {
            self::record_error($order, $coordinates->get_error_message());
            return;
        }

        $payload = self::payload($order, $settings, $coordinates);
        $response = wp_remote_post($settings['api_url'], [
            'timeout' => 12,
            'redirection' => 0,
            'headers' => self::api_headers($settings),
            'body' => wp_json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        if (is_wp_error($response)) {
            self::record_error($order, $response->get_error_message());
            return;
        }

        $status = (int)wp_remote_retrieve_response_code($response);
        $raw = (string)wp_remote_retrieve_body($response);
        $body = json_decode($raw, true);
        if ($status < 200 || $status >= 300 || !is_array($body) || empty($body['order']['id'])) {
            $message = is_array($body) && !empty($body['message']) ? (string)$body['message'] : ('HTTP ' . $status);
            self::record_error($order, $message);
            return;
        }

        $order->update_meta_data(self::META_ORDER_ID, sanitize_text_field((string)$body['order']['id']));
        if (!empty($body['order']['publicCode'])) {
            $order->update_meta_data(self::META_PUBLIC_CODE, sanitize_text_field((string)$body['order']['publicCode']));
        }
        $order->update_meta_data(self::META_LAST_SYNC, gmdate('c'));
        $order->save();

        $duplicate = !empty($body['duplicate']) ? ' (قبلاً ثبت شده بود)' : '';
        $public_code = !empty($body['order']['publicCode']) ? ' - ' . sanitize_text_field((string)$body['order']['publicCode']) : '';
        $order->add_order_note('Behshahr Delivery: سفارش ارسال شد' . $public_code . $duplicate);
    }

    private static function sync_completed_order(int $order_id): void {
        if (!function_exists('wc_get_order')) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order instanceof WC_Order || !in_array($order->get_status(), ['completed', 'approved'], true)) {
            return;
        }

        if (!$order->get_meta(self::META_ORDER_ID, true)) {
            return;
        }

        $settings = self::settings();
        $validation = self::validate_api_settings($settings);
        if (is_wp_error($validation)) {
            self::record_error($order, $validation->get_error_message());
            return;
        }

        $status_url = rtrim($settings['api_url'], '/') . '/status';
        $response = wp_remote_post($status_url, [
            'timeout' => 12,
            'redirection' => 0,
            'headers' => self::api_headers($settings),
            'body' => wp_json_encode([
                'storeId' => $settings['store_id'],
                'externalOrderId' => (string)$order->get_id(),
                'status' => 'completed',
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        if (is_wp_error($response)) {
            self::record_error($order, 'همگام‌سازی completed: ' . $response->get_error_message());
            return;
        }

        $status = (int)wp_remote_retrieve_response_code($response);
        $raw = (string)wp_remote_retrieve_body($response);
        $body = json_decode($raw, true);
        if ($status < 200 || $status >= 300 || !is_array($body) || empty($body['order']['id'])) {
            $message = is_array($body) && !empty($body['message']) ? (string)$body['message'] : ('HTTP ' . $status);
            self::record_error($order, 'همگام‌سازی completed: ' . $message);
            return;
        }

        $order->update_meta_data(self::META_LAST_SYNC, gmdate('c'));
        $order->save();

        $suffix = !empty($body['alreadyCompleted']) ? ' (قبلاً تکمیل شده بود)' : '';
        $order->add_order_note('Behshahr Delivery: وضعیت completed همگام شد و سفارش Delivery بسته شد' . $suffix);
    }

    private static function api_headers(array $settings): array {
        return [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'X-Delivery-Key' => $settings['api_key'],
        ];
    }

    private static function payload(WC_Order $order, array $settings, array $coordinates): array {
        $name = trim($order->get_shipping_first_name() . ' ' . $order->get_shipping_last_name());
        if ($name === '') {
            $name = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
        }
        if ($name === '') {
            $name = 'مشتری ووکامرس';
        }

        $phone = self::latin_digits((string)$order->get_billing_phone());
        $address = self::shipping_address($order);
        $details = trim(implode(' - ', array_filter([
            $phone !== '' ? 'تلفن: ' . $phone : '',
            $order->get_shipping_address_2(),
        ])));

        return [
            'storeId' => $settings['store_id'],
            'externalOrderId' => (string)$order->get_id(),
            'customer' => [
                'name' => $name,
                'phone' => $phone,
            ],
            'pickup' => [
                'title' => $settings['pickup_title'],
                'formattedAddress' => $settings['pickup_address'],
                'latitude' => (float)$settings['pickup_latitude'],
                'longitude' => (float)$settings['pickup_longitude'],
            ],
            'dropoff' => [
                'title' => $name,
                'formattedAddress' => $address,
                'latitude' => (float)$coordinates['latitude'],
                'longitude' => (float)$coordinates['longitude'],
                'details' => $details,
            ],
            'vehicleType' => $settings['vehicle_type'],
            'notes' => (string)$order->get_customer_note(),
            'payment' => [
                'paid' => $order->is_paid(),
                'methodId' => (string)$order->get_payment_method(),
                'methodTitle' => (string)$order->get_payment_method_title(),
            ],
            'metadata' => [
                'orderNumber' => (string)$order->get_order_number(),
                'status' => (string)$order->get_status(),
                'currency' => (string)$order->get_currency(),
                'total' => (string)$order->get_total(),
                'shippingTotal' => (string)$order->get_shipping_total(),
                'siteUrl' => home_url('/'),
            ],
        ];
    }

    private static function shipping_address(WC_Order $order): string {
        $parts = array_filter([
            $order->get_shipping_address_1() ?: $order->get_billing_address_1(),
            $order->get_shipping_address_2() ?: $order->get_billing_address_2(),
            $order->get_shipping_city() ?: $order->get_billing_city(),
            $order->get_shipping_state() ?: $order->get_billing_state(),
            $order->get_shipping_postcode() ?: $order->get_billing_postcode(),
        ]);
        return implode('، ', array_map('strval', $parts));
    }

    private static function dropoff_coordinates(WC_Order $order, array $settings) {
        $pair_keys = [
            '_billing_map_lat_long', 'billing_map_lat_long',
            '_billing_mnsjay_location', 'billing_mnsjay_location',
            '_shipping_mnsjay_location', 'shipping_mnsjay_location',
            '_mnsjay_location_coords',
        ];
        $pair = self::first_coordinate_pair_meta($order, $pair_keys);
        if ($pair !== null) {
            return $pair;
        }

        $lat_keys = array_values(array_unique(array_filter([
            $settings['latitude_meta_key'],
            '_billing_latitude', 'billing_latitude', '_billing_lat', 'billing_lat',
            '_shipping_latitude', 'shipping_latitude', '_shipping_lat', 'shipping_lat',
            '_map_latitude', 'map_latitude', 'latitude',
        ])));
        $lng_keys = array_values(array_unique(array_filter([
            $settings['longitude_meta_key'],
            '_billing_longitude', 'billing_longitude', '_billing_lng', 'billing_lng',
            '_shipping_longitude', 'shipping_longitude', '_shipping_lng', 'shipping_lng',
            '_map_longitude', 'map_longitude', 'longitude',
        ])));

        $lat = self::first_numeric_meta($order, $lat_keys);
        $lng = self::first_numeric_meta($order, $lng_keys);
        if ($lat === null || $lng === null || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            return new WP_Error('bhd_missing_coordinates', 'مختصات مقصد در سفارش پیدا نشد. کلیدهای Latitude/Longitude را در تنظیمات Connector بررسی کن.');
        }
        return ['latitude' => $lat, 'longitude' => $lng];
    }

    private static function first_coordinate_pair_meta(WC_Order $order, array $keys): ?array {
        foreach ($keys as $key) {
            $raw = trim(self::latin_digits((string)$order->get_meta($key, true)));
            if ($raw === '') {
                continue;
            }
            if (!preg_match('/^\s*(-?[0-9]+(?:\.[0-9]+)?)\s*[,;|،؛]\s*(-?[0-9]+(?:\.[0-9]+)?)\s*$/u', $raw, $matches)) {
                continue;
            }
            $lat = (float)$matches[1];
            $lng = (float)$matches[2];
            if ($lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180) {
                return ['latitude' => $lat, 'longitude' => $lng];
            }
        }
        return null;
    }

    private static function first_numeric_meta(WC_Order $order, array $keys): ?float {
        foreach ($keys as $key) {
            $raw = self::latin_digits((string)$order->get_meta($key, true));
            $raw = str_replace(',', '.', trim($raw));
            if ($raw !== '' && is_numeric($raw)) {
                return (float)$raw;
            }
        }
        return null;
    }

    private static function validate_api_settings(array $settings) {
        if ($settings['api_url'] === '' || $settings['api_key'] === '' || $settings['store_id'] === '') {
            return new WP_Error('bhd_config', 'API URL، Integration Key و Store ID باید تنظیم شوند.');
        }
        return true;
    }

    private static function validate_settings(array $settings) {
        $api_validation = self::validate_api_settings($settings);
        if (is_wp_error($api_validation)) {
            return $api_validation;
        }
        if (!is_numeric($settings['pickup_latitude']) || !is_numeric($settings['pickup_longitude'])) {
            return new WP_Error('bhd_pickup', 'مختصات مبدا معتبر نیست.');
        }
        if ($settings['pickup_address'] === '') {
            return new WP_Error('bhd_pickup_address', 'آدرس مبدا تنظیم نشده است.');
        }
        return true;
    }

    private static function record_error(WC_Order $order, string $message): void {
        $message = wp_strip_all_tags($message);
        $order->add_order_note('Behshahr Delivery - خطا: ' . $message);
        if (function_exists('wc_get_logger')) {
            wc_get_logger()->error($message, ['source' => 'behshahr-delivery', 'order_id' => $order->get_id()]);
        }
    }

    private static function latin_digits(string $value): string {
        return strtr($value, [
            '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
            '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
        ]);
    }

    private static function settings(): array {
        $defaults = [
            'enabled' => '0',
            'api_url' => 'http://127.0.0.1:4000/api/integrations/woocommerce/orders',
            'api_key' => '',
            'store_id' => 'dekan',
            'trigger_status' => 'processing',
            'vehicle_type' => 'MOTORBIKE',
            'pickup_title' => 'فروشگاه دکن',
            'pickup_address' => '',
            'pickup_latitude' => '',
            'pickup_longitude' => '',
            'latitude_meta_key' => '_billing_latitude',
            'longitude_meta_key' => '_billing_longitude',
        ];
        $saved = get_option(self::OPTION, []);
        return wp_parse_args(is_array($saved) ? $saved : [], $defaults);
    }
}

add_action('plugins_loaded', [BHD_Woo_Delivery_Connector::class, 'boot']);
