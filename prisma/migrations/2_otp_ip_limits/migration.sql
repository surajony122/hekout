-- AlterTable
ALTER TABLE "otp_verifications" ADD COLUMN     "ip_address" TEXT;

-- CreateIndex
CREATE INDEX "otp_verifications_ip_address_created_at_idx" ON "otp_verifications"("ip_address", "created_at");

