/*
  Warnings:

  - A unique constraint covering the columns `[eventId]` on the table `checkins` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "checkins" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "checkins_eventId_key" ON "checkins"("eventId");
