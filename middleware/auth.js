import jwt from "jsonwebtoken";
import Role from "../models/roleModel.js";
import User from "../models/UserManagementModel.js";

/**
 * Middleware to verify JWT token
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "User not authenticated" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id name email role status");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (String(user.status || "").toLowerCase() !== "active") {
      return res.status(403).json({ message: `Your account is ${user.status}. Please contact admin.` });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: String(user.role || "").toUpperCase(),
      status: user.status,
    };
    req.role = req.user.role;

    next();
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    console.error("JWT Error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.role) return res.status(401).json({ message: "User not authenticated" });
  if (req.role.toLowerCase() !== "admin") return res.status(403).json({ message: "Access denied. Admins only." });
  next();
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.role) return res.status(401).json({ message: "User not authenticated" });
  if (!roles.map(r => r.toLowerCase()).includes(req.role.toLowerCase())) {
    return res.status(403).json({ message: "Access denied. Insufficient permissions." });
  }
  next();
};

const authorizePermissions = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.role) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!requiredPermissions.length) return next();
      if (req.role.toUpperCase() === "ADMIN") {
        req.permissions = ["*"];
        return next();
      }

      const roleDoc = await Role.findOne({
        role: req.role.toUpperCase(),
        status: "ACTIVE",
      }).lean();

      if (!roleDoc) {
        return res.status(403).json({ message: "Role is not active or not found." });
      }

      const permissions = Array.isArray(roleDoc.permissions) ? roleDoc.permissions : [];
      const hasRequired = requiredPermissions.some((perm) => permissions.includes(perm));

      if (!hasRequired) {
        return res.status(403).json({
          message: `Access denied. Missing permission: ${requiredPermissions.join(" or ")}`,
        });
      }

      req.permissions = permissions;
      return next();
    } catch (error) {
      console.error("Permission middleware error:", error.message);
      return res.status(500).json({ message: "Permission validation failed" });
    }
  };
};

export default verifyToken;
export { verifyAdmin, authorizeRoles, authorizePermissions };
