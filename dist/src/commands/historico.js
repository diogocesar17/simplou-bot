"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const formatUtils_1 = require("../utils/formatUtils");
const dataUtils_1 = require("../utils/dataUtils");
const lancamentosService = __importStar(require("../services/lancamentosService"));
const stateManager_1 = require("../configs/stateManager");
async function historicoCommand(sock, userId, texto) {
    const textoLower = texto.toLowerCase().trim();
    // Extrai o possível período após o comando
    const partes = texto.trim().split(/\s+/);
    let mesAno = null;
    let limite = 10; // padrão
    if (partes.length > 1) {
        const resto = partes.slice(1).join(' ');
        mesAno = (0, dataUtils_1.parseMesAno)(resto);
        if (mesAno)
            limite = 20;
    }
    let ultimos;
    if (mesAno) {
        ultimos = await lancamentosService.listarLancamentos(userId, limite, mesAno.mes, mesAno.ano);
        if (!ultimos || ultimos.length === 0) {
            await sock.sendMessage(userId, { text: `Nenhum lançamento encontrado para ${(0, dataUtils_1.getNomeMes)(mesAno.mes - 1)}/${mesAno.ano}.` });
            return;
        }
    }
    else {
        ultimos = await lancamentosService.listarLancamentos(userId, limite);
        if (!ultimos || ultimos.length === 0) {
            await sock.sendMessage(userId, { text: 'Nenhum lançamento encontrado.' });
            return;
        }
    }
    let msgHist = mesAno
        ? `📋 *Histórico ${(0, dataUtils_1.getNomeMes)(mesAno.mes - 1)}/${mesAno.ano}:*\n`
        : '📋 *Últimos lançamentos:*\n';
    ultimos.forEach((l, idx) => {
        const dataBR = (l.data instanceof Date)
            ? l.data.toLocaleDateString('pt-BR')
            : (typeof l.data === 'string' && l.data.match(/\d{4}-\d{2}-\d{2}/)
                ? new Date(l.data).toLocaleDateString('pt-BR')
                : l.data);
        msgHist += `${idx + 1}. ️${dataBR} | 💰 R$ ${(0, formatUtils_1.formatarValor)(l.valor)} | 📂 ${l.categoria} | 💳 ${l.pagamento}`;
        if (l.tipoAgrupamento === 'parcelado') {
            msgHist += ` | 📦 Parcelado: ${l.total_parcelas}x de R$ ${(0, formatUtils_1.formatarValor)(l.grupo && l.grupo[0] ? l.grupo[0].valor : 0)}`;
        }
        if (l.tipoAgrupamento === 'recorrente') {
            msgHist += ` | 🔁 Recorrente: ${l.grupo ? l.grupo.length : 0}x`;
        }
        if (l.descricao)
            msgHist += ` | 📝 ${l.descricao}`;
        msgHist += '\n';
    });
    // Salvar lista no estado para permitir exclusão
    await (0, stateManager_1.definirEstado)(userId, 'historico_exibido', {
        lista: ultimos,
        mesAno: mesAno,
        timestamp: Date.now()
    });
    let msgFinal = msgHist + '\nPara editar, envie: Editar <número>\nPara excluir, envie: Excluir <número>';
    if (!mesAno) {
        msgFinal += '\n\n💡 *Dica:* Para ver todos os lançamentos de um mês específico, envie:\n"Histórico [mês] [ano]" (ex: "Histórico julho 2025")';
    }
    await sock.sendMessage(userId, { text: msgFinal });
}
exports.default = historicoCommand;
//# sourceMappingURL=historico.js.map