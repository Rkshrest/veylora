export function validateDonationInput(b) {
  const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
  return text(b.foodName, 100) && ['Produce','Prepared meals','Bakery','Dairy','Pantry','Other'].includes(b.category) &&
    Number.isFinite(b.quantityKg) && b.quantityKg >= 0.1 && text(b.donor, 100) && text(b.pickupLocation, 200) &&
    Boolean(b.pickupDeadline) && !Number.isNaN(Date.parse(b.pickupDeadline)) && Date.parse(b.pickupDeadline) > Date.now() &&
    (!b.handlingNotes || (typeof b.handlingNotes === 'string' && b.handlingNotes.length <= 1000)) &&
    (!b.allergens || (typeof b.allergens === 'string' && b.allergens.length <= 500));
}

export function reservationDecision(totalKg, reservedKg, requestedKg, duplicate = false) {
  if (duplicate) return { allowed: false, reason: 'duplicate' };
  if (requestedKg <= 0 || reservedKg + requestedKg > totalKg + 1e-9) return { allowed: false, reason: 'over-allocation' };
  return { allowed: true, remainingKg: Number((totalKg - reservedKg - requestedKg).toFixed(3)) };
}
