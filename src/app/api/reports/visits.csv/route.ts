export async function GET() {
  return new Response("Not implemented\n", {
    status: 501,
    headers: { "content-type": "text/csv; charset=utf-8" },
  });
}
