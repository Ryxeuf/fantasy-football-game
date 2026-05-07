-- S27.6 — Audit log admin (compliance + tracabilite des mutations).

CREATE TABLE "public"."AuditLog" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT,
    "action"    TEXT NOT NULL,
    "entity"    TEXT NOT NULL,
    "entityId"  TEXT,
    "oldValue"  JSONB,
    "newValue"  JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_createdAt_idx"
  ON "public"."AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx"
  ON "public"."AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_action_idx"
  ON "public"."AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx"
  ON "public"."AuditLog"("createdAt");
