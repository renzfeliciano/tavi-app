/**
 * The `<option>`s of a unit picker: the market's units (`market.units.options`).
 * A unit saved before the list existed still shows, marked, so nothing changes
 * silently; saving then asks for a listed one.
 */
export function UnitOptions({ units, current }: { units: readonly string[]; current: string }) {
  const value = current.trim();
  return (
    <>
      {value === "" && <option value="">Choose a unit</option>}
      {value !== "" && !units.includes(value) && <option value={current}>{current} (not in the list)</option>}
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </>
  );
}
