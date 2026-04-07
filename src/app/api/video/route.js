/**
 * POST /api/video
 * Step 2: Submits a video generation request to DoP Standard (image-to-video).
 * Body: { prompt, imageUrl, aspectRatio?, resolution?, duration?, generateAudio? }
 */
export async function POST(req) {
  try {
    const {
      prompt,
      imageUrl,
      aspectRatio = '16:9',
      resolution = '1080p',
      duration = 8,
      generateAudio = true,
    } = await req.json();

    const body = {
      prompt,
      image_url: imageUrl,
      ...(aspectRatio && { aspect_ratio: aspectRatio }),
      ...(resolution && { resolution }),
      duration,
    };

    const response = await fetch('https://platform.higgsfield.ai/higgsfield-ai/dop/standard', {
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
    console.error('[/api/video]', error);
    return Response.json({ error: error?.message ?? 'Something went wrong' }, { status: 500 });
  }
}
