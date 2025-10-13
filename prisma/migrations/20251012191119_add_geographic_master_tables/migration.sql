/*
  Warnings:

  - You are about to drop the column `country_iso3` on the `subdivisions` table. All the data in the column will be lost.
  - You are about to drop the column `country_name` on the `subdivisions` table. All the data in the column will be lost.
  - You are about to drop the column `subdivision_name` on the `subdivisions` table. All the data in the column will be lost.
  - You are about to alter the column `parent_id` on the `subdivisions` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `country_id` to the `subdivisions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `subdivisions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "countries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "iso3" TEXT NOT NULL,
    "iso2" TEXT,
    "name" TEXT NOT NULL,
    "name_local" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "has_level1" BOOLEAN NOT NULL DEFAULT false,
    "has_level2" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_subdivisions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "country_id" INTEGER NOT NULL,
    "subdivision_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "level1_id" TEXT,
    "level2_id" TEXT,
    "level3_id" TEXT,
    "name" TEXT NOT NULL,
    "name_local" TEXT,
    "name_variant" TEXT,
    "name_english" TEXT,
    "type" TEXT,
    "type_local" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subdivisions_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subdivisions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "subdivisions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subdivisions" ("id", "latitude", "level", "longitude", "parent_id", "subdivision_id") SELECT "id", "latitude", "level", "longitude", "parent_id", "subdivision_id" FROM "subdivisions";
DROP TABLE "subdivisions";
ALTER TABLE "new_subdivisions" RENAME TO "subdivisions";
CREATE UNIQUE INDEX "subdivisions_subdivision_id_key" ON "subdivisions"("subdivision_id");
CREATE INDEX "subdivisions_country_id_idx" ON "subdivisions"("country_id");
CREATE INDEX "subdivisions_level_idx" ON "subdivisions"("level");
CREATE INDEX "subdivisions_parent_id_idx" ON "subdivisions"("parent_id");
CREATE INDEX "subdivisions_subdivision_id_idx" ON "subdivisions"("subdivision_id");
CREATE INDEX "subdivisions_latitude_longitude_idx" ON "subdivisions"("latitude", "longitude");
CREATE INDEX "subdivisions_level_latitude_longitude_idx" ON "subdivisions"("level", "latitude", "longitude");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE INDEX "countries_iso3_idx" ON "countries"("iso3");

-- CreateIndex
CREATE INDEX "countries_latitude_longitude_idx" ON "countries"("latitude", "longitude");
