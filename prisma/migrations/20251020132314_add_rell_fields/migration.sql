-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_polls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "image_url" TEXT,
    "type" TEXT NOT NULL DEFAULT 'poll',
    "status" TEXT NOT NULL DEFAULT 'active',
    "is_rell" BOOLEAN NOT NULL DEFAULT false,
    "original_poll_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "closed_at" DATETIME,
    CONSTRAINT "polls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "polls_original_poll_id_fkey" FOREIGN KEY ("original_poll_id") REFERENCES "polls" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_polls" ("category", "closed_at", "created_at", "description", "id", "image_url", "status", "title", "type", "updated_at", "user_id") SELECT "category", "closed_at", "created_at", "description", "id", "image_url", "status", "title", "type", "updated_at", "user_id" FROM "polls";
DROP TABLE "polls";
ALTER TABLE "new_polls" RENAME TO "polls";
CREATE INDEX "polls_user_id_idx" ON "polls"("user_id");
CREATE INDEX "polls_category_idx" ON "polls"("category");
CREATE INDEX "polls_status_idx" ON "polls"("status");
CREATE INDEX "polls_type_idx" ON "polls"("type");
CREATE INDEX "polls_is_rell_idx" ON "polls"("is_rell");
CREATE INDEX "polls_original_poll_id_idx" ON "polls"("original_poll_id");
CREATE INDEX "polls_created_at_idx" ON "polls"("created_at");
CREATE INDEX "polls_status_created_at_idx" ON "polls"("status", "created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
