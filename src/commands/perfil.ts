import * as usuariosService from '../services/usuariosService';
import * as driverService from '../services/driverService';
import { formatarValor } from '../utils/formatUtils';

async function perfilCommand(sock: any, userId: string) {
  const [usuario, driverProfile, metas] = await Promise.all([
    usuariosService.buscarUsuario(userId),
    driverService.getDriverProfile(userId),
    driverService.getGoals(userId),
  ]);

  let msg = `👤 *Seu Perfil*\n\n`;

  if (usuario) {
    msg += `👤 *Nome:* ${usuario.nome || 'Não informado'}\n`;
    const planoLabel = usuario.plano === 'premium' ? '👑 Premium' : '📱 Gratuito';
    msg += `📊 *Plano:* ${planoLabel}\n`;
    if (usuario.plano === 'premium' && usuario.data_expiracao_premium) {
      const expiracao = new Date(usuario.data_expiracao_premium);
      msg += `⏰ *Expira em:* ${expiracao.toLocaleDateString('pt-BR')}\n`;
    }
    if (usuario.data_cadastro || usuario.criado_em) {
      const dataCadastro = new Date(usuario.data_cadastro || usuario.criado_em);
      msg += `📅 *Cadastrado em:* ${dataCadastro.toLocaleDateString('pt-BR')}\n`;
    }
  } else {
    msg += `⚠️ Usuário não encontrado no sistema.\n`;
  }

  // Perfil driver
  if (driverProfile) {
    const tipos: Record<string, string> = {
      MOTORISTA_APP: 'Motorista de app (Uber, 99)',
      DELIVERY: 'Entregador/Delivery (iFood, Rappi)',
      AMBOS: 'Motorista e entregador',
    };
    msg += `\n🚗 *Perfil Driver*\n`;
    msg += `Tipo: ${tipos[driverProfile.tipo || ''] || 'Não informado'}\n`;
    if (driverProfile.consumo_medio_km_l) {
      msg += `Consumo: ${driverProfile.consumo_medio_km_l} km/L\n`;
    }
    if (driverProfile.combustivel_preferido && driverProfile.custo_combustivel_litro) {
      msg += `Combustível: ${driverProfile.combustivel_preferido} a R$ ${formatarValor(driverProfile.custo_combustivel_litro)}/L\n`;
    }
  } else {
    msg += `\n🚗 *Perfil Driver:* não configurado\n`;
    msg += `_Digite "sou motorista de app" ou "trabalho com delivery" para configurar._\n`;
  }

  // Metas ativas
  if (metas.length > 0) {
    msg += `\n🎯 *Metas ativas*\n`;
    const labelTipo: Record<string, string> = { DIARIA: 'Diária', SEMANAL: 'Semanal', MENSAL: 'Mensal' };
    for (const m of metas) {
      msg += `• Meta ${labelTipo[m.tipo_meta] || m.tipo_meta}: R$ ${formatarValor(m.valor)}\n`;
    }
  } else {
    msg += `\n🎯 *Metas:* nenhuma definida\n`;
    msg += `_Digite "meta diária 300" para definir uma meta de ganhos._\n`;
  }

  msg += `\n💡 Digite *ajuda* para ver todos os comandos`;

  await sock.sendMessage(userId, { text: msg });
}

export default perfilCommand;
