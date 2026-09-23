import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4000',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api');

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Sincronizador SAP → Odoo')
      .setDescription('Réplica de salidas de inventario SAP → Odoo stock.picking')
      .setVersion('0.1.0')
      .addCookieAuth('admin_token')
      .addCookieAuth('portal_token')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger en http://localhost:${process.env.PORT ?? 3000}/api/docs`);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`App HTTP corriendo en http://localhost:${port}/api`);
}
bootstrap();
