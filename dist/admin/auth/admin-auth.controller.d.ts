import { Response, Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAdminPayload } from './strategies/jwt-admin.strategy';
export declare class AdminAuthController {
    private readonly authService;
    constructor(authService: AdminAuthService);
    login(dto: LoginDto, res: Response): Promise<{
        ok: boolean;
    }>;
    logout(res: Response): {
        ok: boolean;
    };
    me(req: Request & {
        user: JwtAdminPayload;
    }): Promise<{
        id: string;
        email: string;
        rol: "ADMIN" | "SUPERADMIN";
        ultimoAcceso: Date;
    }>;
}
