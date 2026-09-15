/** Hand-written types for the subset of `fuzzaldrin-plus` this package uses. */
declare module 'fuzzaldrin-plus' {
  interface FilterOptions<T> {
    key?: keyof T & string;
    maxResults?: number;
    usePathScoring?: boolean;
    maxInners?: number;
  }

  export function filter<T>(
    candidates: T[],
    query: string,
    options?: FilterOptions<T>
  ): T[];

  export function score(candidate: string, query: string): number;
  export function match(candidate: string, query: string): number[];
}
