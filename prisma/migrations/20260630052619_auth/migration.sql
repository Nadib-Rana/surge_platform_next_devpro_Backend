/*
  Warnings:

  - You are about to drop the column `token` on the `verification_tokens` table. All the data in the column will be lost.
  - Added the required column `token_hash` to the `verification_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "verification_tokens_token_idx";

-- DropIndex
DROP INDEX "verification_tokens_token_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_changed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_tokens" DROP COLUMN "token",
ADD COLUMN     "token_hash" TEXT NOT NULL;
