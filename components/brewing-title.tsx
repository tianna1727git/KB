// Single-line pencil strokes in writing order, on a common baseline.
const letters: Record<string, [number, string]> = {
  G: [19, 'M17 8C13 2 4 5 2 16S6 29 13 24Q16 22 17 15L10 16'],
  o: [12, 'M9 14C4 11 0 19 2 23S10 25 11 19Q12 14 8 14'],
  d: [13, 'M10 15C5 11 1 17 1 22S8 27 10 18L14 3Q11 17 10 25L13 23'],
  c: [11, 'M10 15C5 10 0 18 2 23Q4 28 11 22'],
  n: [14, 'M2 15L1 25Q7 12 11 14C15 16 8 27 15 23'],
  t: [10, 'M8 7Q1 22 5 25Q7 26 10 22M1 16L11 14'],
  e: [12, 'M2 20C13 20 13 12 7 14S0 23 4 25Q8 27 12 22'],
  s: [11, 'M10 14Q6 12 3 16Q1 18 6 20C14 24 4 28 1 24'],
  a: [13, 'M10 15C6 11 1 17 1 22S7 27 11 15Q7 27 13 23'],
  r: [10, 'M2 15L1 25Q6 11 10 15'],
  b: [14, 'M2 24Q3 12 9 3C12 0 8 11 3 18Q11 10 13 16T5 25L2 23'],
  w: [19, 'M2 14Q-1 33 8 19L10 15Q8 30 14 24Q19 18 18 14'],
  i: [6, 'M3 15Q-1 28 6 23M5 9l.5-.7'],
  g: [13, 'M11 15Q6 11 2 17C-2 26 6 29 11 16Q9 30 5 35C1 39 -3 34 3 31L13 25'],
  '…': [16, 'M2 24l.4-.6M8 24l.4-.6M14 24l.4-.6'],
  ' ': [7, '']
};

const title = 'Good contents are brewing…';
let width = 0;
const strokes = Array.from(title, (letter, index) => {
  const [advance, path] = letters[letter];
  const start = width;
  width += advance + 1;
  return path && <path key={index} transform={`translate(${start} 0)`} d={path} pathLength="1"
    style={{animationDelay: `${index * 85}ms`}}/>;
});

export function BrewingTitle() {
  return <h2 className="brewing-title"><span className="brewing-transcript">{title}</span>
    <svg aria-hidden="true" viewBox={`-2 0 ${width + 5} 40`} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{strokes}</svg>
  </h2>;
}
