/**
 * Initialize API keys from environment variables on startup
 * Runs before the server starts accepting requests
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/freeapi.db');
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'd82623ecc62df77bffdbfe0f5ba67480ba31b4e993a9f1919e4f13716ef04906';
const key = Buffer.from(ENCRYPTION_KEY, 'hex');

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), authTag };
}

export function initApiKeys() {
  try {
    const db = new Database(DB_PATH);
    
    // Check if keys already exist
    const stmt = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE enabled = 1');
    const result = stmt.get() as { count: number };
    
    if (result.count > 0) {
      console.log(`✅ ${result.count} API keys already loaded in database`);
      db.close();
      return;
    }
    
    console.log('📝 Initializing API keys from environment variables...');
    
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO api_keys (platform, label, encrypted_key, iv, auth_tag, status, enabled)
      VALUES (?, ?, ?, ?, ?, 'healthy', 1)
    `);
    
    const keys = [
      { platform: 'google', label: 'Gemini', env: 'GEMINI_API_KEY' },
      { platform: 'groq', label: 'Groq', env: 'GROQ_API_KEY' },
      { platform: 'cerebras', label: 'Cerebras', env: 'CEREBRAS_API_KEY' },
      { platform: 'mistral', label: 'Mistral', env: 'MISTRAL_API_KEY' },
    ];
    
    let added = 0;
    for (const { platform, label, env } of keys) {
      const apiKey = process.env[env];
      if (apiKey && apiKey.length > 10) {
        const { encrypted, iv, authTag } = encrypt(apiKey);
        insertStmt.run(platform, label, encrypted, iv, authTag);
        console.log(`✅ Added ${platform} (${label})`);
        added++;
      } else {
        console.log(`⚠️  Skipping ${platform} - ${env} not set or too short`);
      }
    }
    
    db.close();
    
    if (added > 0) {
      console.log(`\n🎉 ${added} API keys initialized successfully!`);
      console.log('🔍 Health checker will validate keys in next cycle...\n');
    } else {
      console.log('\n⚠️  No API keys found in environment variables');
      console.log('📝 Set GROQ_API_KEY, GEMINI_API_KEY, etc. in Railway variables\n');
    }
  } catch (err) {
    console.error('❌ Failed to initialize API keys:', err);
  }
}
