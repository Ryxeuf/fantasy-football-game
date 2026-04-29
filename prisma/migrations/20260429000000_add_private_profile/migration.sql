-- S26.3i — RGPD : opt-in `private profile` pour cacher le profil public.

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN "privateProfile" BOOLEAN NOT NULL DEFAULT false;
