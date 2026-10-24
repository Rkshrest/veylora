import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDonationInput, reservationDecision } from './domain.js';
import { estimateImpact, estimateImpactSnapshot, IMPACT_METHODOLOGY, EMISSION_FACTOR_KG_CO2E_PER_KG } from './impact.js';

const validDonation = () => ({ foodName: 'Seasonal produce', category: 'Produce', quantityKg: 12.5, donor: 'Campus kitchen', pickupLocation: 'North entrance', pickupDeadline: new Date(Date.now() + 3600000).toISOString(), handlingNotes: '', allergens: '' });

test('accepts a complete donation with a future deadline', () => assert.equal(validateDonationInput(validDonation()), true));
test('rejects invalid quantity and past deadline', () => {
  assert.equal(validateDonationInput({ ...validDonation(), quantityKg: 0 }), false);
  assert.equal(validateDonationInput({ ...validDonation(), pickupDeadline: '2020-01-01' }), false);
});
test('reservation logic prevents duplicate holds and over-allocation', () => {
  assert.deepEqual(reservationDecision(10, 4, 6), { allowed: true, remainingKg: 0 });
  assert.equal(reservationDecision(10, 4, 6.1).reason, 'over-allocation');
  assert.equal(reservationDecision(10, 4, 1, true).reason, 'duplicate');
});
test('impact estimate is derived from the documented factor', () => assert.equal(estimateImpact(8), 20));
test('completed rescue impact snapshots preserve the factor and method used', () => {
  assert.deepEqual(estimateImpactSnapshot(8), {
    impactFactorKgCo2ePerKg: EMISSION_FACTOR_KG_CO2E_PER_KG,
    impactEstimateKgCo2e: 20,
    impactMethodology: IMPACT_METHODOLOGY
  });
});
