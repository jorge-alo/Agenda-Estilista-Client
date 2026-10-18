import { isCanonicalPetToken } from "./petSessionStorage.ts";

export type MagicLinkFragment =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "token"; token: string };

export function parseMagicLinkFragment(fragment: string): MagicLinkFragment {
  if (!fragment) return { kind: "none" };
  if (!fragment.startsWith("#")) return { kind: "invalid" };
  const params = new URLSearchParams(fragment.slice(1));
  const tokens = params.getAll("token");
  if (params.size !== 1 || tokens.length !== 1 || !isCanonicalPetToken(tokens[0])) {
    return { kind: "invalid" };
  }
  return { kind: "token", token: tokens[0] };
}

export function removeMagicLinkFragment(): void {
  // Never log, persist, or preserve the fragment (or a query-token fallback).
  window.history.replaceState(window.history.state, "", window.location.pathname);
}
