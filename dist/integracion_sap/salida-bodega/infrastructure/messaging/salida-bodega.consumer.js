"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SalidaBodegaConsumer_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalidaBodegaConsumer = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const amqplib = require("amqplib");
const procesar_salida_bodega_use_case_1 = require("../../application/use-cases/procesar-salida-bodega.use-case");
const procesar_inventario_inicial_use_case_1 = require("../../application/use-cases/procesar-inventario-inicial.use-case");
const EXCHANGE = 'archivo_bodega.eventos';
const ROUTING_KEY = 'documento.validado';
const QUEUE = 'integracion_sap.salida_bodega';
const DLQ = 'integracion_sap.salida_bodega.dlq';
let SalidaBodegaConsumer = SalidaBodegaConsumer_1 = class SalidaBodegaConsumer {
    constructor(cfg, procesarSalidaUseCase, procesarInventarioUseCase) {
        this.cfg = cfg;
        this.procesarSalidaUseCase = procesarSalidaUseCase;
        this.procesarInventarioUseCase = procesarInventarioUseCase;
        this.logger = new common_1.Logger(SalidaBodegaConsumer_1.name);
        this.connection = null;
        this.channel = null;
    }
    async onModuleInit() {
        if (this.cfg.get('IS_WORKER') !== 'true')
            return;
        await this.connect();
    }
    async connect() {
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
                if (!msg)
                    return;
                try {
                    const evento = JSON.parse(msg.content.toString());
                    await this.despachar(evento);
                    this.channel.ack(msg);
                }
                catch (err) {
                    this.logger.error(`Error procesando mensaje: ${err.message}`);
                    this.channel.nack(msg, false, false);
                }
            });
            this.logger.log(`Worker escuchando ${QUEUE} — tipos: SALIDA_BODEGA, INVENTARIO_INICIAL, ACTUALIZACION_INVENTARIO`);
        }
        catch (err) {
            this.logger.warn(`No se pudo conectar a RabbitMQ: ${err.message}. Worker inactivo.`);
        }
    }
    async despachar(evento) {
        switch (evento.tipoDocumento) {
            case 'SALIDA_BODEGA':
                await this.procesarSalidaUseCase.ejecutar(evento);
                break;
            case 'INVENTARIO_INICIAL':
            case 'ACTUALIZACION_INVENTARIO':
                await this.procesarInventarioUseCase.ejecutar(evento);
                break;
            case 'ENTRADA_MERCANCIA':
                this.logger.warn('Tipo ENTRADA_MERCANCIA aún no implementado, ignorando');
                break;
            default:
                this.logger.warn(`Tipo de documento no soportado: ${evento.tipoDocumento}`);
        }
    }
    async onModuleDestroy() {
        await this.channel?.close().catch(() => { });
        await this.connection?.close().catch(() => { });
    }
};
exports.SalidaBodegaConsumer = SalidaBodegaConsumer;
exports.SalidaBodegaConsumer = SalidaBodegaConsumer = SalidaBodegaConsumer_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        procesar_salida_bodega_use_case_1.ProcesarSalidaBodegaUseCase,
        procesar_inventario_inicial_use_case_1.ProcesarInventarioInicialUseCase])
], SalidaBodegaConsumer);
//# sourceMappingURL=salida-bodega.consumer.js.map