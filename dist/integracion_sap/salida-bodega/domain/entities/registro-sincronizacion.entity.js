"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistroSincronizacion = exports.ESTADOS_REINTENTABLES = exports.ESTADOS_TERMINALES = void 0;
exports.ESTADOS_TERMINALES = ['validado_odoo'];
exports.ESTADOS_REINTENTABLES = [
    'error_sap', 'error_mapeo', 'error_stock_insuficiente', 'error_odoo',
];
class RegistroSincronizacion {
    esTerminal() {
        return exports.ESTADOS_TERMINALES.includes(this.estado);
    }
    puedeReintentarse() {
        return exports.ESTADOS_REINTENTABLES.includes(this.estado);
    }
    transicionar(nuevoEstado, error) {
        if (this.esTerminal()) {
            throw new Error(`No se puede transicionar desde estado terminal: ${this.estado}`);
        }
        this.estado = nuevoEstado;
        this.ultimoError = error ?? null;
        this.updatedAt = new Date();
    }
}
exports.RegistroSincronizacion = RegistroSincronizacion;
//# sourceMappingURL=registro-sincronizacion.entity.js.map