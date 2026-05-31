import { NextRequest, NextResponse } from "next/server";

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng || !GOOGLE_KEY) {
    return new NextResponse(null, { status: 404 });
  }

  const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=420x180&location=${lat},${lng}&fov=90&pitch=5&key=${GOOGLE_KEY}`;

  try {
    const res = await fetch(svUrl);
    // If Google returns a "no imagery" grey image, still pass it through
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
