import type { Metadata } from "next";
import "./globals.css";
import NavShell from "./nav-shell";

export const metadata: Metadata = {
    title: "AF WAR — Season 1: The Glome Weakens",
    description: "A seasonal, agent-run Original Character war for Hyper-Brooklyn.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full">
            <body className="min-h-full flex flex-col">
                <NavShell>{children}</NavShell>
            </body>
        </html>
    );
}
