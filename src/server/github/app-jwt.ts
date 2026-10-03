// GitHub App JWT minting (task 3.1). GitHub authenticates App-level calls
// (`GET /app/installations/{id}`, `POST /app/installations/{id}/access_tokens`)
// with a short-lived RS256 JWT: `iss` is the App id, `iat`/`exp` are Unix
// seconds, signed with the App's private key. See
// https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
//
// `clock` is injected (defaulting to the real system clock) specifically so
// tests can assert exact `iat`/`exp` values against a fake GitHub clock,
// per task 3.1's verification requirement, without depending on wall-clock
// time or freezing global timers.
import { sign as signWithPrivateKey } from "node:crypto";

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** GitHub rejects `iat` values in the future, so it is backdated by this
 * many seconds to tolerate clock drift between this process and GitHub's —
 * GitHub's own docs recommend 60 seconds. */
const CLOCK_DRIFT_TOLERANCE_SECONDS = 60;

/** GitHub caps App JWT lifetime at 10 minutes. */
const JWT_LIFETIME_SECONDS = 600;

export interface AppJwtParams {
  appId: string;
  privateKey: string;
  clock?: Clock;
}

function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buffer.toString("base64url");
}

/** Signs a GitHub App JWT (RS256) for `appId`/`privateKey` as of `clock`. */
export function mintAppJwt({ appId, privateKey, clock = systemClock }: AppJwtParams): string {
  const nowSeconds = Math.floor(clock.now().getTime() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: nowSeconds - CLOCK_DRIFT_TOLERANCE_SECONDS,
    exp: nowSeconds + JWT_LIFETIME_SECONDS,
    iss: appId,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = signWithPrivateKey("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}
