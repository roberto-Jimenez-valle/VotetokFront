/*
  Warnings:

  - You are about to drop the column `parent_id` on the `subdivisions` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `subdivisions` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_subdivisions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "country_id" INTEGER NOT NULL,
    "subdivision_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "level1_id" TEXT,
    "level2_id" TEXT,
    "level3_id" TEXT,
    "name" TEXT NOT NULL,
    "name_local" TEXT,
    "name_variant" TEXT,
    "type_english" TEXT,
    "hasc" TEXT,
    "iso" TEXT,
    "country_code" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subdivisions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subdivisions" ("country_code", "country_id", "created_at", "hasc", "id", "iso", "latitude", "level", "level1_id", "level2_id", "level3_id", "longitude", "name", "name_local", "name_variant", "subdivision_id", "type_english") SELECT "country_code", "country_id", "created_at", "hasc", "id", "iso", "latitude", "level", "level1_id", "level2_id", "level3_id", "longitude", "name", "name_local", "name_variant", "subdivision_id", "type_english" FROM "subdivisions";
DROP TABLE "subdivisions";
ALTER TABLE "new_subdivisions" RENAME TO "subdivisions";
CREATE UNIQUE INDEX "subdivisions_subdivision_id_key" ON "subdivisions"("subdivision_id");
CREATE INDEX "subdivisions_country_id_idx" ON "subdivisions"("country_id");
CREATE INDEX "subdivisions_level_idx" ON "subdivisions"("level");
CREATE INDEX "subdivisions_subdivision_id_idx" ON "subdivisions"("subdivision_id");
CREATE INDEX "subdivisions_latitude_longitude_idx" ON "subdivisions"("latitude", "longitude");
CREATE INDEX "subdivisions_level_latitude_longitude_idx" ON "subdivisions"("level", "latitude", "longitude");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
