import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { loadConfiguration } from '../config/configuration';

@Injectable()
export class PrivyService {
  private readonly client: PrivyClient;

  constructor() {
    const { privy } = loadConfiguration();
    this.client = new PrivyClient(privy.appId, privy.appSecret);
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    const claims = await this.client.verifyAuthToken(token);
    return { userId: claims.userId };
  }
}
