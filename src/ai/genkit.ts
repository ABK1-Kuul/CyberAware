import { genkit } from 'genkit'
import { googleAI } from '@genkit-ai/google-genai'
import { env } from '@/lib/env'

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
})

void env.GOOGLE_GENAI_API_KEY
