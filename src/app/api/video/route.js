/**
 * POST /api/video
 * Step 2: Submits a video generation request to Veo 3.1 Image-to-Video.
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
      aspect_ratio: aspectRatio,
      resolution,
      duration,
      generate_audio: generateAudio,
    };

    const response = await fetch('https://platform.higgsfield.ai/google/veo-3.1-i2v', {
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
