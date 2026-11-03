import type { Category } from '@sketch-catch/shared';

// 가나다순: 동물·드라마·만화·밈·사물·액션·영화·예능·음식·인물·자연·장소·직업
export const ALL_CATEGORIES: Category[] = [
  'ANIMAL',
  'DRAMA',
  'ANIMATION',
  'MEME',
  'OBJECT',
  'ACTION',
  'MOVIE',
  'VARIETY',
  'FOOD',
  'PERSON',
  'NATURE',
  'PLACE',
  'JOB',
];

export const CATEGORY_LABEL: Record<Category, string> = {
  ANIMAL: '동물',
  OBJECT: '사물',
  FOOD: '음식',
  NATURE: '자연',
  PLACE: '장소',
  JOB: '직업',
  ACTION: '액션',
  PERSON: '인물',
  MOVIE: '영화',
  DRAMA: '드라마',
  VARIETY: '예능',
  ANIMATION: '만화',
  MEME: '밈',
  CUSTOM: '커스텀',
};
