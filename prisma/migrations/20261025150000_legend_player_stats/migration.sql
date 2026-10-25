-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'LEGEND';

-- CreateTable
CREATE TABLE "PlayerMatch" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSnapshot" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tier" "LolTier",
    "division" INTEGER,
    "lp" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerMatch_playerId_playedAt_idx" ON "PlayerMatch"("playerId", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatch_playerId_matchId_key" ON "PlayerMatch"("playerId", "matchId");

-- CreateIndex
CREATE INDEX "PlayerSnapshot_playerId_takenAt_idx" ON "PlayerSnapshot"("playerId", "takenAt");

-- AddForeignKey
ALTER TABLE "PlayerMatch" ADD CONSTRAINT "PlayerMatch_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSnapshot" ADD CONSTRAINT "PlayerSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

