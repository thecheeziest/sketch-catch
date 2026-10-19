-- 스키마에는 있지만 마이그레이션에 빠져 있던 커스텀 제시어 카테고리 값을 추가한다 (값 추가만, 기존 데이터 영향 없음)
-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'CUSTOM';
