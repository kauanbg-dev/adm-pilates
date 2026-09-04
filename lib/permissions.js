export const STAFF_ROLE = "staff";
export const OWNER_INSTRUCTOR_ID = "ins_bia";

export function isAdmin(user) {
  return user?.role === "admin";
}

export function isStaff(user) {
  return user?.role === STAFF_ROLE;
}

export function isOwnerInstructor(instructor) {
  if (!instructor) return false;
  const id = String(instructor.id || "");
  const name = String(instructor.name || "").trim().toLowerCase();
  const role = String(instructor.role || "").toLowerCase();
  return id === OWNER_INSTRUCTOR_ID || name === "bia" || role.includes("dona");
}

export function isOwnInstructor(instructor, user) {
  if (!instructor || !user) return false;
  if (String(instructor.id || "") === "ins_alex") return true;
  return String(instructor.name || "").trim().toLowerCase() === String(user.name || "").trim().toLowerCase();
}

export function studioForClient(studio, user) {
  if (isAdmin(user)) return studio;
  return { ...studio, transactions: [] };
}

export function mergeStudioWrite(incoming, current, user) {
  if (isAdmin(user) || !incoming || typeof incoming !== "object") return incoming;
  const next = { ...incoming, transactions: current.transactions || [] };
  const previous = Array.isArray(current.instructors) ? current.instructors : [];
  const proposed = Array.isArray(incoming.instructors) ? incoming.instructors : [];
  next.instructors = previous.map((prev) => {
    if (isOwnerInstructor(prev)) return { ...prev };
    if (!isOwnInstructor(prev, user)) return { ...prev };
    const patch = proposed.find((item) => String(item.id) === String(prev.id));
    if (!patch) return { ...prev };
    return {
      ...prev,
      name: String(patch.name || prev.name).trim() || prev.name,
      role: String(patch.role || prev.role).trim() || prev.role,
      specialties: String(patch.specialties || prev.specialties).trim(),
    };
  });
  return next;
}
