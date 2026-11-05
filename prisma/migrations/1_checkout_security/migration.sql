-- AlterTable
ALTER TABLE "otp_verifications" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "orders_merchant_id_payment_id_key" ON "orders"("merchant_id", "payment_id");

-- CreateIndex
CREATE INDEX "otp_verifications_merchant_id_phone_created_at_idx" ON "otp_verifications"("merchant_id", "phone", "created_at");

