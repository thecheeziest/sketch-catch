-- GameReplay를 시트 공유 구조(06-01)로 맞춘다. 스키마만 바뀌고 마이그레이션이 빠져 있어 GIF 저장이 실패했다.
-- 리플레이는 30분 뒤 만료되는 임시 데이터라 옛 구조의 행은 비우고 전환한다.
DELETE FROM "GameReplay";

-- DropForeignKey
ALTER TABLE "GameReplay" DROP CONSTRAINT "GameReplay_userId_fkey";

-- DropIndex
DROP INDEX "GameReplay_userId_idx";

-- AlterTable
ALTER TABLE "GameReplay" DROP COLUMN "prompt",
DROP COLUMN "strokes",
DROP COLUMN "userId",
ADD COLUMN     "ownerId" TEXT NOT NULL,
ADD COLUMN     "participantIds" TEXT[],
ADD COLUMN     "roomCode" TEXT NOT NULL,
ADD COLUMN     "sheetId" TEXT NOT NULL,
ADD COLUMN     "steps" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "GameReplay_sheetId_idx" ON "GameReplay"("sheetId");
