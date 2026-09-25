import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IEntryNestModule, NestFactory } from '@nestjs/core';

export const GLOBAL_PREFIX = 'api/v1';

/**
 * App-wide HTTP setup shared by `main.ts` and the e2e suite, so tests exercise the same routing as
 * production. Returns the same app so calls chain. `versionz` is excluded from the versioned API
 * prefix: it's an operational endpoint every HTTP app in the platform exposes at the same root path
 * (`GET /versionz`), not part of the `api/v1` contract.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: ['versionz'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return app;
}

/** Creates the webhook-api app from a root module, with `configureApp` applied. */
export async function createApp(
  module: IEntryNestModule,
): Promise<INestApplication> {
  return configureApp(await NestFactory.create(module));
}
