export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    product: "HyperOptimal Metrics",
    timestamp: new Date().toISOString(),
  });
}
