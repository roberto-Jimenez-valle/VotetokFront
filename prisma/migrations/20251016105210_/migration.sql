/*
  Warnings:

  - You are about to drop the `countries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `country_id` on the `subdivisions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "countries_latitude_longitude_idx";

-- DropIndex
DROP INDEX "countries_iso3_idx";

-- DropIndex
DROP INDEX "countries_iso3_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "countries";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_subdivisions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_subdivisions" ("country_code", "created_at", "hasc", "id", "iso", "latitude", "level", "level1_id", "level2_id", "level3_id", "longitude", "name", "name_local", "name_variant", "subdivision_id", "type_english") SELECT "country_code", "created_at", "hasc", "id", "iso", "latitude", "level", "level1_id", "level2_id", "level3_id", "longitude", "name", "name_local", "name_variant", "subdivision_id", "type_english" FROM "subdivisions";
DROP TABLE "subdivisions";
ALTER TABLE "new_subdivisions" RENAME TO "subdivisions";
CREATE UNIQUE INDEX "subdivisions_subdivision_id_key" ON "subdivisions"("subdivision_id");
CREATE INDEX "subdivisions_level_idx" ON "subdivisions"("level");
CREATE INDEX "subdivisions_subdivision_id_idx" ON "subdivisions"("subdivision_id");
CREATE INDEX "subdivisions_latitude_longitude_idx" ON "subdivisions"("latitude", "longitude");
CREATE INDEX "subdivisions_level_latitude_longitude_idx" ON "subdivisions"("level", "latitude", "longitude");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
