import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const viewport: Viewport = {
  themeColor: "#9333ea",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://acai-food-mobile.vercel.app"),
  title: "AçaíFood - O Marketplace Definitivo de Açaí",
  description: "O açaí perfeito pra você. O frete é calculado por GPS de acordo com a sua distância da loja.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png?v=3", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png?v=3", sizes: "180x180", type: "image/png" },
      { url: "/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    title: "AçaíFood - O Marketplace Definitivo de Açaí",
    description: "O açaí perfeito pra você. O frete é calculated por GPS.",
    url: "https://acai-food-mobile.vercel.app",
    siteName: "AçaíFood",
    images: [
      {
        url: "https://acai-food-mobile.vercel.app/banner.png?v=3",
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
    images: ["https://acai-food-mobile.vercel.app/banner.png?v=3"],
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
        <meta property="og:image" content="https://acai-food-mobile.vercel.app/banner.png?v=3" />
        <meta property="og:image:secure_url" content="https://acai-food-mobile.vercel.app/banner.png?v=3" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:image" content="https://acai-food-mobile.vercel.app/banner.png?v=3" />
        <link rel="image_src" href="https://acai-food-mobile.vercel.app/banner.png?v=3" />
      </head>
      <body className="antialiased font-sans bg-zinc-950 text-zinc-100">
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
