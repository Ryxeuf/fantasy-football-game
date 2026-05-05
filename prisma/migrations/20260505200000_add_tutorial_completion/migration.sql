-- S26 DoD — Telemetrie de progression du tutoriel onboarding.
-- Permet de mesurer le KPI "80% des nouveaux comptes finissent au moins une
-- lecon" (Definition of done sprint 26). Un row par (userId, lessonSlug).
-- Idempotence enforce cote service (upsert).

-- CreateTable
CREATE TABLE "public"."TutorialCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonSlug" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorialCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TutorialCompletion_userId_lessonSlug_key" ON "public"."TutorialCompletion"("userId", "lessonSlug");

-- CreateIndex
CREATE INDEX "TutorialCompletion_userId_idx" ON "public"."TutorialCompletion"("userId");

-- CreateIndex
CREATE INDEX "TutorialCompletion_lessonSlug_idx" ON "public"."TutorialCompletion"("lessonSlug");

-- AddForeignKey
ALTER TABLE "public"."TutorialCompletion" ADD CONSTRAINT "TutorialCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
