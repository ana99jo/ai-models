/**
 * POST /api/cancel/[requestId]
 * Cancels a queued Higgsfield request.
 */
export async function POST(req, { params }) {
  try {
    const { requestId } = await params;

    const response = await fetch(
      `https://platform.higgsfield.ai/requests/${requestId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${process.env.HIGGSFIELD_API_KEY}:${process.env.HIGGSFIELD_API_SECRET}`,
        },
      }
    );

    return Response.json(
      { success: response.status === 202 },
      { status: response.status === 202 ? 200 : 400 }
    );
  } catch (error) {
    console.error('[/api/cancel]', error);
    return Response.json({ error: error?.message ?? 'Something went wrong' }, { status: 500 });
  }
}
