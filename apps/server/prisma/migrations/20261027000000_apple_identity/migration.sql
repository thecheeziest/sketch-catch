CREATE TABLE "AppleIdentity" (
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppleIdentity_pkey" PRIMARY KEY ("providerId")
);

CREATE INDEX "AppleIdentity_userId_idx" ON "AppleIdentity"("userId");
ALTER TABLE "AppleIdentity" ADD CONSTRAINT "AppleIdentity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AppleIdentity" ("providerId", "userId", "createdAt")
    SELECT "providerId", "id", "createdAt" FROM "User" WHERE "provider" = 'APPLE';
