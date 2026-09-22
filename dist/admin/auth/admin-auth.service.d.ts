import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AdminUsuarioOrmEntity } from '../entities/admin-usuario.orm-entity';
import { LoginDto } from './dto/login.dto';
export declare class AdminAuthService {
    private readonly usuarioRepo;
    private readonly jwtService;
    private readonly logger;
    constructor(usuarioRepo: Repository<AdminUsuarioOrmEntity>, jwtService: JwtService);
    login(dto: LoginDto): Promise<string>;
    me(userId: string): Promise<{
        id: string;
        email: string;
        rol: "ADMIN" | "SUPERADMIN";
        ultimoAcceso: Date;
    }>;
}
