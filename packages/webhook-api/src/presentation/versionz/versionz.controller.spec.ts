import { ConfigService } from '@nestjs/config';
import { SERVICE_NAME, VersionzController } from './versionz.controller.js';

describe('VersionzController', () => {
  it('returns the service name and the configured version', () => {
    const controller = new VersionzController(
      new ConfigService({ version: '2.3.4' }),
    );

    expect(controller.get()).toEqual({
      Service: SERVICE_NAME,
      Version: '2.3.4',
    });
  });

  it('falls back to "unknown" when no version is configured', () => {
    const controller = new VersionzController(new ConfigService({}));

    expect(controller.get().Version).toBe('unknown');
  });
});
