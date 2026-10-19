-- 코인·꾸미기 상점: 코인 잔액/장착 컬럼, 보유 아이템, 코인 원장
-- CreateEnum
CREATE TYPE "CoinReason" AS ENUM ('GAME', 'FIRST_GAME_BONUS', 'WELCOME', 'PURCHASE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "backgroundId" TEXT,
ADD COLUMN     "chatColorId" TEXT,
ADD COLUMN     "coins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "frameId" TEXT;

-- CreateTable
CREATE TABLE "UserItem" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserItem_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "CoinLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CoinReason" NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinLedger_userId_createdAt_idx" ON "CoinLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoinLedger_userId_reason_refId_key" ON "CoinLedger"("userId", "reason", "refId");

-- AddForeignKey
ALTER TABLE "UserItem" ADD CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinLedger" ADD CONSTRAINT "CoinLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 기존 유저 이전: 지금 쓰는 캐릭터를 보유로 지급하고 웰컴 코인 500을 원장과 함께 지급한다 (온보딩 전 유저 제외)
INSERT INTO "UserItem" ("userId", "itemId")
SELECT "id", "characterId" FROM "User" WHERE "characterId" <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "CoinLedger" ("id", "userId", "amount", "reason", "refId")
SELECT gen_random_uuid()::text, "id", 500, 'WELCOME', 'welcome' FROM "User" WHERE "characterId" <> ''
ON CONFLICT DO NOTHING;

UPDATE "User" SET "coins" = "coins" + 500 WHERE "characterId" <> '';
