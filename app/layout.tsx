import "./globals.css";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Yonsei HW Lab",
  description: "Yonsei HW Lab website",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-white to-gray-50">
        <header className="border-b bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-6">
            <div className="flex items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-4 rounded-2xl border bg-white px-6 py-4 shadow-sm">
                <Image src="/yonsei-logo.png" alt="Yonsei University" width={56} height={56} priority />
                <div>
                  <div className="text-xl font-semibold tracking-tight text-gray-900">Yonsei HW Lab</div>
                  <div className="text-sm text-gray-600">Research and Materials</div>
                </div>
              </Link>

              <nav className="flex flex-wrap gap-2">
<NavLink href="/">Home</NavLink>
                <NavLink href="/people">People</NavLink>
                <NavLink href="/projects">Projects</NavLink>
                <NavLink href="/publications">Publications</NavLink>
                <NavLink href="/resources">Resources</NavLink>
                <NavLink href="/news">News</NavLink>
              </nav>
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t bg-white/60">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-gray-500">
            Yonsei HW Lab
          </div>
        </footer>
      </body>
    </html>
  );
}

