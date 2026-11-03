// The rules a search tries on a grid of at most `most` neighbours (9 at most: a digit a count): every B (2, 3 or 4 and up
// to 2 more digits) / S (up to 4 digits) / C (2…5) (see search.js, grow.js)
const subsets = (arr, max) => { const out = [[]]; for (const x of arr) { const n = out.length; for (let i = 0; i < n; i++) if (out[i].length < max) out.push([...out[i], x]); } return out; };
export function searchRules(most) {
  const digits = [...Array(Math.min(9, most) + 1).keys()], Bs = new Set(), rules = [];
  for (const lo of [2, 3, 4]) for (const rest of subsets(digits.filter((d) => d > lo), 2)) Bs.add([lo, ...rest].join(''));
  for (const b of Bs) for (const s of subsets(digits, 4)) for (const c of [2, 3, 4, 5]) rules.push(`B${b}/S${s.join('')}${c > 2 ? '/C' + c : ''}`);
  return rules;
}
