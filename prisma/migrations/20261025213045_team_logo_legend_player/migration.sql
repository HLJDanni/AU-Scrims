-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "logo" BYTEA,
ADD COLUMN     "logoType" TEXT,
ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

