<?php
/**
 * Admin-only WooCommerce order courier assignment.
 * Works with HPOS and legacy order screens; uses the existing loopback integration key.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class BHD_Woo_Courier_Dispatch {
    private const SETTINGS = 'bhd_delivery_connector_settings';
    private const ORDER_META = '_bhd_delivery_order_id';
    private const COURIER_META = '_bhd_delivery_courier_name';

    public static function boot(): void {
        add_action('add_meta_boxes', [self::class, 'register_box']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_scripts']);
        add_action('wp_ajax_bhd_delivery_couriers', [self::class, 'ajax_couriers']);
        add_action('wp_ajax_bhd_delivery_assign_courier', [self::class, 'ajax_assign']);
        add_filter('manage_edit-shop_order_columns', [self::class, 'order_column']);
        add_action('manage_shop_order_posts_custom_column', [self::class, 'legacy_order_column'], 10, 2);
        add_filter('manage_woocommerce_page_wc-orders_columns', [self::class, 'order_column']);
        add_action('manage_woocommerce_page_wc-orders_custom_column', [self::class, 'hpos_order_column'], 10, 2);
    }

    public static function order_column(array $columns): array {
        $columns['bhd_delivery_courier'] = 'راننده ارسال';
        return $columns;
    }

    public static function legacy_order_column(string $column, int $post_id): void {
        if ($column === 'bhd_delivery_courier') {
            self::print_order_column(wc_get_order($post_id));
        }
    }

    public static function hpos_order_column(string $column, $order): void {
        if ($column === 'bhd_delivery_courier') {
            self::print_order_column($order);
        }
    }

    private static function print_order_column($order): void {
        if (!$order instanceof WC_Order) {
            echo '—';
            return;
        }
        $name = $order->get_meta(self::COURIER_META, true);
        echo $name ? esc_html((string)$name) : '—';
    }

    public static function register_box(): void {
        if (!function_exists('wc_get_order')) {
            return;
        }
        $screens = ['shop_order'];
        if (function_exists('wc_get_page_screen_id')) {
            $screens[] = wc_get_page_screen_id('shop-order');
        }
        foreach (array_unique($screens) as $screen) {
            add_meta_box(
                'bhd-delivery-courier',
                'تخصیص راننده ارسال',
                [self::class, 'render_box'],
                $screen,
                'side',
                'high'
            );
        }
    }

    public static function enqueue_scripts($hook): void {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        $screens = ['shop_order', 'woocommerce_page_wc-orders'];
        if (function_exists('wc_get_page_screen_id')) {
            $screens[] = wc_get_page_screen_id('shop-order');
        }
        if (!$screen || !in_array($screen->id, $screens, true)) {
            return;
        }
        wp_enqueue_script(
            'bhd-courier-dispatch',
            plugins_url('assets/courier-dispatch.js', dirname(__DIR__) . '/behshahr-delivery-connector.php'),
            [],
            '0.3.0',
            true
        );
        wp_localize_script('bhd-courier-dispatch', 'BHDDeliveryDispatch', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
        ]);
    }

    public static function render_box($post_or_order): void {
        $order = $post_or_order instanceof WC_Order
            ? $post_or_order
            : ($post_or_order instanceof WP_Post ? wc_get_order($post_or_order->ID) : null);
        if (!$order instanceof WC_Order || !current_user_can('manage_woocommerce')) {
            return;
        }

        $id = $order->get_id();
        $settings = self::settings();
        $configured = !empty($settings['api_url']) && !empty($settings['api_key']) && !empty($settings['store_id']);
        if (!$configured) {
            echo '<p>ابتدا تنظیمات Delivery Connector را کامل کنید.</p>';
            return;
        }

        echo '<div class="bhd-courier-dispatch" data-order-id="' . esc_attr((string)$id) . '" data-nonce="' . esc_attr(wp_create_nonce('bhd_courier_assign_' . $id)) . '">';
        echo '<p class="bhd-dispatch-status" role="status">در حال دریافت وضعیت ارسال…</p>';
        echo '<label style="display:block;margin:12px 0 6px" for="bhd-dispatch-select-' . esc_attr((string)$id) . '"><strong>راننده آماده</strong></label>';
        echo '<select class="bhd-dispatch-select" id="bhd-dispatch-select-' . esc_attr((string)$id) . '" style="width:100%" disabled><option>در حال بارگذاری…</option></select>';
        echo '<p class="description">راننده آنلاین و مشغول با ظرفیت خالی، تا ۵ سفارش همزمان و وسیله مطابق سفارش، قابل انتخاب است.</p>';
        echo '<button type="button" class="button button-primary bhd-dispatch-submit" style="width:100%;margin-top:9px" disabled>ارسال سفارش به راننده</button>';
        echo '<p class="bhd-dispatch-notice" role="alert" style="margin-top:9px"></p>';
        echo '<button type="button" class="button-link bhd-dispatch-refresh">بروزرسانی رانندگان</button>';
        echo '</div>';
    }

    private static function settings(): array {
        $settings = get_option(self::SETTINGS, []);
        return is_array($settings) ? $settings : [];
    }

    private static function check_access(): WC_Order {
        $order_id = isset($_POST['order_id']) ? absint(wp_unslash($_POST['order_id'])) : 0;
        $nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';
        if (!current_user_can('manage_woocommerce') || !$order_id || !wp_verify_nonce($nonce, 'bhd_courier_assign_' . $order_id)) {
            wp_send_json_error(['message' => 'دسترسی معتبر نیست.'], 403);
        }
        $order = function_exists('wc_get_order') ? wc_get_order($order_id) : null;
        if (!$order instanceof WC_Order) {
            wp_send_json_error(['message' => 'سفارش پیدا نشد.'], 404);
        }
        return $order;
    }

    private static function request(string $method, string $resource, array $payload = []) {
        $settings = self::settings();
        $base = isset($settings['api_url']) ? rtrim((string)$settings['api_url'], '/') : '';
        if (!preg_match('~/orders$~', $base) || empty($settings['api_key']) || empty($settings['store_id'])) {
            return new WP_Error('bhd_config', 'تنظیمات اتصال به Delivery کامل نیست.');
        }
        $base = substr($base, 0, -strlen('/orders'));
        $url = $base . $resource;
        if ($method === 'GET' && $payload) {
            $url = add_query_arg($payload, $url);
        }

        $args = [
            'method' => $method,
            'timeout' => 10,
            'redirection' => 0,
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
                'X-Delivery-Key' => (string)$settings['api_key'],
            ],
        ];
        if ($method !== 'GET') {
            $args['body'] = wp_json_encode($payload);
        }
        $response = wp_remote_request($url, $args);
        if (is_wp_error($response)) {
            return $response;
        }
        $status = (int)wp_remote_retrieve_response_code($response);
        $data = json_decode((string)wp_remote_retrieve_body($response), true);
        if ($status < 200 || $status >= 300 || !is_array($data)) {
            $message = is_array($data) && isset($data['message']) ? $data['message'] : ('HTTP ' . $status);
            if (is_array($message)) {
                $message = implode('، ', array_map('strval', $message));
            }
            return new WP_Error('bhd_api', wp_strip_all_tags((string)$message));
        }
        return $data;
    }

    public static function ajax_couriers(): void {
        $order = self::check_access();
        $settings = self::settings();
        $lookup = [
            'storeId' => (string)($settings['store_id'] ?? ''),
            'externalOrderId' => (string)$order->get_id(),
        ];

        $couriers = self::request('GET', '/couriers');
        if (is_wp_error($couriers)) {
            wp_send_json_error(['message' => $couriers->get_error_message()], 502);
        }
        $assignment = self::request('GET', '/orders/assignment', $lookup);
        if (is_wp_error($assignment)) {
            wp_send_json_error(['message' => $assignment->get_error_message()], 502);
        }
        wp_send_json_success([
            'couriers' => $couriers,
            'assignment' => $assignment,
            'vehicleType' => !empty($assignment['linked']) ? $assignment['vehicleType'] : ($settings['vehicle_type'] ?? 'MOTORBIKE'),
        ]);
    }

    public static function ajax_assign(): void {
        $order = self::check_access();
        $courier_id = isset($_POST['courier_id']) ? sanitize_text_field(wp_unslash($_POST['courier_id'])) : '';
        if (!preg_match('/^[a-f0-9-]{36}$/i', $courier_id)) {
            wp_send_json_error(['message' => 'راننده معتبر انتخاب نشده است.'], 400);
        }
        if (in_array($order->get_status(), ['cancelled', 'refunded', 'failed'], true)) {
            wp_send_json_error(['message' => 'سفارش بسته یا لغو شده قابل تخصیص نیست.'], 409);
        }

        // Only one delivery order is imported; existing linkage is reused.
        if (!$order->get_meta(self::ORDER_META, true)) {
            BHD_Woo_Delivery_Connector::send_order($order->get_id(), true);
            $order = wc_get_order($order->get_id());
            if (!$order instanceof WC_Order || !$order->get_meta(self::ORDER_META, true)) {
                wp_send_json_error(['message' => 'ارسال سفارش به Delivery ناموفق بود؛ جزئیات در یادداشت‌های سفارش است.'], 422);
            }
        }

        $settings = self::settings();
        $assignment = self::request('POST', '/orders/assign', [
            'storeId' => (string)($settings['store_id'] ?? ''),
            'externalOrderId' => (string)$order->get_id(),
            'courierId' => $courier_id,
        ]);
        if (is_wp_error($assignment)) {
            $order->add_order_note('Behshahr Delivery - تخصیص راننده ناموفق: ' . $assignment->get_error_message());
            wp_send_json_error(['message' => $assignment->get_error_message()], 409);
        }

        $courier_name = $courier_id;
        $couriers = self::request('GET', '/couriers');
        if (is_array($couriers)) {
            foreach ($couriers as $courier) {
                if (($courier['id'] ?? '') === $courier_id) {
                    $courier_name = (string)($courier['fullName'] ?: $courier['phone']);
                    break;
                }
            }
        }

        $order->update_meta_data(self::COURIER_META, sanitize_text_field($courier_name));
        $order->save();
        $order->add_order_note(
            'Behshahr Delivery: سفارش ' . sanitize_text_field((string)($assignment['publicCode'] ?? '')) .
            ' به راننده ' . sanitize_text_field($courier_name) . ' تخصیص یافت.'
        );
        wp_send_json_success([
            'message' => 'سفارش با موفقیت به راننده تخصیص یافت و در پنل پیک او قرار گرفت.',
            'assignment' => $assignment,
        ]);
    }
}
