import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { ProcesarSalidaBodegaUseCase } from '../../application/use-cases/procesar-salida-bodega.use-case';
import { ProcesarInventarioInicialUseCase } from '../../application/use-cases/procesar-inventario-inicial.use-case';
import { ProcesarEntradaMercanciaUseCase } from '../../application/use-cases/procesar-entrada-mercancia.use-case';

const EXCHANGE = 'archivo_bodega.eventos';
const ROUTING_KEY = 'documento.validado';
const QUEUE = 'integracion_sap.salida_bodega';
const DLQ = 'integracion_sap.salida_bodega.dlq';

@Injectable()
export class SalidaBodegaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SalidaBodegaConsumer.name);
  private connection: any = null;
  private channel: any = null;

  constructor(
    private readonly cfg: ConfigService,
    private readonly procesarSalidaUseCase: ProcesarSalidaBodegaUseCase,
    private readonly procesarInventarioUseCase: ProcesarInventarioInicialUseCase,
    private readonly procesarEntradaUseCase: ProcesarEntradaMercanciaUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.cfg.get('IS_WORKER') !== 'true') return;
    await this.connect();
  }

  private async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.cfg.get('RABBITMQ_URL', 'amqp://localhost'));
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);

      await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      await this.channel.assertQueue(DLQ, { durable: true });
      await this.channel.assertQueue(QUEUE, {
        durable: true,
        arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': DLQ },
      });
      await this.channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

      this.channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        try {
          const evento = JSON.parse(msg.content.toString());
          await this.despachar(evento);
          this.channel.ack(msg);
        } catch (err) {
          this.logger.error(`Error procesando mensaje: ${err.message}`);
          this.channel.nack(msg, false, false);
        }
      });

      this.logger.log(`Worker escuchando ${QUEUE} — tipos: SALIDA_BODEGA, ENTRADA_MERCANCIA, INVENTARIO_INICIAL, ACTUALIZACION_INVENTARIO`);
    } catch (err) {
      this.logger.warn(`No se pudo conectar a RabbitMQ: ${err.message}. Worker inactivo.`);
    }
  }

  private async despachar(evento: any): Promise<void> {
    switch (evento.tipoDocumento) {
      case 'SALIDA_BODEGA':
        await this.procesarSalidaUseCase.ejecutar(evento);
        break;
      case 'INVENTARIO_INICIAL':
      case 'ACTUALIZACION_INVENTARIO':
        await this.procesarInventarioUseCase.ejecutar(evento);
        break;
      case 'ENTRADA_MERCANCIA':
        await this.procesarEntradaUseCase.ejecutar(evento);
        break;
      default:
        this.logger.warn(`Tipo de documento no soportado: ${evento.tipoDocumento}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => {});
    await this.connection?.close().catch(() => {});
  }
}
