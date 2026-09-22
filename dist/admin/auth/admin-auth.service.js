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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AdminAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const OtpLib = require("otplib");
const authenticator = OtpLib.authenticator ?? OtpLib.default?.authenticator ?? OtpLib;
const admin_usuario_orm_entity_1 = require("../entities/admin-usuario.orm-entity");
let AdminAuthService = AdminAuthService_1 = class AdminAuthService {
    constructor(usuarioRepo, jwtService) {
        this.usuarioRepo = usuarioRepo;
        this.jwtService = jwtService;
        this.logger = new common_1.Logger(AdminAuthService_1.name);
    }
    async login(dto) {
        const usuario = await this.usuarioRepo.findOne({
            where: { email: dto.email, activo: true },
        });
        if (!usuario) {
            await bcrypt.compare(dto.password, '$2a$12$invalid.hash.padding.to.prevent.timing');
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        }
        const valid = await bcrypt.compare(dto.password, usuario.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        if (usuario.totpActivo && usuario.totpSecret) {
            if (!dto.totpCode) {
                throw new common_1.UnauthorizedException('Se requiere código TOTP');
            }
            const ok = authenticator.verify({
                token: dto.totpCode,
                secret: usuario.totpSecret,
            });
            if (!ok)
                throw new common_1.UnauthorizedException('Código TOTP inválido');
        }
        await this.usuarioRepo.update(usuario.id, { ultimoAcceso: new Date() });
        const token = this.jwtService.sign({
            sub: usuario.id,
            email: usuario.email,
            rol: usuario.rol,
        });
        this.logger.log(`Login exitoso: ${usuario.email} (${usuario.rol})`);
        return token;
    }
    async me(userId) {
        const u = await this.usuarioRepo.findOne({ where: { id: userId } });
        if (!u)
            throw new common_1.UnauthorizedException();
        return { id: u.id, email: u.email, rol: u.rol, ultimoAcceso: u.ultimoAcceso };
    }
};
exports.AdminAuthService = AdminAuthService;
exports.AdminAuthService = AdminAuthService = AdminAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(admin_usuario_orm_entity_1.AdminUsuarioOrmEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService])
], AdminAuthService);
//# sourceMappingURL=admin-auth.service.js.map