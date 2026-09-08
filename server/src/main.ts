import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';

// The BigInt JSON patch is applied as a side effect of importing AppModule
// (see src/common/bigint-json.ts) so it covers every entrypoint that boots
// the app graph, not just this one.

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.listen(config.port);
}

void bootstrap();
