import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jujubordados | Cada ponto, um carinho",
  description:
    "Cada ponto, um carinho. Cada bordado, uma história! Encontre bordados personalizados da Jujubordados.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Jujubordados", statusBarStyle: "default" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
