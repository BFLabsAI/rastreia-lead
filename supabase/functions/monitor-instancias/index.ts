import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const UAZAPI_URL = 'https://bflabs.uazapi.com';
const BF_LABS_TESTE_TOKEN = 'f2638174-33c2-471e-8ed6-a75f12b4cb39';
const RASTREIA_LEAD_URL = 'https://rastreia-lead.vercel.app';

interface Instance {
  id: string;
  instance_name: string;
  token: string;
  id_grupo: string;
  status: string;
  link_conexao: string;
}

Deno.serve(async (req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Iniciando monitoramento v11...');

    const { data: instances, error: fetchError } = await supabase
      .from('instances_clientes_bf_labs')
      .select('id, instance_name, token, id_grupo, status, link_conexao')
      .not('id_grupo', 'is', null);

    if (fetchError) {
      throw new Error('Erro ao buscar instancias: ' + fetchError.message);
    }

    console.log('Encontradas ' + (instances?.length || 0) + ' instancias');

    const instanciasDesconectadas: Array<{ name: string; grupo: string }> = [];
    const erros: Array<{ instance: string; error: string }> = [];
    let totalAlertasEnviados = 0;

    for (const instance of (instances || []) as Instance[]) {
      try {
        console.log('Verificando: ' + instance.instance_name);

        const statusResponse = await fetch(UAZAPI_URL + '/instance/status', {
          method: 'GET',
          headers: { 'token': instance.token }
        });

        if (!statusResponse.ok) {
          erros.push({
            instance: instance.instance_name,
            error: 'Erro HTTP ' + statusResponse.status
          });
          continue;
        }

        const statusData = await statusResponse.json();
        const isConnected = statusData?.status?.connected === true;
        const instanceId = statusData?.instance?.id || '';

        // Gerar link de conexao
        const linkConexao = instanceId ? RASTREIA_LEAD_URL + '/connect/' + instanceId : '';

        console.log(instance.instance_name + ': ' + (isConnected ? 'Conectada' : 'Desconectada'));

        // Atualizar status e link no banco
        await supabase
          .from('instances_clientes_bf_labs')
          .update({
            status: isConnected ? 'connected' : 'disconnected',
            updated_at: new Date().toISOString(),
            link_conexao: linkConexao
          })
          .eq('id', instance.id);

        if (!isConnected) {
          instanciasDesconectadas.push({
            name: instance.instance_name,
            grupo: instance.id_grupo
          });

          // Mensagem formatada com emojis e link direto - versao final
          let mensagem =
            '⚠️ *ALERTA DE INSTÂNCIA DESCONECTADA* ⚠️\n\n' +
            '📱 Instância: *' + instance.instance_name + '*\n\n' +
            'A instância do WhatsApp foi desconectada e precisa de atenção.\n\n' +
            '🔧 *Ações necessárias:*\n';

          if (linkConexao) {
            mensagem += '1. Clique no link para conectar:\n' + linkConexao + '\n\n';
            mensagem += '2. Escaneie o QR Code no celular\n';
          } else {
            mensagem += '1. Acesse o Painel do Rastreia Lead: https://rastreialead.com.br\n';
            mensagem += '2. Clique na aba QR Code\n';
            mensagem += '3. Clique em conectar na instância desconectada\n';
            mensagem += '4. Escaneie o QR Code no celular\n';
          }

          mensagem += '\n⏰ *Quanto antes reconectar, melhor!*';

          const sendResponse = await fetch(UAZAPI_URL + '/send/text', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'token': BF_LABS_TESTE_TOKEN
            },
            body: JSON.stringify({
              number: instance.id_grupo,
              text: mensagem
            })
          });

          if (sendResponse.ok) {
            totalAlertasEnviados++;
            console.log('Alerta enviado para: ' + instance.id_grupo);
          } else {
            const errorText = await sendResponse.text();
            erros.push({
              instance: instance.instance_name,
              error: 'Erro ao enviar: ' + errorText
            });
          }
        }

      } catch (instanceError) {
        erros.push({
          instance: instance.instance_name,
          error: instanceError instanceof Error ? instanceError.message : 'Erro'
        });
      }
    }

    await supabase
      .from('cron_monitor_instancias_logs')
      .insert({
        executed_at: new Date().toISOString(),
        total_verificadas: instances?.length || 0,
        total_desconectadas: instanciasDesconectadas.length,
        total_alertas_enviados: totalAlertasEnviados,
        instancias_desconectadas: instanciasDesconectadas,
        erros: erros,
        sucesso: erros.length === 0,
        mensagem: erros.length > 0 ? 'Executado com erros' : 'Sucesso'
      });

    return new Response(JSON.stringify({
      success: true,
      resumo: {
        totalVerificadas: instances?.length || 0,
        totalDesconectadas: instanciasDesconectadas.length,
        totalAlertasEnviados: totalAlertasEnviados
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase
      .from('cron_monitor_instancias_logs')
      .insert({
        executed_at: new Date().toISOString(),
        sucesso: false,
        mensagem: error instanceof Error ? error.message : 'Erro'
      });

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
