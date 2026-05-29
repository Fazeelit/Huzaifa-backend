const normalizeUnit = (unit) => String(unit || "").trim().toLowerCase();

const getUnitToBaseFactor = (unit, product = {}) => {
  const levels = Array.isArray(product?.uomLevels) ? product.uomLevels : [];
  const baseUnit = normalizeUnit(product?.baseUnit || product?.unit);
  const sourceUnit = normalizeUnit(unit || product?.unit || baseUnit);

  if (!sourceUnit || !baseUnit) {
    return 1;
  }

  if (sourceUnit === baseUnit) return 1;

  let factor = 1;
  let cursor = sourceUnit;
  const maxHops = levels.length + 2;

  for (let hop = 0; hop < maxHops; hop += 1) {
    const level = levels.find((entry) => normalizeUnit(entry?.unit) === cursor);
    if (!level) break;

    const contains = Number(level?.contains);
    if (!Number.isFinite(contains) || contains <= 0) break;

    factor *= contains;
    cursor = normalizeUnit(level?.child);
    if (cursor === baseUnit) return factor;
  }

  return 1;
};

const convertToBaseUnit = (qty, unit, product = {}) => {
  const quantity = Number(qty) || 0;
  return Number((quantity * getUnitToBaseFactor(unit, product)).toFixed(4));
};

const getStockToBaseFactor = (product = {}) =>
  getUnitToBaseFactor(product?.unit, product);

export { getUnitToBaseFactor, getStockToBaseFactor, convertToBaseUnit };
