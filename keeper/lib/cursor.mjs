// Tick cursor: rounds still unsettled plus rounds created since the last tick. Reads the old {from} format once.
export function tickIds(saved, count) {
  const ids = (saved.open ?? []).map(BigInt);
  for (let r = BigInt(saved.next ?? saved.from ?? 1); r <= count; r++) ids.push(r);
  return ids;
}
