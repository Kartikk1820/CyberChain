import type { AccessAttempt, Campaign, ConfirmationType, ReportStatus, ThreatReport } from "./types";

export type WsEvent =
  | { type: "report:new"; payload: ThreatReport }
  | { type: "report:updated"; payload: { reportId: string; status: ReportStatus; score: number } }
  | { type: "confirmation:new"; payload: { reportId: string; confirmingOrgId: string; confirmationType: ConfirmationType } }
  | { type: "reputation:updated"; payload: { orgId: string; oldValue: number; newValue: number; delta: number; reason: string } }
  | { type: "campaign:new"; payload: Campaign }
  | { type: "campaign:updated"; payload: Campaign }
  | { type: "access_attempt:new"; payload: AccessAttempt }
  | { type: "ledger:block_added"; payload: { blockIdx: number; hash: string; ref: string } }
  | { type: "tamper:detected"; payload: { reportId?: string; blockIdx?: number; kind: "evidence" | "chain"; message: string } };
