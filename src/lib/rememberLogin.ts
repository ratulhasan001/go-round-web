// "Remember me" on the login pages: this device keeps the login ID (the customer's mobile number, the admin's email)
// and fills it in next time. Only the ID - never the password (the browser's own password manager offers that)
// and never a longer login.

const KEY = { store: "go-round:remember:store", admin: "go-round:remember:admin" } as const;
export type LoginArea = keyof typeof KEY;

/** The login ID this device remembers, or "" when "Remember me" was off (or storage is blocked). */
export function rememberedLogin(area: LoginArea): string {
  try {
    return localStorage.getItem(KEY[area]) ?? "";
  } catch {
    return "";
  }
}

/** After a right password: keep the ID when "Remember me" is ticked, forget it when it isn't. */
export function rememberLogin(area: LoginArea, id: string, on: boolean) {
  try {
    if (on && id.trim()) localStorage.setItem(KEY[area], id.trim());
    else localStorage.removeItem(KEY[area]);
  } catch {
    /* private mode */
  }
}
