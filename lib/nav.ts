// One nav structure shared by the header, mobile menu, and footer.
// Add or reorder pages here, not in the components.

export type NavLink = { label: string; href: string };

// The three program tracks — the heart of TFM.
export const programs: NavLink[] = [
  { label: "Biblical Studies", href: "/biblical-studies" },
  { label: "Practical Skills", href: "/practical-skills" },
  { label: "Ministry Participation", href: "/ministry-participation" },
];

// Shown to signed-in students. One course runs at a time, and the
// dashboard IS that course — so no catalog link.
export const studentLinks: NavLink[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Report Card", href: "/grades" },
];

export const footerLinks: NavLink[] = [
  { label: "Log In", href: "/login" },
  { label: "Register", href: "/register" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];
