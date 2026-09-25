import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { VersionzController } from '../src/versionz/versionz.controller.js';

// Builds only what `/versionz` needs, not the full AppModule — that one connects to RabbitMQ.
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
      controllers: [VersionzController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the service name and version', async () => {
    const response = await request(app.getHttpServer())
      .get('/versionz')
      .expect(200);

    expect(response.body).toEqual({ service: 'idp', version: '9.9.9' });
  });
});
