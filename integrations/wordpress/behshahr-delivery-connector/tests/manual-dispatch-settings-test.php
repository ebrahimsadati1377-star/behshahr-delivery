<?php
// Standalone smoke test: php tests/manual-dispatch-settings-test.php
// Runs without a WordPress database or any network calls.
define('ABSPATH', __DIR__ . '/');
$GLOBALS['settings'] = [];
$GLOBALS['queued'] = 0;
$GLOBALS['http_calls'] = 0;

function add_action(...$args): void {}
function wp_parse_args($a, $b): array { return array_merge($b, $a); }
function get_option($key, $default = []) { return $GLOBALS['settings']; }
function esc_url_raw($v): string { return trim($v); }
function sanitize_key($v): string { return preg_replace('/[^a-z0-9_-]/', '', strtolower($v)); }
function sanitize_text_field($v): string { return trim((string)$v); }
function sanitize_textarea_field($v): string { return trim((string)$v); }
function as_next_scheduled_action(...$args): bool { return false; }
function as_enqueue_async_action(...$args): void { $GLOBALS['queued']++; }
function wp_remote_post(...$args) { $GLOBALS['http_calls']++; throw new RuntimeException('Unexpected HTTP request'); }
class WC_Order {
    public function get_meta($key, $single = true): string { return ''; }
    public function get_id(): int { return 123; }
}
function wc_get_order($id): WC_Order { return new WC_Order(); }

require dirname(__DIR__) . '/behshahr-delivery-connector.php';

function check(bool $result, string $message): void {
    if (!$result) throw new RuntimeException($message);
}

$on = BHD_Woo_Delivery_Connector::sanitize_settings([
    'enabled' => '1',
    'manual_dispatch_only' => '1',
    'trigger_status' => 'processing',
]);
check($on['manual_dispatch_only'] === '1', 'Checked flag not saved');
$off = BHD_Woo_Delivery_Connector::sanitize_settings([
    'enabled' => '1', 'trigger_status' => 'processing',
]);
check($off['manual_dispatch_only'] === '0', 'Unchecked flag not saved as 0');

$GLOBALS['settings'] = $on;
BHD_Woo_Delivery_Connector::status_changed(123, 'pending', 'processing', null);
check($GLOBALS['queued'] === 0, 'Auto queue was not blocked in manual-only mode');
BHD_Woo_Delivery_Connector::async_send(123);
check($GLOBALS['http_calls'] === 0, 'Queued background action sent an order after mode switched');

$GLOBALS['settings'] = $off;
BHD_Woo_Delivery_Connector::status_changed(123, 'pending', 'processing', null);
check($GLOBALS['queued'] === 1, 'Auto import not restored when flag cleared');

echo "manual-dispatch-settings-test: PASS\n";
