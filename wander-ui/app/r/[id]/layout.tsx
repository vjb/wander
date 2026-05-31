import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = params.id;
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
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
    const title = `${route.route_name} - Curated Wander Route`;
    const description = route.theme_summary || "Explore this custom walking route on wander.";
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
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
