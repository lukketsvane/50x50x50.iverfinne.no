import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://50x50x50.iverfinne.no"),
  title: "50 × 50 × 50",
  description:
    "Eit parametrisk sitjemøbel i stabla bjørkefinér. Same kode teiknar objektet, reknar det og skriv kuttarket — og seier frå når du bryt oppgåva.",
  openGraph: {
    title: "50 × 50 × 50",
    description:
      "Eit parametrisk sitjemøbel i stabla bjørkefinér. AHO, 500 mm kube.",
    url: "https://50x50x50.iverfinne.no",
    siteName: "50 × 50 × 50",
    type: "website",
    locale: "nn_NO",
  },
  applicationName: "50 × 50 × 50",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "50 × 50 × 50" },
}

export const viewport: Viewport = {
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nn" className={inter.variable}>
      <body className="overflow-hidden antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
