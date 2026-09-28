import { Controller, Get, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup.js';
import { EnvelopeInterceptor } from '../src/presentation/common/interceptors/envelope.interceptor.js';
import { VersionzController } from '../src/presentation/versionz/versionz.controller.js';

// Stand-in for a prefixed API route, proving the global prefix still applies to everything else.
@Controller('probe')
class ProbeController {
  @Get()
  get(): string {
    return 'ok';
  }
}

// Builds only what `/versionz` needs (config + the global envelope + the real `configureApp`
// routing), not the full AppModule — that one connects to MongoDB on startup.
describe('GET /versionz (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ version: '9.9.9' })],
        }),
      ],
      controllers: [VersionzController, ProbeController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor }],
    }).compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>(),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('is served at the root, outside the api/v1 prefix, wrapped in the response envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/versionz')
      .expect(200);

    expect(response.body).toMatchObject({
      Data: { Service: 'webhook-api', Version: '9.9.9' },
      StatusCode: 200,
      Code: 'OK',
    });
  });

  it('is not duplicated under the api/v1 prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/versionz').expect(404);
  });

  it('leaves the api/v1 prefix in place for every other route', async () => {
    await request(app.getHttpServer()).get('/api/v1/probe').expect(200);
    await request(app.getHttpServer()).get('/probe').expect(404);
  });
});
