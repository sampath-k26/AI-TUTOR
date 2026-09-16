import { GeminiProvider } from "./geminiProvider";
import { GroqProvider } from "./groqProvider";

export * from "./base";

/**
 * Singletons — modules import these, never instantiate a provider or call an
 * SDK directly (see CLAUDE.md "Code organization rules"). Constructing these
 * does not require a valid API key; only calling a method does, so the app
 * still boots before real credentials exist (see CLAUDE.md "Environment variables").
 */
export const geminiProvider = new GeminiProvider();
export const groqProvider = new GroqProvider();
