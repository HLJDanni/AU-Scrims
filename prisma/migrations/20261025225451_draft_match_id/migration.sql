-- AlterTable
ALTER TABLE "DraftGame" ADD COLUMN     "matchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DraftGame_matchId_key" ON "DraftGame"("matchId");

