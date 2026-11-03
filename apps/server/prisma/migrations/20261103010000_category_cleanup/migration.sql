-- 폐지한 속담(PROVERB)·사자성어(IDIOM)를 enum에서 영구 제거하고 예능(VARIETY)·만화(ANIMATION)를 추가한다.
-- Postgres는 enum 값을 바로 지울 수 없어 새 타입을 만들어 교체한다. 폐지 카테고리 단어는 먼저 삭제한다.
DELETE FROM "WordPool" WHERE "category" IN ('PROVERB', 'IDIOM');

ALTER TYPE "Category" RENAME TO "Category_old";
CREATE TYPE "Category" AS ENUM ('ANIMAL', 'FOOD', 'OBJECT', 'NATURE', 'PLACE', 'ACTION', 'JOB', 'PERSON', 'MOVIE', 'DRAMA', 'VARIETY', 'ANIMATION', 'MEME', 'CUSTOM');
ALTER TABLE "WordPool" ALTER COLUMN "category" TYPE "Category" USING ("category"::text::"Category");
DROP TYPE "Category_old";
