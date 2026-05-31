import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = params.id;
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const res = await fetch(`${backendUrl}/api/shares/${id}`);
    if (!res.ok) {
      return { title: "Curated Wander Route" };
    }
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) {
      return { title: "Curated Wander Route" };
    }
    const title = `${route.route_name} — Wander`;
    const description = route.theme_summary || "Explore this custom walking route on wander.";
    const ogImageUrl = `${appUrl}/api/og?id=${id}`;
    const shareUrl = `${appUrl}/r/${id}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: shareUrl,
        type: "website",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  } catch (err) {
    console.error("Error generating metadata", err);
    return { title: "Curated Wander Route" };
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
