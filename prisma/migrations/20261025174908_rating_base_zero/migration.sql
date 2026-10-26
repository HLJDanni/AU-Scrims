-- AlterTable
ALTER TABLE "Scrim" ADD COLUMN     "opponentRatingDelta" INTEGER;

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "rating" SET DEFAULT 0;


-- Todos los equipos pasan a contar desde 0 (antes la base era 6000); nadie queda en negativo
UPDATE "Team" SET "rating" = GREATEST(0, "rating" - 6000);

-- Resultados anteriores: el rival perdió o ganó exactamente lo contrario
UPDATE "Scrim" SET "opponentRatingDelta" = -"ratingDelta" WHERE "ratingDelta" IS NOT NULL;
