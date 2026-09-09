import { EncryptionService } from './encryption.service';

const masterKey = Buffer.alloc(32, 7);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it('round-trips a value', () => {
    const envelope = service.encrypt('super-secret');
    expect(service.decrypt(envelope)).toBe('super-secret');
  });

  it('never emits the plaintext in the envelope', () => {
    expect(service.encrypt('super-secret')).not.toContain('super-secret');
  });

  it('produces a different envelope each time for the same input', () => {
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('rejects a tampered ciphertext', () => {
    const parts = service.encrypt('super-secret').split('.');
    parts[5] = Buffer.from('tampered-ciphertext').toString('base64url');
    expect(() => service.decrypt(parts.join('.'))).toThrow();
  });

  it('rejects an envelope encrypted under a different master key', () => {
    const envelope = new EncryptionService(Buffer.alloc(32, 9)).encrypt('secret');
    expect(() => service.decrypt(envelope)).toThrow();
  });
});
