/**
 * GET /api/status/[requestId]
 * Polls the status of any Higgsfield generation request.
 */
export async function GET(req, { params }) {
  try {
    const { requestId } = await params;

    const response = await fetch(
      `https://platform.higgsfield.ai/requests/${requestId}/status`,
      {
        headers: {
          'Authorization': `Key ${process.env.HIGGSFIELD_API_KEY}:${process.env.HIGGSFIELD_API_SECRET}`,
        },
      }
    );

    const data = await response.json();

    return Response.json(data, { status: response.ok ? 200 : response.status });
  } catch (error) {
    console.error('[/api/status]', error);
    return Response.json({ error: error?.message ?? 'Something went wrong' }, { status: 500 });
  }
}
