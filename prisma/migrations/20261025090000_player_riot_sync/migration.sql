-- Datos del jugador sincronizados desde la API oficial de Riot
ALTER TABLE "Player" ADD COLUMN     "losses" INTEGER,
ADD COLUMN     "puuid" TEXT,
ADD COLUMN     "rankUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "summonerLevel" INTEGER,
ADD COLUMN     "wins" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Player_puuid_key" ON "Player"("puuid");
