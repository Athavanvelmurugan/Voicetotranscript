const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'petcare',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    baseURL: 'https://api.groq.com/openai/v1',
    whisperModel: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3',
    llmModel: process.env.GROQ_LLM_MODEL || 'openai/gpt-oss-120b',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    realtimeModel: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',
  },
  audioRetentionDays: parseInt(process.env.AUDIO_RETENTION_DAYS, 10) || 30,
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'petcare_dev_jwt_secret_super_secure_key_2026',
    cookieSecret: process.env.COOKIE_SECRET || 'petcare_dev_cookie_secret_super_secure_key_2026',
    accessTokenExpiry: '15m',
    refreshTokenDays: 14,
    stagingHardcodedOtp: '123456',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};

module.exports = config;
