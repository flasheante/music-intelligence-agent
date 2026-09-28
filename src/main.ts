import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.register());
  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);

  app.enableCors({ origin: config.get('frontendUrl', { infer: true }) });
  await app.listen(config.get('port', { infer: true }));
}
bootstrap();
