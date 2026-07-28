import { getCurrentUser } from "@/lib/auth/session";
import HeaderNav from "./HeaderNav";

// Server wrapper: reads the session so the nav can show Dashboard/Log out
// for signed-in users and Log In/Register for everyone else.
export default async function Header() {
  const user = await getCurrentUser();
  return (
    <HeaderNav
      user={user ? { name: user.name, role: user.role } : null}
    />
  );
}
