-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "staffId" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "image" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
