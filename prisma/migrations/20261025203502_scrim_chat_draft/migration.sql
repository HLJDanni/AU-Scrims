-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('READY_CHECK', 'DRAFTING', 'DONE');

-- AlterTable
ALTER TABLE "Scrim" ADD COLUMN     "draftFearless" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "draftTimer" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ScrimMessage" (
    "id" TEXT NOT NULL,
    "scrimId" TEXT NOT NULL,
    "authorId" TEXT,
    "teamId" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrimMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRead" (
    "userId" TEXT NOT NULL,
    "scrimId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("userId","scrimId")
);

-- CreateTable
CREATE TABLE "DraftGame" (
    "id" TEXT NOT NULL,
    "scrimId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "blueTeamId" TEXT NOT NULL,
    "redTeamId" TEXT NOT NULL,
    "sideChosenBy" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'READY_CHECK',
    "blueReady" BOOLEAN NOT NULL DEFAULT false,
    "redReady" BOOLEAN NOT NULL DEFAULT false,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "step" INTEGER NOT NULL DEFAULT 0,
    "hover" TEXT,
    "turnEndsAt" TIMESTAMP(3),
    "winnerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrimMessage_scrimId_createdAt_idx" ON "ScrimMessage"("scrimId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftGame_scrimId_number_key" ON "DraftGame"("scrimId", "number");

-- AddForeignKey
ALTER TABLE "ScrimMessage" ADD CONSTRAINT "ScrimMessage_scrimId_fkey" FOREIGN KEY ("scrimId") REFERENCES "Scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimMessage" ADD CONSTRAINT "ScrimMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimMessage" ADD CONSTRAINT "ScrimMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_scrimId_fkey" FOREIGN KEY ("scrimId") REFERENCES "Scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGame" ADD CONSTRAINT "DraftGame_scrimId_fkey" FOREIGN KEY ("scrimId") REFERENCES "Scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

