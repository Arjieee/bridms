const BULK_UNITS_SET = new Set([
  'sack', 'sacks',
  'box', 'boxes',
  'case', 'cases',
  'carton', 'cartons',
  'crate', 'crates',
  'bale', 'bales',
  'bundle', 'bundles',
  'container', 'containers',
  'drum', 'drums',
  'carboy', 'carboys',
  'gallon', 'gallons',
  'bag', 'bags',
  'tub', 'tubs',
]);

export function isBulkPackaging(unit) {
  if (!unit) return false;
  const clean = unit.trim().toLowerCase();
  if (BULK_UNITS_SET.has(clean)) return true;
  const bulkKeywords = ['sack', 'box', 'case', 'carton', 'crate', 'bale', 'bundle', 'container', 'drum', 'carboy', 'gallon', 'bag'];
  return bulkKeywords.some((k) => clean.includes(k));
}

/**
 * Intelligent inventory item resolver for distribution packages.
 * Guarantees that items requesting distribution units (e.g. 'kg') will NEVER
 * be bound or mapped to bulk packaging units (e.g. 'sacks').
 *
 * @param {Object} item - { item_id, item_name, unit, donor_name }
 * @param {Array} inventory - List of warehouse InventoryItem objects
 * @returns {Object|null} matched inventory item
 */
export function resolveInventoryMatch(item, inventory = []) {
  if (!item || !Array.isArray(inventory) || inventory.length === 0) return null;

  const rawName = item.item_name || item.name || '';
  const cleanName = rawName.trim().toLowerCase();
  const rawUnit = item.unit || item.uom || '';
  const cleanUnit = rawUnit.trim().toLowerCase();
  const itemId = item.item_id || item.id;
  const donor = (item.donor_name || '').trim().toLowerCase();

  // 1. Exact ID + Name + Unit match (Strongest match)
  if (itemId) {
    const exact = inventory.find(
      (inv) =>
        inv.id === Number(itemId) &&
        inv.name.trim().toLowerCase() === cleanName &&
        (!cleanUnit || inv.unit.trim().toLowerCase() === cleanUnit)
    );
    if (exact) return exact;
  }

  // 2. Name + Unit + Donor match (If donor is explicitly tracked on the package item)
  if (cleanName && cleanUnit && donor) {
    const donorMatch = inventory.find(
      (inv) =>
        inv.name.trim().toLowerCase() === cleanName &&
        inv.unit.trim().toLowerCase() === cleanUnit &&
        (inv.donor_name || '').trim().toLowerCase() === donor
    );
    if (donorMatch) return donorMatch;
  }

  // 3. Name + Unit match (Strict unit matching to avoid mapping 'kg' to 'sacks')
  if (cleanName && cleanUnit) {
    const unitMatches = inventory.filter(
      (inv) =>
        inv.name.trim().toLowerCase() === cleanName &&
        inv.unit.trim().toLowerCase() === cleanUnit
    );

    if (unitMatches.length > 0) {
      // Prioritize repacked stock (is_repacked: true) with stock > 0
      const repackedWithStock = unitMatches.find((inv) => inv.is_repacked && inv.quantity > 0);
      if (repackedWithStock) return repackedWithStock;

      // Prioritize any item with stock > 0
      const anyWithStock = unitMatches.find((inv) => inv.quantity > 0);
      if (anyWithStock) return anyWithStock;

      // Fallback to first unit match
      return unitMatches[0];
    }
  }

  // 4. Exact ID match ONLY IF the item name also matches (guards against obsolete hardcoded seed IDs)
  if (itemId) {
    const idNameMatch = inventory.find(
      (inv) =>
        inv.id === Number(itemId) &&
        inv.name.trim().toLowerCase() === cleanName &&
        // If cleanUnit is specified and is non-bulk, do not bind to a bulk unit
        (!cleanUnit || !isBulkPackaging(inv.unit) || isBulkPackaging(cleanUnit))
    );
    if (idNameMatch) return idNameMatch;
  }

  // 5. If no unit was specified at all, match by name (prefer non-bulk distribution units)
  if (cleanName && !cleanUnit) {
    const nonBulkMatches = inventory.filter(
      (inv) =>
        inv.name.trim().toLowerCase() === cleanName &&
        !isBulkPackaging(inv.unit)
    );
    if (nonBulkMatches.length > 0) {
      const repacked = nonBulkMatches.find((inv) => inv.is_repacked && inv.quantity > 0);
      if (repacked) return repacked;
      return nonBulkMatches[0];
    }

    return inventory.find((inv) => inv.name.trim().toLowerCase() === cleanName) || null;
  }

  return null;
}
