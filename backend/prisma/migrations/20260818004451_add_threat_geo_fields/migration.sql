-- AlterTable
ALTER TABLE "ThreatReport" ADD COLUMN     "abuseScore" INTEGER,
ADD COLUMN     "geoCity" TEXT,
ADD COLUMN     "geoCountry" TEXT,
ADD COLUMN     "geoLat" DOUBLE PRECISION,
ADD COLUMN     "geoLon" DOUBLE PRECISION,
ADD COLUMN     "resolvedIp" TEXT;

-- CreateIndex
CREATE INDEX "ThreatReport_resolvedIp_idx" ON "ThreatReport"("resolvedIp");
