-- CreateEnum
CREATE TYPE "Role" AS ENUM ('COACH', 'ANALYST', 'CAPTAIN');

-- CreateEnum
CREATE TYPE "ScrimStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'LAN',
    "color" TEXT NOT NULL DEFAULT '#C8AA6E',
    "inviteCode" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scrim" (
    "id" TEXT NOT NULL,
    "requesterTeamId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "createdById" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "games" INTEGER NOT NULL DEFAULT 3,
    "status" "ScrimStatus" NOT NULL DEFAULT 'PENDING',
    "roomLink" TEXT,
    "notes" TEXT,
    "proposedStartAt" TIMESTAMP(3),
    "proposedEndAt" TIMESTAMP(3),
    "proposedGames" INTEGER,
    "proposedByTeamId" TEXT,
    "requesterScore" INTEGER,
    "opponentScore" INTEGER,
    "ratingDelta" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scrim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrimEvent" (
    "id" TEXT NOT NULL,
    "scrimId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_tag_key" ON "Team"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");

-- CreateIndex
CREATE INDEX "Scrim_requesterTeamId_startAt_idx" ON "Scrim"("requesterTeamId", "startAt");

-- CreateIndex
CREATE INDEX "Scrim_opponentTeamId_startAt_idx" ON "Scrim"("opponentTeamId", "startAt");

-- CreateIndex
CREATE INDEX "Scrim_status_idx" ON "Scrim"("status");

-- CreateIndex
CREATE INDEX "ScrimEvent_scrimId_createdAt_idx" ON "ScrimEvent"("scrimId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrim" ADD CONSTRAINT "Scrim_requesterTeamId_fkey" FOREIGN KEY ("requesterTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrim" ADD CONSTRAINT "Scrim_opponentTeamId_fkey" FOREIGN KEY ("opponentTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrim" ADD CONSTRAINT "Scrim_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrim" ADD CONSTRAINT "Scrim_proposedByTeamId_fkey" FOREIGN KEY ("proposedByTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimEvent" ADD CONSTRAINT "ScrimEvent_scrimId_fkey" FOREIGN KEY ("scrimId") REFERENCES "Scrim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrimEvent" ADD CONSTRAINT "ScrimEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
