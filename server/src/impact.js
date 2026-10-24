import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Factor is read from the versioned local dataset so the UI/API and documentation share one value.
const dataset = JSON.parse(readFileSync(fileURLToPath(new URL('./data/emission-factors.json', import.meta.url)), 'utf8'));
export const EMISSION_FACTOR_KG_CO2E_PER_KG = dataset.factors.find(f => f.id === 'general-edible-food-rescue').value;
export const estimateImpact = (quantityKg) => Number((quantityKg * EMISSION_FACTOR_KG_CO2E_PER_KG).toFixed(2));
export const IMPACT_METHODOLOGY = dataset.factors.find(f => f.id === 'general-edible-food-rescue').basis;
export const estimateImpactSnapshot = quantityKg => ({
  impactFactorKgCo2ePerKg: EMISSION_FACTOR_KG_CO2E_PER_KG,
  impactEstimateKgCo2e: estimateImpact(quantityKg),
  impactMethodology: IMPACT_METHODOLOGY
});
