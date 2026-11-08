import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { RoutingComparison } from './routing-comparison';
import { RoutingProvider } from './routing-provider';

const previousFlag = process.env.ROUTING_EVALUATION_ENABLED;
after(() => {
  if (previousFlag === undefined) delete process.env.ROUTING_EVALUATION_ENABLED;
  else process.env.ROUTING_EVALUATION_ENABLED = previousFlag;
});
const request = {
  origin: { lat: 36.69, lng: 53.54 },
  destination: { lat: 36.70, lng: 53.55 },
  mode: 'car' as const,
};
const mock: RoutingProvider = {
  name: 'balad',
  async estimate() {
    return {
      provider: 'balad', distanceMeters: 1500, durationSeconds: 240,
      trafficAware: false, measuredAt: new Date().toISOString(),
    };
  },
};
test('disabled by default', async () => {
  delete process.env.ROUTING_EVALUATION_ENABLED;
  await assert.rejects(new RoutingComparison([mock]).compare(request), /disabled/);
});
test('returns normalized mocked route without live API calls', async () => {
  process.env.ROUTING_EVALUATION_ENABLED = 'true';
  const result = await new RoutingComparison([mock]).compare(request);
  assert.equal(result[0].ok, true);
  if (result[0].ok) assert.equal(result[0].estimate.distanceMeters, 1500);
});
test('rejects invalid coordinates', async () => {
  process.env.ROUTING_EVALUATION_ENABLED = 'true';
  await assert.rejects(new RoutingComparison([mock]).compare({
    ...request, origin: { lat: 100, lng: 53 },
  }), RangeError);
});
test('isolates failing provider', async () => {
  process.env.ROUTING_EVALUATION_ENABLED = 'true';
  const failing: RoutingProvider = {
    name: 'neshan', async estimate() { throw new Error('secret key'); },
  };
  const results = await new RoutingComparison([mock, failing]).compare(request);
  assert.equal(results[0].ok, true);
  assert.deepEqual(results[1].ok, false);
  if (!results[1].ok) assert.equal(results[1].error, 'provider_error');
});
test('times out unavailable provider', async () => {
  process.env.ROUTING_EVALUATION_ENABLED = 'true';
  const hanging: RoutingProvider = {
    name: 'neshan', estimate: () => new Promise(() => {}),
  };
  const result = await new RoutingComparison([hanging], 10).compare(request);
  assert.equal(result[0].ok, false);
});
