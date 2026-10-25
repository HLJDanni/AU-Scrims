-- El link de op.gg pasa a ser obligatorio. Se agrega como opcional, se rellena para los
-- jugadores existentes a partir de su Riot ID y la región del equipo, y luego se exige.
ALTER TABLE "Player" ADD COLUMN "opggUrl" TEXT;

UPDATE "Player" p
SET "opggUrl" = 'https://op.gg/lol/summoners/' || lower(t."region") || '/' || replace(p."gameName", ' ', '%20') || '-' || p."tagLine"
FROM "Team" t
WHERE t."id" = p."teamId";

ALTER TABLE "Player" ALTER COLUMN "opggUrl" SET NOT NULL;
