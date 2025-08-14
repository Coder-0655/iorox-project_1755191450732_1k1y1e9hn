import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ShopFlux — Modern eCommerce",
    template: "%s | ShopFlux",
  },
  description:
    "ShopFlux — a modern, fast, and secure eCommerce experience. Browse products, manage your cart, and checkout quickly.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "ShopFlux — Modern eCommerce",
    description:
      "ShopFlux — a modern, fast, and secure eCommerce experience. Browse products, manage your cart, and checkout quickly.",
    url: "https://your-shopflux-site.example",
    siteName: "ShopFlux",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShopFlux — Modern eCommerce",
    description:
      "ShopFlux — a modern, fast, and secure eCommerce experience. Browse products, manage your cart, and checkout quickly.",
    creator: "@shopflux",
    images: ["/images/og-image.png"],
  },
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * RootLayout - Application root layout used by Next.js App Router.
 * - Includes global HTML structure and metadata.
 * - Loads Tailwind globals.
 * - Provides a minimal, accessible header and footer shared across the app.
 *
 * Keep this file server-rendered for best performance. Avoid client-only logic here;
 * put interactive client components inside the children tree or components folder.
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="h-full bg-white text-slate-900 antialiased">
      <head />
      <body className="min-h-screen flex flex-col">
        {/* Skip link for accessibility */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:inline-block focus:translate-y-0 focus:mt-2 focus:bg-slate-900 focus:text-white px-3 py-2 rounded-md"
        >
          Skip to content
        </a>

        {/* Header */}
        <header className="w-full border-b bg-white/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav
              aria-label="Primary"
              className="flex items-center justify-between h-16"
            >
              <div className="flex items-center space-x-4">
                <Link href="/" className="flex items-center gap-3">
                  <span className="inline-block w-9 h-9 rounded-md bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-semibold">
                    SF
                  </span>
                  <span className="font-semibold text-lg tracking-tight">
                    ShopFlux
                  </span>
                </Link>
                <form
                  action="/search"
                  method="get"
                  className="hidden md:flex items-center bg-slate-100 rounded-md px-2 py-1 max-w-md w-full"
                  role="search"
                >
                  <label htmlFor="q" className="sr-only">
                    Search products
                  </label>
                  <input
                    id="q"
                    name="q"
                    type="search"
                    placeholder="Search products, categories..."
                    className="flex-1 bg-transparent outline-none px-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="text-sm px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    Search
                  </button>
                </form>
              </div>

              <div className="flex items-center space-x-4">
                <Link
                  href="/collections"
                  className="hidden sm:inline-block text-sm text-slate-700 hover:text-slate-900"
                >
                  Collections
                </Link>
                <Link
                  href="/account"
                  className="text-sm text-slate-700 hover:text-slate-900"
                >
                  Account
                </Link>
                <Link
                  href="/cart"
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-slate-200 hover:shadow-sm"
                  aria-label="View cart"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-slate-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 7h13"
                    />
                  </svg>
                  <span className="text-sm">Cart</span>
                </Link>
              </div>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main id="main" className="flex-1 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t bg-white/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-slate-600">
                &copy; {new Date().getFullYear()} ShopFlux. All rights reserved.
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <Link href="/terms" className="hover:underline">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:underline">
                  Privacy
                </Link>
                <a
                  href="mailto:support@shopflux.example"
                  className="hover:underline"
                >
                  Support
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}