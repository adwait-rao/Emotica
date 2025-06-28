// middleware/auth.js
import { jwtVerify } from "jose";
import dotenv from "dotenv";
dotenv.config();

const JWKS_URL = `${process.env.SUPABASE_URL}/auth/v1/keys`;

let jwk = null;

export async function authenticate(req, res, next) {
  // TEMPORARY bypass for dev
  req.userId = "33eae832-0622-4d76-9457-1396a6c1e08d";
  next();
}
