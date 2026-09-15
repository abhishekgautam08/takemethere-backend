import dotenv from 'dotenv';
import path from 'path';

// Load from current folder, backend folder, or relative to this file
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY || '0b7d23b852mshdaf5ec08b02a299p132966jsndc55ef781944',
  RAPIDAPI_OPENAI_HOST:
    process.env.RAPIDAPI_OPENAI_HOST ||
    'cheapest-gpt-4-turbo-gpt-4-vision-chatgpt-openai-ai-api.p.rapidapi.com',
  RAPIDAPI_GOOGLE_PLACES_HOST:
    process.env.RAPIDAPI_GOOGLE_PLACES_HOST || 'google-map-places-new-v2.p.rapidapi.com',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'takemethere_jwt_secret_token_key_2026_super_secure',
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'takemethere_admin_passcode_2026',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_TEST_API_KEY || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_TEST_API_KEY_SECRET || '',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};
