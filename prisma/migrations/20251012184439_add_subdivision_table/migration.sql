-- CreateTable
CREATE TABLE "subdivisions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "country_iso3" TEXT NOT NULL,
    "country_name" TEXT NOT NULL,
    "subdivision_id" TEXT NOT NULL,
    "subdivision_name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "parent_id" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "subdivisions_subdivision_id_key" ON "subdivisions"("subdivision_id");

-- CreateIndex
CREATE INDEX "subdivisions_country_iso3_idx" ON "subdivisions"("country_iso3");

-- CreateIndex
CREATE INDEX "subdivisions_latitude_longitude_idx" ON "subdivisions"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "subdivisions_parent_id_idx" ON "subdivisions"("parent_id");
