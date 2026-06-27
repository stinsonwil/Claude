// AI Service - Replace ANTHROPIC_API_KEY with your actual key
// Story generation uses claude-haiku-4-5-20251001 (fast + cost-effective for stories)
// Image generation uses a placeholder - integrate DALL-E, Stable Diffusion, or similar

const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Word counts per story length
const STORY_LENGTHS = {
  Short: { words: 300, label: 'short (about 300 words)' },
  Medium: { words: 700, label: 'medium length (about 700 words)' },
  Long: { words: 1500, label: 'long (about 1500 words)' },
};

/**
 * Generate a story using the Claude API.
 * Returns { title, story, genre, length } on success.
 */
export async function generateStory(genre, length) {
  // --- PLACEHOLDER MODE ---
  // Remove the block below (or replace the key constant above) once you have a real API key
  const isPlaceholder = !ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE' || !ANTHROPIC_API_KEY.startsWith('sk-ant-');
  if (isPlaceholder) {
    await new Promise(r => setTimeout(r, 1800)); // simulate network delay
    return getPlaceholderStory(genre, length);
  }
  // --- END PLACEHOLDER MODE ---

  const lengthConfig = STORY_LENGTHS[length] || STORY_LENGTHS.Medium;
  const prompt = `Write an engaging ${genre.toLowerCase()} story that is ${lengthConfig.label}.

Requirements:
- Start with a compelling title on its own line prefixed with "Title: "
- Write the full story below the title
- Use vivid, descriptive language
- Include interesting characters and a satisfying plot arc
- End with a memorable conclusion

Begin:`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse title from response
  const lines = text.split('\n');
  let title = `${genre} Story`;
  let storyBody = text;
  if (lines[0].startsWith('Title:')) {
    title = lines[0].replace('Title:', '').trim();
    storyBody = lines.slice(1).join('\n').trim();
  }

  return { title, story: storyBody, genre, length };
}

/**
 * Generate an illustration prompt and return an image URI.
 * Replace this with a real image generation API (DALL-E 3, Stable Diffusion, etc.)
 */
export async function generateIllustration(title, genre) {
  // --- PLACEHOLDER ---
  // Replace this function body with a real image generation API call (DALL-E 3, Stability AI, etc.)
  // The function must return a Promise<string> resolving to an image URI.
  await new Promise(r => setTimeout(r, 1200));
  const colors = {
    Fantasy: '6C3DF4/EDE9FE',
    Horror: '1A1A2E/374151',
    Mystery: '1E3A5F/BFDBFE',
    Adventure: '065F46/A7F3D0',
    'Sci-Fi': '1E1B4B/C7D2FE',
    Romance: '9D174D/FBCFE8',
    Comedy: 'D97706/FDE68A',
    Custom: '6B7280/F3F4F6',
  };
  const color = colors[genre] || '6C3DF4/EDE9FE';
  // Uses a free placeholder image service - replace with real image generation
  return `https://placehold.co/600x300/${color}?text=${encodeURIComponent(title.slice(0, 30))}`;
}

// Placeholder story shown before an API key is configured
function getPlaceholderStory(genre, length) {
  const titles = {
    Fantasy: 'The Crystal of Eternal Dawn',
    Horror: 'The Whispering Walls',
    Mystery: 'The Clock that Stopped at Midnight',
    Adventure: 'Beyond the Edge of the Known Map',
    'Sci-Fi': 'Signal from the Outer Rim',
    Romance: 'A Letter Never Sent',
    Comedy: 'The Great Cheese Heist',
    Custom: 'An Unexpected Journey',
  };
  const title = titles[genre] || 'An Unexpected Journey';
  const story = `${title}

Once upon a time in a world not so different from our own, something extraordinary began — the kind of thing that only happens once in a generation, if that.

This is a placeholder story to show you how StorySpark looks in action. To generate real AI-powered stories, open src/services/aiService.js and replace the ANTHROPIC_API_KEY constant at the top with your actual Anthropic API key (get one free at console.anthropic.com).

The characters in this story were vibrant and full of life. The protagonist — let's call her Elena — had spent years searching for something she couldn't name. It wasn't until the ${genre.toLowerCase()} elements of her world began to shift and blur that she realized the search had always been for herself.

"There are places," her mentor once told her, "where the rules of the ordinary world don't apply. You're standing in one of them now."

Elena looked around. The landscape had changed while she was thinking — the trees were taller, the shadows longer, and somewhere in the distance a light pulsed like a slow heartbeat.

She took a step forward. Then another. By the third step she was running, and by the time she reached the light she was laughing, because sometimes the most ${genre.toLowerCase()} thing in the world is the simple act of moving toward something unknown with an open heart.

The adventure — or the mystery, or the love story, or whatever genre fate had assigned to her life today — was just beginning.

Add your API key to generate original stories like this one!`;

  return { title, story, genre, length };
}
