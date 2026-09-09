import { Global, Module } from '@nestjs/common';
import { EncryptionService, ENCRYPTION_MASTER_KEY } from './encryption.service';
import { loadConfiguration } from '../config/configuration';

@Global()
@Module({
  providers: [
    { provide: ENCRYPTION_MASTER_KEY, useFactory: () => loadConfiguration().encryptionMasterKey },
    EncryptionService,
  ],
  exports: [EncryptionService],
})
export class CryptoModule {}
