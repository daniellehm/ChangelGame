/** Minimal browser-like cookie jar for route-handler tests. */
export class Jar {
  private cookies = new Map<string, string>();

  constructor(header = "") {
    for (const part of header.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k) this.cookies.set(k, v.join("="));
    }
  }

  /** Apply a response's Set-Cookie headers (Max-Age=0 deletes). */
  update(res: Response): this {
    for (const sc of res.headers.getSetCookie()) {
      const [pair, ...attrs] = sc.split(";");
      const i = pair!.indexOf("=");
      const name = pair!.slice(0, i).trim();
      const value = pair!.slice(i + 1).trim();
      const expired = attrs.some((a) => /^\s*max-age=0\s*$/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return this;
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}
