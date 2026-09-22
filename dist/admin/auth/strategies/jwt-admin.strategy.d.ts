import { Strategy } from 'passport-jwt';
export interface JwtAdminPayload {
    sub: string;
    email: string;
    rol: string;
}
declare const JwtAdminStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtAdminStrategy extends JwtAdminStrategy_base {
    constructor();
    validate(payload: JwtAdminPayload): JwtAdminPayload;
}
export {};
