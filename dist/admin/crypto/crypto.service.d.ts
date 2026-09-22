import { OnModuleInit } from '@nestjs/common';
export declare class CryptoService implements OnModuleInit {
    private readonly logger;
    private key;
    onModuleInit(): void;
    encrypt(plaintext: string): string;
    decrypt(ciphertext: string): string;
}
