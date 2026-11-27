/**
 * Passwords, the tokens Fountain issues, and the verification of access tokens from an
 * external login service. Specified in documents/user-model.md, sections 4 and 5.
 *
 * Nothing here knows of objects: these are functions of strings and bytes.
 */

import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac, createVerify, createPublicKey } from "node:crypto";

export class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/*------------------------------------------------------------------
 *  Passwords (user-model.md A1)
 *-----------------------------------------------------------------*/

/** The cost of scrypt: N, r and p. N is what a deployment raises as machines get faster. */
export const DEFAULT_SCRYPT = Object.freeze({ N: 1 << 15, r: 8, p: 1 });

const HASH_LENGTH = 64;

function scrypt(password, salt, parameters) {
  const { N, r, p } = parameters;
  return scryptSync(String(password).normalize("NFKC"), salt, HASH_LENGTH, { N, r, p, maxmem: 256 * N * r });
}

/** What is stored for a password: a salt, the cost it was hashed with, and the hash. Never the password. */
export function hashPassword(password, parameters = DEFAULT_SCRYPT) {
  if (typeof(password) !== "string" || password.length === 0) throw new AuthenticationError("A password is a string that is not empty.");
  const salt = randomBytes(16);
  const { N, r, p } = parameters;
  return Object.freeze({ salt: salt.toString("base64"), hash: scrypt(password, salt, parameters).toString("base64"), N, r, p });
}

/** Whether a password is the one that was hashed. Takes the same time whether it is or not. */
export function verifyPassword(password, stored) {
  if (typeof(password) !== "string") return false;
  const expected = Buffer.from(stored.hash, "base64");
  const actual = scrypt(password, Buffer.from(stored.salt, "base64"), stored);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/*------------------------------------------------------------------
 *  Session tokens (user-model.md A4)
 *-----------------------------------------------------------------*/

/** A new token, for the client to keep. It cannot be guessed. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** What the server stores of a token: enough to recognize it, not enough to use it. */
export function tokenHash(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

/*------------------------------------------------------------------
 *  Access tokens from an external login service (user-model.md A3)
 *-----------------------------------------------------------------*/

function decodePart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

const SIGNATURES = {
  HS256: (input, signature, key) => {
    const expected = createHmac("sha256", key).update(input).digest();
    return expected.length === signature.length && timingSafeEqual(expected, signature);
  },
  RS256: (input, signature, key) => createVerify("RSA-SHA256").update(input).verify(key, signature),
  ES256: (input, signature, key) => createVerify("SHA256").update(input).verify({ key: typeof(key) === "string" ? createPublicKey(key) : key, dsaEncoding: "ieee-p1363" }, signature),
};

/**
 * A verifier of JSON Web Tokens from one issuer, as OpenID Connect gives them:
 *
 *   jwtVerifier({ issuer: "https://login.example.com", audience: "my-app", keys: { kid1: publicKeyPem } })
 *
 * `keys` are the issuer's public keys by key id (or `key`, a single one; a shared secret for
 * HS256). Fetching and refreshing an issuer's keys is the application's: Fountain verifies
 * without waiting. Returns a function that takes a token and returns `{ subject, claims }`,
 * or throws an AuthenticationError saying why not.
 */
export function jwtVerifier({ issuer, audience, keys, key, algorithms = ["RS256", "ES256"], now = () => Date.now(), leeway = 60 }) {
  if (!issuer) throw new Error("jwtVerifier() needs the issuer whose tokens it verifies.");
  return function verify(token) {
    const refuse = (why) => { throw new AuthenticationError("The access token " + why + "."); };
    if (typeof(token) !== "string") refuse("is not a string");
    const parts = token.split(".");
    if (parts.length !== 3) refuse("is not a signed token");
    let header;
    let claims;
    try {
      header = decodePart(parts[0]);
      claims = decodePart(parts[1]);
    } catch (error) {
      refuse("cannot be read");
    }
    // The algorithm is the verifier's choice, never the token's: a token that names another is refused.
    if (!algorithms.includes(header.alg) || !SIGNATURES[header.alg]) refuse("is signed with an algorithm that is not accepted");
    const signingKey = keys ? keys[header.kid] : key;
    if (signingKey === undefined) refuse("is signed with a key that is not known");
    let valid = false;
    try {
      valid = SIGNATURES[header.alg](parts[0] + "." + parts[1], Buffer.from(parts[2], "base64url"), signingKey);
    } catch (error) {
      valid = false;
    }
    if (!valid) refuse("has a signature that is not valid");
    if (claims.iss !== issuer) refuse("is from another issuer");
    if (audience !== undefined) {
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!audiences.includes(audience)) refuse("is for another audience");
    }
    const seconds = now() / 1000;
    if (typeof(claims.exp) !== "number" || claims.exp + leeway < seconds) refuse("has expired");
    if (typeof(claims.nbf) === "number" && claims.nbf - leeway > seconds) refuse("is not valid yet");
    if (typeof(claims.sub) !== "string" || claims.sub === "") refuse("names no subject");
    return { subject: claims.sub, claims };
  };
}
