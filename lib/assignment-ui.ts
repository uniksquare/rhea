// Plain helpers shared by server pages and client components (no "use client").
export const ROLE_OPTIONS = [
  { value: "web-developer", label: "Web Developer" },
  { value: "on-call-engineer", label: "On-call Engineer" },
];

export function roleLabel(roleKey: string) {
  return ROLE_OPTIONS.find((r) => r.value === roleKey)?.label ?? roleKey;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "n/a";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "n/a" : d.toLocaleString();
}
