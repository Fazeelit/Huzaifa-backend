const ROLE_KEYS = ["ADMIN", "CLERK", "PRINCIPAL", "TEACHERS", "STUDENTS"];

const USER_STATUSES = ["Active", "Inactive", "Suspended"];

const SCHOOL_PERMISSION_KEYS = [
  "DASHBOARD_VIEW",
  "CLASSES_VIEW",
  "TEACHERS_VIEW",
  "STUDENTS_VIEW",
  "RESULTS_VIEW",
  "FEES_VIEW",
  "ATTENDANCE_VIEW",
  "TIMETABLE_VIEW",
  "EXPENSES_VIEW",
  "ROLES_VIEW",
  "USERS_VIEW",
];

function normalizeRoleKey(role) {
  return String(role || "").trim().toUpperCase();
}

function normalizeUserStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "inactive") {
    return "Inactive";
  }

  if (normalized === "suspended") {
    return "Suspended";
  }

  return "Active";
}

function sanitizePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const allowedPermissions = new Set(SCHOOL_PERMISSION_KEYS);
  const normalized = permissions
    .map((permission) => String(permission || "").trim().toUpperCase())
    .filter((permission) => allowedPermissions.has(permission));

  return [...new Set(normalized)];
}

export {
  ROLE_KEYS,
  USER_STATUSES,
  SCHOOL_PERMISSION_KEYS,
  normalizeRoleKey,
  normalizeUserStatus,
  sanitizePermissions,
};
