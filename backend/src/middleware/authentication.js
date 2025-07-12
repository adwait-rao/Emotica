// middleware/auth.js
import { jwtVerify } from "jose";
import dotenv from "dotenv";

dotenv.config();

// Convert the JWT secret to the format jose expects
const JWT_SECRET = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

export async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        error: "No token provided",
      });
    }

    // Verify the JWT using HS256 algorithm
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: `${process.env.SUPABASE_URL}/auth/v1`, // Optional: validate issuer
    });

    // Add user information to request object
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
      // Add any other claims you need
    };

    console.log("Successfully authenticated user:", payload.sub);
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    // Handle specific error types
    if (error.code === "ERR_JWT_EXPIRED") {
      return res.status(401).json({
        error: "Token has expired",
      });
    }

    if (error.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
      return res.status(401).json({
        error: "Invalid token signature",
      });
    }

    if (error.message.includes("issuer")) {
      return res.status(401).json({
        error: "Token issuer mismatch",
      });
    }

    return res.status(401).json({
      error: "Invalid or malformed token",
    });
  }
}

// Optional: Middleware for specific roles
export function requireRole(allowedRoles) {
  return async (req, res, next) => {
    // First authenticate
    await authenticate(req, res, (err) => {
      if (err) return;

      const userRole = req.user?.role;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: "Insufficient permissions",
          required: allowedRoles,
          current: userRole,
        });
      }

      next();
    });
  };
}
