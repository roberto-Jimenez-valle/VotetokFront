-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_poll_options" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "option_key" TEXT NOT NULL,
    "option_label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "avatar_url" TEXT,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "poll_options_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_poll_options" ("avatar_url", "color", "created_at", "display_order", "id", "option_key", "option_label", "poll_id", "vote_count") SELECT "avatar_url", "color", "created_at", "display_order", "id", "option_key", "option_label", "poll_id", "vote_count" FROM "poll_options";
DROP TABLE "poll_options";
ALTER TABLE "new_poll_options" RENAME TO "poll_options";
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");
CREATE INDEX "poll_options_created_by_id_idx" ON "poll_options"("created_by_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
