import { formatarValor } from '../utils/formatUtils';
import * as driverService from '../services/driverService';
import { logger } from '../infrastructure/logger';

function removerAcentos(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizar(t: string) {
  return removerAcentos(String(t || '').toLowerCase()).trim();
}

function extrairNumero(norm: string): number | null {
  const match = norm.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const v = parseFloat(match[1].replace(',', '.'));
  return isNaN(v) || v <= 0 ? null : v;
}

async function mostrarPerfil(sock: any, userId: string): Promise<void> {
  const perfil = await driverService.getDriverProfile(userId);
  if (!perfil) {
    await sock.sendMessage(userId, {
      text:
        '🚗 *Perfil Driver*\n\n' +
        'Você ainda não tem um perfil configurado.\n\n' +
        'Para configurar:\n' +
        '• "sou motorista de app"\n' +
        '• "trabalho com delivery"\n' +
        '• "meu carro faz 10 km por litro"\n' +
        '• "gasolina está 6,20"\n\n' +
        'O perfil ajuda o Simplou a entender melhor seus lançamentos.',
    });
    return;
  }

  let msg = '🚗 *Seu perfil Driver*\n\n';
  if (perfil.tipo) {
    const tipos: Record<string, string> = {
      MOTORISTA_APP: 'Motorista de app (Uber, 99)',
      DELIVERY: 'Entregador/Delivery',
      AMBOS: 'Motorista e entregador',
    };
    msg += `Tipo: ${tipos[perfil.tipo] || perfil.tipo}\n`;
  }
  if (perfil.veiculo) msg += `Veículo: ${perfil.veiculo}\n`;
  if (perfil.consumo_medio_km_l) msg += `Consumo médio: ${perfil.consumo_medio_km_l} km/L\n`;
  if (perfil.combustivel_preferido) msg += `Combustível: ${perfil.combustivel_preferido}\n`;
  if (perfil.custo_combustivel_litro) {
    msg += `Preço do litro: R$ ${formatarValor(perfil.custo_combustivel_litro)}\n`;
  }
  msg += '\nPara atualizar, envie qualquer informação novamente.';
  await sock.sendMessage(userId, { text: msg });
}

export async function driverPerfilCommand(sock: any, userId: string, texto: string): Promise<void> {
  const norm = normalizar(texto);

  try {
    // Ver perfil
    if (
      ['perfil driver', 'ver perfil', 'meu perfil driver', 'configurar perfil'].includes(norm) ||
      norm === 'perfil'
    ) {
      return await mostrarPerfil(sock, userId);
    }

    // Tipo de trabalho
    if (/\bsou\s+motorista\s+de\s+app\b/.test(norm) || /\buber\b/.test(norm) && /\bsou\b/.test(norm)) {
      await driverService.upsertDriverProfile(userId, { tipo: 'MOTORISTA_APP' });
      await sock.sendMessage(userId, {
        text:
          '✅ Perfil atualizado: *Motorista de app*\n\n' +
          'Agora entendo melhor frases como:\n' +
          '• "ganhei 280 no uber"\n' +
          '• "fiz 150 na 99"\n' +
          '• "abasteci 180"\n\n' +
          'Quer configurar mais? "meu carro faz 10 km por litro"',
      });
      return;
    }

    if (/\btrabalho\s+com\s+delivery\b/.test(norm) || /\bsou\s+entregador\b/.test(norm)) {
      await driverService.upsertDriverProfile(userId, { tipo: 'DELIVERY' });
      await sock.sendMessage(userId, {
        text:
          '✅ Perfil atualizado: *Entregador/Delivery*\n\n' +
          'Agora entendo melhor frases como:\n' +
          '• "recebi 90 no ifood"\n' +
          '• "fiz 45 de entrega particular"\n\n' +
          'Quer configurar mais? "meu carro faz 10 km por litro"',
      });
      return;
    }

    // Consumo médio: "meu carro faz 10 km por litro"
    const matchConsumo = norm.match(/faz\s+(\d+(?:[.,]\d+)?)\s*km/);
    if (matchConsumo) {
      const consumo = parseFloat(matchConsumo[1].replace(',', '.'));
      await driverService.upsertDriverProfile(userId, { consumo_medio_km_l: consumo });
      await sock.sendMessage(userId, {
        text: `✅ Consumo médio salvo: ${consumo} km/L`,
      });
      return;
    }

    // Preço do combustível: "gasolina está 6,20"
    const matchPreco = /(gasolina|etanol|diesel|combustivel)\s+(est[aá]|[eé]|custa)\s+[\d.,]+/.exec(norm);
    if (matchPreco) {
      const valor = extrairNumero(norm.slice(matchPreco.index + matchPreco[0].indexOf(' ')));
      const tipo = matchPreco[1];
      if (valor) {
        await driverService.upsertDriverProfile(userId, {
          combustivel_preferido: tipo,
          custo_combustivel_litro: valor,
        });
        await sock.sendMessage(userId, {
          text: `✅ Preço salvo: ${tipo} a R$ ${formatarValor(valor)}/L`,
        });
        return;
      }
    }

    // Fallback: mostrar perfil
    await mostrarPerfil(sock, userId);
  } catch (err) {
    logger.error({ err }, '[DRIVER_PERFIL] Erro');
    await sock.sendMessage(userId, { text: '❌ Erro ao processar. Tente novamente.' });
  }
}
