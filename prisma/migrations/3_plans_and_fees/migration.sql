-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "checkout_plan" TEXT NOT NULL DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "checkout_plan" TEXT,
ADD COLUMN     "fee_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "orders_merchant_id_order_status_created_at_idx" ON "orders"("merchant_id", "order_status", "created_at");

