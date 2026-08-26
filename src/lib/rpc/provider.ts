/**
 * ChainProvider — the seam between the UI and any data source — is now part
 * of the published engine (@flurry/forensics), so third parties write
 * providers against the same interface the app uses. Shim kept so the app's
 * provider implementations import it from the familiar path.
 */
export type { ChainProvider } from "@flurry/forensics";
