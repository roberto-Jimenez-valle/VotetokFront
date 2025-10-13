-- AlterTable
ALTER TABLE "users" ADD COLUMN "country_iso3" TEXT;
ALTER TABLE "users" ADD COLUMN "subdivision_id" TEXT;

-- CreateTable
CREATE TABLE "user_interests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 1.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_hashtag_follows" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "hashtag_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_hashtag_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_hashtag_follows_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_interests_user_id_idx" ON "user_interests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_interests_user_id_category_key" ON "user_interests"("user_id", "category");

-- CreateIndex
CREATE INDEX "user_hashtag_follows_user_id_idx" ON "user_hashtag_follows"("user_id");

-- CreateIndex
CREATE INDEX "user_hashtag_follows_hashtag_id_idx" ON "user_hashtag_follows"("hashtag_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_hashtag_follows_user_id_hashtag_id_key" ON "user_hashtag_follows"("user_id", "hashtag_id");
