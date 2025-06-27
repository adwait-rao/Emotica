// middleware/auth.js
import { jwtVerify } from "jose";
import dotenv from "dotenv";
dotenv.config();

const JWKS_URL = `${process.env.SUPABASE_URL}/auth/v1/keys`;

let jwk = null;

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid auth token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    if (!jwk) {
      const res = await fetch(JWKS_URL);
      const { keys } = await res.json();
      jwk = keys[0]; // Cache it
    }

    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      true,
      ["verify"]
    );

    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: [jwk.alg],
    });

    req.userId = payload.sub; // Supabase UID
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
