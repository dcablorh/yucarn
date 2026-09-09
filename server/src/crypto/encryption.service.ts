import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ENCRYPTION_MASTER_KEY = 'ENCRYPTION_MASTER_KEY';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

/**
 * Envelope encryption. A fresh data key (DEK) encrypts the plaintext; the
 * master key encrypts the DEK. Rotating the master key only requires
 * re-wrapping DEKs, not re-encrypting ciphertext.
 *
 * Envelope layout: v1.<wrappedDek>.<dekIv>.<dekTag>.<iv>.<ciphertext>.<tag>
 */
@Injectable()
export class EncryptionService {
  constructor(@Inject(ENCRYPTION_MASTER_KEY) private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error('Encryption master key must be exactly 32 bytes');
    }
  }

  encrypt(plaintext: string): string {
    const dek = randomBytes(32);

    const dekIv = randomBytes(12);
    const dekCipher = createCipheriv(ALGORITHM, this.masterKey, dekIv);
    const wrappedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekTag = dekCipher.getAuthTag();

    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [VERSION, wrappedDek, dekIv, dekTag, iv, ciphertext, tag]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  decrypt(envelope: string): string {
    const [version, wrappedDek, dekIv, dekTag, iv, ciphertext, tag] = envelope.split('.');
    if (version !== VERSION) {
      throw new Error(`Unsupported encryption envelope version: ${version}`);
    }

    const dekDecipher = createDecipheriv(
      ALGORITHM,
      this.masterKey,
      Buffer.from(dekIv, 'base64url'),
    );
    dekDecipher.setAuthTag(Buffer.from(dekTag, 'base64url'));
    const dek = Buffer.concat([
      dekDecipher.update(Buffer.from(wrappedDek, 'base64url')),
      dekDecipher.final(),
    ]);

    const decipher = createDecipheriv(ALGORITHM, dek, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
