/**
 * USDA generic foods (SR Legacy, Foundation, Survey) came in per-100g only,
 * so there was no "1 large" to pick for a fried egg. SR Legacy and
 * Foundation search hits have no portions (the /food/{fdcId} detail has
 * them as foodPortions); Survey hits carry them as foodMeasures.
 * usdaPortionsToAltUnits maps either shape to alt_units rows.
 * Fixtures are real rows from FoodData Central.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usdaPortionsToAltUnits, scaleFactor } from '../src/lib/units.js';

// SR Legacy 173423 "Egg, whole, cooked, fried"
const SR_EGG = [
  { amount: 1.0, modifier: 'large', portionDescription: null, gramWeight: 46.0, measureUnit: { name: 'undetermined' } },
];
// Foundation 790577 "Onions, red, raw"
const FOUNDATION_ONION = [
  { amount: 1.0, modifier: 'Edible', portionDescription: null, gramWeight: 197.0, measureUnit: { name: 'Onion' } },
  { amount: 1.0, modifier: null, portionDescription: null, gramWeight: 85.0, measureUnit: { name: 'RACC' } },
];
// Survey (FNDDS) 2707159 "Egg, whole, fried with butter": modifier is a code
const FNDDS_EGG = [
  { amount: null, modifier: '60710', portionDescription: '1 egg', gramWeight: 55, measureUnit: { name: 'undetermined' } },
  { amount: null, modifier: '10205', portionDescription: '1 cup', gramWeight: 135, measureUnit: { name: 'undetermined' } },
  { amount: null, modifier: '90000', portionDescription: 'Quantity not specified', gramWeight: 55, measureUnit: { name: 'undetermined' } },
];

// The same Survey food as a foods/search hit: foodMeasures, not foodPortions
const FNDDS_EGG_SEARCH_HIT = [
  { disseminationText: '1 egg', gramWeight: 55, id: 297285, modifier: '60710', rank: 1, measureUnitAbbreviation: 'undetermined', measureUnitName: 'undetermined', measureUnitId: 9999 },
  { disseminationText: '1 cup', gramWeight: 135, id: 297286, modifier: '10205', rank: 2, measureUnitAbbreviation: 'undetermined', measureUnitName: 'undetermined', measureUnitId: 9999 },
  { disseminationText: 'Quantity not specified', gramWeight: 55, id: 297287, modifier: '90000', rank: 3, measureUnitAbbreviation: 'undetermined', measureUnitName: 'undetermined', measureUnitId: 9999 },
];

test('SR Legacy: the modifier is the unit ("1 large" fried egg = 46 g)', () => {
  assert.deepEqual(usdaPortionsToAltUnits(SR_EGG), [{ abbr: 'large', grams: 46 }]);
});

test('Foundation: measureUnit names the unit; the RACC row is dropped', () => {
  assert.deepEqual(usdaPortionsToAltUnits(FOUNDATION_ONION), [{ abbr: 'onion, edible', grams: 197 }]);
});

test('Survey (FNDDS): label from portionDescription, numeric modifier ignored, "serving" dropped when it weighs the same as "egg"', () => {
  assert.deepEqual(usdaPortionsToAltUnits(FNDDS_EGG), [
    { abbr: 'egg', grams: 55 },
    { abbr: 'cup', grams: 135 },
  ]);
});

test('"Quantity not specified" becomes "serving" when its weight is its own', () => {
  // Survey 2708961 'Sushi roll, California' (search hit): serving = 6 pieces
  const sushi = [
    { disseminationText: '1 cup', gramWeight: 150, modifier: '10205', measureUnitName: 'undetermined' },
    { disseminationText: 'Quantity not specified', gramWeight: 180, modifier: '90000', measureUnitName: 'undetermined' },
    { disseminationText: '1 piece', gramWeight: 30, modifier: '61667', measureUnitName: 'undetermined' },
  ];
  assert.deepEqual(usdaPortionsToAltUnits(sushi), [
    { abbr: 'cup', grams: 150 },
    { abbr: 'serving', grams: 180 },
    { abbr: 'piece', grams: 30 },
  ]);
});

test('Survey search hits (foodMeasures) map the same as the detail (foodPortions)', () => {
  assert.deepEqual(usdaPortionsToAltUnits(FNDDS_EGG_SEARCH_HIT), usdaPortionsToAltUnits(FNDDS_EGG));
});

test('a Survey row whose text starts with a fraction gives grams per one unit', () => {
  const rows = [
    { portionDescription: '1/2 cup', gramWeight: 120, modifier: '10201', measureUnit: { name: 'undetermined' } },
    { disseminationText: '2 slices', gramWeight: 56, modifier: '50120', measureUnitName: 'undetermined' },
  ];
  assert.deepEqual(usdaPortionsToAltUnits(rows), [{ abbr: 'cup', grams: 240 }, { abbr: 'slices', grams: 28 }]);
});

test('grams are per one unit when amount is not 1', () => {
  const rows = [{ amount: 0.5, modifier: 'cup, chopped', gramWeight: 80, measureUnit: { name: 'undetermined' } }];
  assert.deepEqual(usdaPortionsToAltUnits(rows), [{ abbr: 'cup, chopped', grams: 160 }]);
});

test('duplicate labels keep the first row; bad rows are skipped', () => {
  const rows = [
    { amount: 1, modifier: 'large', gramWeight: 50, measureUnit: { name: 'undetermined' } },
    { amount: 1, modifier: 'Large', gramWeight: 46, measureUnit: { name: 'undetermined' } },
    { amount: 1, modifier: 'medium', gramWeight: 0 },
    null,
  ];
  assert.deepEqual(usdaPortionsToAltUnits(rows), [{ abbr: 'large', grams: 50 }]);
});

test("reference amounts and bare mass units are dropped; food-specific cups stay", () => {
  // Real rows: Survey 'Peanut butter' (search hit) and SR Legacy 'Crackers, milk'.
  const pb = [
    { disseminationText: 'Guideline amount per sandwich', gramWeight: 32, modifier: '90001', measureUnitName: 'undetermined' },
    { disseminationText: '1 tablespoon', gramWeight: 16, modifier: '10001', measureUnitName: 'undetermined' },
  ];
  const crackers = [
    { amount: 1, modifier: 'cracker', gramWeight: 11, measureUnit: { name: 'undetermined' } },
    { amount: 1, modifier: 'oz', gramWeight: 28.35, measureUnit: { name: 'undetermined' } },
  ];
  assert.deepEqual(usdaPortionsToAltUnits(pb), [{ abbr: 'tablespoon', grams: 16 }]);
  assert.deepEqual(usdaPortionsToAltUnits(crackers), [{ abbr: 'cracker', grams: 11 }]);
});

test('nothing usable gives null, like OFF altUnits', () => {
  assert.equal(usdaPortionsToAltUnits(undefined), null);
  assert.equal(usdaPortionsToAltUnits([]), null);
  assert.equal(usdaPortionsToAltUnits([FOUNDATION_ONION[1]]), null);
});

test('2 large fried eggs scale to 92 g of the per-100g food', () => {
  const egg = { nutrition_basis: 'g', alt_units: usdaPortionsToAltUnits(SR_EGG) };
  assert.ok(Math.abs(scaleFactor(100, 'g', 2, 'large', egg) - 0.92) < 1e-9);
});
