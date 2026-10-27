export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner'];

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === value ? date : null;
}

export function weekStart(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return monday;
}

export function weekDates(date = new Date()) {
  const monday = weekStart(date);
  return WEEK_DAYS.map((_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return day;
  });
}

// Assign the former undated rotation to this week once, retaining explicit dates.
export function migrateWeeklyMeals(meals, today = new Date()) {
  const result = { ...meals };
  weekDates(today).forEach((date, index) => MEAL_SLOTS.forEach(slot => {
    const oldKey = `${WEEK_DAYS[index]}-${slot}`;
    const key = `${dateKey(date)}-${slot}`;
    if (Object.hasOwn(result, oldKey)) {
      if (!Object.hasOwn(result, key)) result[key] = result[oldKey];
      delete result[oldKey];
    }
  }));
  return result;
}

export function futureMeals(meals, today = new Date()) {
  const cutoff = dateKey(today);
  return Object.entries(meals).filter(([key]) => {
    const date = key.slice(0, 10);
    return parseDate(date) && date > cutoff && key[10] === '-' && MEAL_SLOTS.includes(key.slice(11));
  }).map(([, selection]) => selection);
}
