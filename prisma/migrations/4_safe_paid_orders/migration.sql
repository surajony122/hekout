-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "fulfillment_data" JSONB,
ADD COLUMN     "order_status_url" TEXT,
ADD COLUMN     "razorpay_order_id" TEXT;

-- CreateIndex
CREATE INDEX "orders_merchant_id_razorpay_order_id_idx" ON "orders"("merchant_id", "razorpay_order_id");

