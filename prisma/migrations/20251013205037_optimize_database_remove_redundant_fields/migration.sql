/*
  Warnings:

  - You are about to drop the column `avatar_url` on the `poll_options` table. All the data in the column will be lost.
  - You are about to drop the column `vote_count` on the `poll_options` table. All the data in the column will be lost.
  - You are about to drop the column `total_views` on the `polls` table. All the data in the column will be lost.
  - You are about to drop the column `total_votes` on the `polls` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[poll_id,user_id]` on the table `votes` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_poll_options" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "poll_id" INTEGER NOT NULL,
    "option_key" TEXT NOT NULL,
    "option_label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "poll_options_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "poll_options_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_poll_options" ("color", "created_at", "created_by_id", "display_order", "id", "option_key", "option_label", "poll_id") SELECT "color", "created_at", "created_by_id", "display_order", "id", "option_key", "option_label", "poll_id" FROM "poll_options";
DROP TABLE "poll_options";
ALTER TABLE "new_poll_options" RENAME TO "poll_options";
CREATE INDEX "poll_options_poll_id_idx" ON "poll_options"("poll_id");
CREATE INDEX "poll_options_created_by_id_idx" ON "poll_options"("created_by_id");
CREATE INDEX "poll_options_poll_id_display_order_idx" ON "poll_options"("poll_id", "display_order");
CREATE UNIQUE INDEX "poll_options_poll_id_option_key_key" ON "poll_options"("poll_id", "option_key");
CREATE TABLE "new_polls" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "image_url" TEXT,
    "type" TEXT NOT NULL DEFAULT 'poll',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "closed_at" DATETIME,
    CONSTRAINT "polls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_polls" ("category", "closed_at", "created_at", "description", "id", "image_url", "status", "title", "type", "updated_at", "user_id") SELECT "category", "closed_at", "created_at", "description", "id", "image_url", "status", "title", "type", "updated_at", "user_id" FROM "polls";
DROP TABLE "polls";
ALTER TABLE "new_polls" RENAME TO "polls";
CREATE INDEX "polls_user_id_idx" ON "polls"("user_id");
CREATE INDEX "polls_category_idx" ON "polls"("category");
CREATE INDEX "polls_status_idx" ON "polls"("status");
CREATE INDEX "polls_type_idx" ON "polls"("type");
CREATE INDEX "polls_created_at_idx" ON "polls"("created_at");
CREATE INDEX "polls_status_created_at_idx" ON "polls"("status", "created_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_country_iso3_idx" ON "users"("country_iso3");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "votes_option_id_idx" ON "votes"("option_id");

-- CreateIndex
CREATE INDEX "votes_user_id_idx" ON "votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "votes_poll_id_user_id_key" ON "votes"("poll_id", "user_id");
