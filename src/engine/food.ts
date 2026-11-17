import type { ActivityMetrics, Basket, FoodCategory, M12 } from '../types';
import type { Acc } from './context';
import { clamp01, distribute, map12, sum, zeros } from './util';

export const FOOD_CATEGORIES: FoodCategory[] = ['beef', 'lamb', 'pork', 'poultry', 'fish_seafood', 'eggs', 'dairy', 'cheese', 'plant_protein', 'cereals', 'bread_pastry', 'fruit', 'vegetables', 'oils', 'coffee', 'tea', 'chocolate', 'wine', 'beer', 'spirits', 'soft_drinks', 'bottled_water'];
const BEVERAGES: FoodCategory[] = ['wine', 'beer', 'spirits', 'soft_drinks', 'bottled_water'];

const addBasket = (target: Record<string, M12>, basket: Basket, covers: M12) => {
  for (const [cat, kg] of Object.entries(basket)) {
    if (!kg) continue;
    target[cat] = target[cat] ?? zeros();
    for (let m = 0; m < 12; m++) target[cat][m] += covers[m] * (kg as number);
  }
};

/**
 * Food & beverage. Purchased = served × (1 + overproduction) ÷ (1 − preparation loss) ÷ (1 − spoilage).
 * Waste = purchased − eaten − donated. Production emissions are counted ONCE on purchases;
 * food waste carries only its treatment emissions (no double counting).
 */
export function runFood(acc: Acc, act: ActivityMetrics) {
  const p = acc.p;
  const f = p.food;
  const cv = act.covers;
  if (!p.boundary.restaurantsIncluded) {
    acc.warn('info', 'food', 'Restaurants are outside the organisational boundary (e.g. third-party concession): food procurement is excluded from the inventory.');
    return { servedKg: 0, purchasedKg: 0, wasteKg: 0 };
  }
  const served: Record<string, M12> = {};
  addBasket(served, f.breakfastBasket, cv.breakfast);
  const veg = clamp01(f.vegetarianUptake);
  const mainCovers = map12((m) => cv.mainMeals[m] + cv.roomService[m] + cv.banquet[m] * f.banquetMealsPerAttendee);
  addBasket(served, f.mainStandardBasket, mainCovers.map((c) => c * (1 - veg)));
  addBasket(served, f.mainVegetarianBasket, mainCovers.map((c) => c * veg));
  addBasket(served, f.staffMealBasket, cv.staff);
  addBasket(served, f.barBasket, cv.bar);

  const gross = (1 + Math.max(0, f.overproductionShare)) / (1 - Math.min(0.9, clamp01(f.prepLossShare))) / (1 - Math.min(0.9, clamp01(f.spoilageShare)));
  const st = acc.status('food', 'modelled');
  const useMeasured = f.measuredPurchasesKg != null;
  let purchasedTotal = 0;
  let servedSolidTotal = 0;
  let purchasedSolidTotal = 0;
  const purchasedSolidMonthly = zeros();
  const servedSolidMonthly = zeros();
  for (const cat of FOOD_CATEGORIES) {
    const servedM = served[cat] ?? zeros();
    let purchased = servedM.map((x) => x * (BEVERAGES.includes(cat) ? 1 : gross));
    let status = st;
    if (useMeasured && f.measuredPurchasesKg![cat] != null) {
      purchased = distribute(f.measuredPurchasesKg![cat] as number, sum(servedM) > 0 ? servedM : act.openDays);
      status = acc.status(`food.measuredPurchasesKg.${cat}`, 'measured');
    }
    const total = sum(purchased);
    if (total <= 0) continue;
    purchasedTotal += total;
    if (!BEVERAGES.includes(cat)) {
      servedSolidTotal += sum(servedM);
      purchasedSolidTotal += total;
      for (let m = 0; m < 12; m++) { purchasedSolidMonthly[m] += purchased[m]; servedSolidMonthly[m] += servedM[m]; }
    }
    const fid = `food_${cat}`;
    acc.emit({ id: `food-${cat}`, activityId: `food-purchase-${cat}`, label: `Food & drink purchases — ${cat.replace('_', ' ')}`, module: 'food', department: 'Food & Beverage', scope: 'S3', s3cat: 1, views: ['corporate', 'lca', 'visitor'], activityUnit: BEVERAGES.includes(cat) ? 'L' : 'kg', factorId: fid, monthlyActivity: purchased, status, formula: useMeasured ? 'measured kg purchased × factor' : 'covers × basket kg/cover × gross-up for overproduction, prep loss & spoilage × factor', inputs: { kgPurchased: Math.round(total) } });
    const price = f.foodPricePerKg[cat] ?? 0;
    if (price > 0) acc.cost({ id: `food-cost-${cat}`, label: `Food & drink — ${cat.replace('_', ' ')}`, category: 'food', department: 'Food & Beverage', fixed: 0, variable: total * price, vatRate: BEVERAGES.includes(cat) && cat !== 'bottled_water' && cat !== 'soft_drinks' ? 0.2 : 0.055, monthly: purchased.map((x) => x * price), status });
    else acc.markMissing(`food.foodPricePerKg.${cat}`);
    // Transport only if factors exclude it
    if (!f.factorsIncludeTransport && f.transportTkmPerKg > 0) {
      acc.emit({ id: `food-transport-${cat}`, activityId: `food-transport-${cat}`, label: `Food transport — ${cat.replace('_', ' ')}`, module: 'food', department: 'Food & Beverage', scope: 'S3', s3cat: 4, views: ['corporate', 'lca', 'visitor'], activityUnit: 'tonne-km', factorId: 'road_truck_tkm', monthlyActivity: purchased.map((x) => x * f.transportTkmPerKg), status: 'assumed', formula: 'kg × t·km/kg × factor', inputs: { tkmPerKg: f.transportTkmPerKg } });
    }
  }
  if (f.factorsIncludeTransport) acc.suppressed.push({ activityId: 'food-transport', label: 'Food supplier transport', reason: 'Food factors are declared to include transport to retail — no separate transport line added.', kgAvoidedDoubleCount: 0 });

  // Waste: purchased − eaten − donated (solids only)
  const plate = clamp01(f.plateWasteShare);
  const overprodKg = servedSolidTotal * Math.max(0, f.overproductionShare);
  const donated = overprodKg * clamp01(f.donationShareOfOverproduction);
  const eaten = servedSolidTotal * (1 - plate);
  const wasteKg = Math.max(0, purchasedSolidTotal - eaten - donated);
  const wasteMonthly = distribute(wasteKg, purchasedSolidMonthly);
  acc.derivedWaste.foodWasteKg = wasteKg;
  acc.derivedWaste.foodWasteMonthly = wasteMonthly;

  // Kitchen equipment energy
  const covers = map12((m) => cv.breakfast[m] + mainCovers[m] + cv.staff[m]);
  const kst = acc.status('food.kitchen', 'assumed');
  const gasShare = clamp01(f.cookingGasShare);
  acc.addEnergy({ carrier: 'electricity', endUse: 'Cooking (electric)', department: 'Food & Beverage', monthly: covers.map((c) => c * f.cookingKWhPerCover * (1 - gasShare)), status: kst, module: 'food' });
  acc.addEnergy({ carrier: 'natural_gas', endUse: 'Cooking (gas)', department: 'Food & Beverage', monthly: covers.map((c) => c * f.cookingKWhPerCover * gasShare), status: kst, module: 'food' });
  acc.addEnergy({ carrier: 'electricity', endUse: 'Cold rooms & refrigeration', department: 'Food & Beverage', monthly: act.openDays.map((d) => d * f.refrigerationKWhPerDay), status: kst, module: 'food' });
  acc.addEnergy({ carrier: 'electricity', endUse: 'Kitchen extraction', department: 'Food & Beverage', monthly: act.openDays.map((d) => d * f.extractionKW * f.extractionHoursPerOpenDay), status: kst, module: 'food' });
  acc.addEnergy({ carrier: 'electricity', endUse: 'Dishwashers (boosters & pumps)', department: 'Food & Beverage', monthly: covers.map((c) => c * p.otherWater.racksPerCover * f.dishwasherKWhPerRack), status: kst, module: 'food' });
  acc.addEnergy({ carrier: 'electricity', endUse: 'Ice machines', department: 'Food & Beverage', monthly: act.openDays.map((d) => d * f.iceMachineKWhPerDay), status: kst, module: 'food' });
  return { servedKg: servedSolidTotal, purchasedKg: purchasedTotal, wasteKg };
}
