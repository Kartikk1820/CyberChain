-- CreateTable
CREATE TABLE "ReportComment" (
    "id" TEXT NOT NULL,
    "threatReportId" TEXT NOT NULL,
    "authorOrgId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportComment_threatReportId_idx" ON "ReportComment"("threatReportId");

-- AddForeignKey
ALTER TABLE "ReportComment" ADD CONSTRAINT "ReportComment_threatReportId_fkey" FOREIGN KEY ("threatReportId") REFERENCES "ThreatReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportComment" ADD CONSTRAINT "ReportComment_authorOrgId_fkey" FOREIGN KEY ("authorOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
