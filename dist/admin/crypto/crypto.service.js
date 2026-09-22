"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CryptoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
let CryptoService = CryptoService_1 = class CryptoService {
    constructor() {
        this.logger = new common_1.Logger(CryptoService_1.name);
    }
    onModuleInit() {
        const hex = process.env.ADMIN_ENCRYPTION_KEY;
        if (!hex || hex.length !== 64) {
            throw new Error('ADMIN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
                'Generate with: openssl rand -hex 32');
        }
        this.key = Buffer.from(hex, 'hex');
        this.logger.log('Encryption key loaded');
    }
    encrypt(plaintext) {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
    }
    decrypt(ciphertext) {
        const [ivHex, tagHex, encHex] = ciphertext.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const enc = Buffer.from(encHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
        decipher.setAuthTag(tag);
        return decipher.update(enc).toString('utf8') + decipher.final('utf8');
    }
};
exports.CryptoService = CryptoService;
exports.CryptoService = CryptoService = CryptoService_1 = __decorate([
    (0, common_1.Injectable)()
], CryptoService);
//# sourceMappingURL=crypto.service.js.map