"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const throttler_1 = require("@nestjs/throttler");
const admin_usuario_orm_entity_1 = require("./entities/admin-usuario.orm-entity");
const odoo_conexion_orm_entity_1 = require("./entities/odoo-conexion.orm-entity");
const crypto_service_1 = require("./crypto/crypto.service");
const jwt_admin_strategy_1 = require("./auth/strategies/jwt-admin.strategy");
const jwt_admin_guard_1 = require("./auth/guards/jwt-admin.guard");
const superadmin_guard_1 = require("./auth/guards/superadmin.guard");
const admin_auth_service_1 = require("./auth/admin-auth.service");
const admin_auth_controller_1 = require("./auth/admin-auth.controller");
const odoo_config_service_1 = require("./config/odoo-config.service");
const odoo_config_controller_1 = require("./config/odoo-config.controller");
const admin_seeder_service_1 = require("./seeder/admin-seeder.service");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([admin_usuario_orm_entity_1.AdminUsuarioOrmEntity, odoo_conexion_orm_entity_1.OdooConexionOrmEntity]),
            passport_1.PassportModule,
            jwt_1.JwtModule.register({
                secret: process.env.ADMIN_JWT_SECRET || 'changeme',
                signOptions: { expiresIn: '15m' },
            }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
        ],
        providers: [
            crypto_service_1.CryptoService,
            jwt_admin_strategy_1.JwtAdminStrategy,
            jwt_admin_guard_1.JwtAdminGuard,
            superadmin_guard_1.SuperadminGuard,
            admin_auth_service_1.AdminAuthService,
            odoo_config_service_1.OdooConfigService,
            admin_seeder_service_1.AdminSeederService,
        ],
        controllers: [admin_auth_controller_1.AdminAuthController, odoo_config_controller_1.OdooConfigController],
        exports: [crypto_service_1.CryptoService],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map