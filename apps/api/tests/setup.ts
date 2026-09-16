// Runs before any test file is loaded (see vitest.config.ts setupFiles). Provides
// safe local-only fixture values — never real credentials — so the config loader
// doesn't throw on import when apps/api/.env hasn't been created yet (see
// CLAUDE.md "Environment variables / secrets": real .env is filled in after
// implementation, right before the live testing phase).
process.env.NODE_ENV ??= "test";
process.env.SUPABASE_JWT_SECRET ??= "test-only-local-fixture-secret";
