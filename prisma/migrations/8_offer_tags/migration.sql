-- AlterTable
ALTER TABLE "discounts" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
