/* Re-export seedrandom loaded by <script> tag in index.html */
export function seedrandom(seed) {
  return Math.seedrandom(seed);
}
