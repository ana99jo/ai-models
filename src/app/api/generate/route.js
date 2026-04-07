/**
 * POST /api/generate
 * Submits an image generation request to Nano Banana Pro.
 * Body: { prompt, referenceImage?, aspectRatio?, resolution? }
 * referenceImage should be a base64 data URL (e.g. "data:image/jpeg;base64,...")
 */
export async function POST(req) {
  try {
    const { prompt, referenceImage, aspectRatio, resolution } = await req.json();

    const body = {
      prompt,
      ...(referenceImage && { reference_image: referenceImage }),
      ...(aspectRatio && { aspect_ratio: aspectRatio }),
      ...(resolution && { resolution }),
    };

    const response = await fetch('https://platform.higgsfield.ai/nano-banana-pro/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.HIGGSFIELD_API_KEY}:${process.env.HIGGSFIELD_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return Response.json(data, { status: response.ok ? 200 : response.status });
  } catch (error) {
    return Response.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
