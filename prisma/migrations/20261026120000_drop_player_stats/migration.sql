-- La sección Jugadores se retiró: ya no se guardan partidas (KDA) ni fotos del rango
-- DropForeignKey
ALTER TABLE "PlayerMatch" DROP CONSTRAINT "PlayerMatch_playerId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerSnapshot" DROP CONSTRAINT "PlayerSnapshot_playerId_fkey";

-- DropTable
DROP TABLE "PlayerMatch";

-- DropTable
DROP TABLE "PlayerSnapshot";

