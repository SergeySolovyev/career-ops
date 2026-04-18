/**
 * AES-256-GCM symmetric encryption for HH browser sessions.
 *
 * Master key lives only in env (HH_SESSION_SECRET, base64-encoded 32 bytes).
 * It never touches the database; the DB stores ciphertext + per-row IV.
 *
 * Auth tag is appended to ciphertext (last 16 bytes) so we can roundtrip
 * with a single bytea column.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALG = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard
const TAG_LENGTH = 16

function getKey(): Buffer {
  const raw = process.env.HH_SESSION_SECRET
  if (!raw) throw new Error('HH_SESSION_SECRET not set')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) {
    throw new Error(
      `HH_SESSION_SECRET must decode to 32 bytes, got ${buf.length}. ` +
        `Generate one with: openssl rand -base64 32`,
    )
  }
  return buf
}

/**
 * Encrypt UTF-8 string → { iv, ciphertext } where ciphertext = encrypted || authTag.
 * Returns base64 strings ready for storage as TEXT or insertable as bytea.
 */
export function encryptJson(value: unknown): {
  iv: string
  ciphertext: string
} {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALG, key, iv)
  const json = JSON.stringify(value)
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
  }
}

/**
 * Inverse of encryptJson. Throws on tampered ciphertext.
 */
export function decryptJson<T = unknown>(input: {
  iv: string
  ciphertext: string
}): T {
  const key = getKey()
  const iv = Buffer.from(input.iv, 'base64')
  const blob = Buffer.from(input.ciphertext, 'base64')
  const tag = blob.subarray(blob.length - TAG_LENGTH)
  const ct = blob.subarray(0, blob.length - TAG_LENGTH)
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as T
}
