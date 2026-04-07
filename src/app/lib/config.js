// Higgsfield API configuration
export const API_BASE = 'https://platform.higgsfield.ai';

export const MODELS = {
  IMAGE: 'higgsfield-ai/soul/standard',
  VIDEO: 'higgsfield-ai/dop/standard',
};

// Polling intervals (ms)
export const POLL_INTERVAL_IMAGE = 3000;
export const POLL_INTERVAL_VIDEO = 10000;
export const POLL_TIMEOUT_IMAGE = 2 * 60 * 1000;   // 2 minutes
export const POLL_TIMEOUT_VIDEO = 7 * 60 * 1000;   // 7 minutes
export const POLL_MAX_IMAGE = 40;
export const POLL_MAX_VIDEO = 42;

// Generation options
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
export const IMAGE_RESOLUTIONS = ['720p', '1080p', '2K'];
export const VIDEO_RESOLUTIONS = ['720p', '1080p'];
export const VIDEO_DURATIONS = [4, 6, 8];

// Example prompts
export const IMAGE_EXAMPLES = [
  'Professional influencer holding a coffee cup in a modern cafe, product placement, Instagram aesthetic',
  'Influencer at a beach resort, sunset, vacation vibes, photorealistic',
  'Luxury fashion photoshoot, studio lighting, elegant pose, high-end brand aesthetic',
  'Beauty influencer applying makeup, ring light reflection, soft bokeh background, editorial quality',
];

export const VIDEO_EXAMPLES = [
  'Influencer showcasing a smartphone, camera slowly zooms in on product, professional lighting, smooth motion',
  'Influencer walking through modern office, confident stride, camera follows, corporate aesthetic',
  'Product reveal with dramatic lighting, camera circles around subject, cinematic quality',
  'Fashion influencer on rooftop at golden hour, slow motion hair flip, cinematic depth of field',
];

// File upload constraints
export const MAX_FILE_SIZE_MB = 10;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

// LocalStorage keys
export const LS_API_KEY = 'hf_api_key';
export const LS_API_SECRET = 'hf_api_secret';
export const LS_HISTORY = 'hf_history';
export const MAX_HISTORY = 10;
