-- DropIndex
DROP INDEX "User_nickname_key";

-- DropIndex
DROP INDEX "User_friendCode_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_friendCode_key" ON "User"("nickname", "friendCode");
