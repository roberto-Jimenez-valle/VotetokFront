-- AlterTable
ALTER TABLE "votes" ADD COLUMN "subdivision_id" TEXT;

-- CreateIndex
CREATE INDEX "votes_country_iso3_subdivision_id_idx" ON "votes"("country_iso3", "subdivision_id");
