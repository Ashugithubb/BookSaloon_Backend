-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "completionOtp" TEXT,
ADD COLUMN     "otpExpires" TIMESTAMP(3);
