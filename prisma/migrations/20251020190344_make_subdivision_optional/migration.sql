-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_votes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "option_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "subdivision_id" INTEGER,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "votes_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "poll_options" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "votes_subdivision_id_fkey" FOREIGN KEY ("subdivision_id") REFERENCES "subdivisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_votes" ("created_at", "id", "ip_address", "latitude", "longitude", "option_id", "poll_id", "subdivision_id", "user_agent", "user_id") SELECT "created_at", "id", "ip_address", "latitude", "longitude", "option_id", "poll_id", "subdivision_id", "user_agent", "user_id" FROM "votes";
DROP TABLE "votes";
ALTER TABLE "new_votes" RENAME TO "votes";
CREATE INDEX "votes_option_id_idx" ON "votes"("option_id");
CREATE INDEX "votes_user_id_idx" ON "votes"("user_id");
CREATE INDEX "votes_poll_id_idx" ON "votes"("poll_id");
CREATE INDEX "votes_poll_id_user_id_idx" ON "votes"("poll_id", "user_id");
CREATE INDEX "votes_poll_id_ip_address_idx" ON "votes"("poll_id", "ip_address");
CREATE INDEX "votes_subdivision_id_idx" ON "votes"("subdivision_id");
CREATE INDEX "votes_latitude_longitude_idx" ON "votes"("latitude", "longitude");
CREATE INDEX "votes_created_at_idx" ON "votes"("created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
