const target = process.env.TARGET_URL ?? 'http://127.0.0.1:4000/api/health';
const concurrency = positiveInt('CONCURRENCY', 25);
const totalRequests = positiveInt('TOTAL_REQUESTS', 500);
const timeoutMs = positiveInt('REQUEST_TIMEOUT_MS', 3000);
const maxP95Ms = positiveInt('MAX_P95_MS', 750);
const maxErrorRate = positiveNumber('MAX_ERROR_RATE', 0.01);

let next = 0;
let failed = 0;
const latencies = [];

const started = performance.now();

await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));

const elapsedMs = performance.now() - started;
latencies.sort((a, b) => a - b);
const p50 = percentile(latencies, 0.5);
const p95 = percentile(latencies, 0.95);
const p99 = percentile(latencies, 0.99);
const errorRate = failed / totalRequests;
const rps = totalRequests / (elapsedMs / 1000);

const result = {
  target,
  totalRequests,
  concurrency,
  failed,
  errorRate: Number(errorRate.toFixed(4)),
  elapsedMs: Math.round(elapsedMs),
  requestsPerSecond: Number(rps.toFixed(1)),
  p50Ms: Math.round(p50),
  p95Ms: Math.round(p95),
  p99Ms: Math.round(p99),
  thresholds: { maxP95Ms, maxErrorRate },
};

console.log(JSON.stringify(result, null, 2));

if (errorRate > maxErrorRate || p95 > maxP95Ms) {
  process.exitCode = 1;
}

async function worker() {
  while (true) {
    const index = next++;
    if (index >= totalRequests) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const requestStarted = performance.now();
    try {
      const response = await fetch(target, {
        headers: { 'user-agent': 'behshahr-delivery-pilot-load/1.0' },
        signal: controller.signal,
      });
      const elapsed = performance.now() - requestStarted;
      latencies.push(elapsed);
      if (!response.ok) failed++;
      else await response.arrayBuffer();
    } catch {
      failed++;
      latencies.push(performance.now() - requestStarted);
    } finally {
      clearTimeout(timer);
    }
  }
}

function percentile(values, ratio) {
  if (!values.length) return Infinity;
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
}

function positiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function positiveNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  return value;
}
