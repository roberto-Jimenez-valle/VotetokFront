-- DropIndex
DROP INDEX "votes_poll_id_user_id_key";

-- CreateIndex
CREATE INDEX "votes_poll_id_user_id_idx" ON "votes"("poll_id", "user_id");

-- CreateIndex
CREATE INDEX "votes_poll_id_ip_address_idx" ON "votes"("poll_id", "ip_address");
