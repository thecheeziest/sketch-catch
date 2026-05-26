declare module 'badwords-ko' {
  interface FilterOptions {
    emptyList?: boolean;
    list?: string[];
    exclude?: string[];
    placeHolder?: string;
    regex?: RegExp;
    replaceRegex?: RegExp;
    splitRegex?: RegExp;
  }

  class Filter {
    options: {
      list: string[];
      exclude: string[];
      placeHolder: string;
      regex: RegExp;
      replaceRegex: RegExp;
      splitRegex: RegExp;
    };
    constructor(options?: FilterOptions);
    isProfane(string: string): boolean;
    replaceWord(string: string): string;
    clean(string: string): string;
    addWords(...words: string[]): void;
    removeWords(...words: string[]): void;
  }

  export = Filter;
}
