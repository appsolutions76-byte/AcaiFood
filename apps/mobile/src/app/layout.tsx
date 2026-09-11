import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const viewport: Viewport = {
  themeColor: "#9333ea",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.acaifood.app.br"),
  title: "AçaíFood - O Marketplace Definitivo de Açaí",
  description: "O açaí perfeito pra você. O frete é calculado por GPS de acordo com a sua distância da loja.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png?v=4", sizes: "180x180", type: "image/png" },
      { url: "/icon-192x192.png?v=4", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    title: "AçaíFood - O Marketplace Definitivo de Açaí",
    description: "O açaí perfeito pra você. O frete é calculado por GPS.",
    url: "https://www.acaifood.app.br",
    siteName: "AçaíFood",
    images: [
      {
        url: "https://www.acaifood.app.br/banner.png?v=4",
        width: 1200,
        height: 630,
        alt: "AçaíFood Roxo Açaí",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AçaíFood - O Marketplace Definitivo de Açaí",
    description: "O marketplace definitivo de açaí.",
    images: ["https://www.acaifood.app.br/banner.png?v=4"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta property="og:image" content="https://www.acaifood.app.br/banner.png?v=4" />
        <meta property="og:image:secure_url" content="https://www.acaifood.app.br/banner.png?v=4" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:image" content="https://www.acaifood.app.br/banner.png?v=4" />
        <link rel="image_src" href="https://www.acaifood.app.br/banner.png?v=4" />
      </head>
      <body className="antialiased font-sans bg-zinc-950 text-zinc-100">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
