import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const body = await req.json();
        const { lead_id, backfill_all } = body;

        // If backfill_all is true, calculate status for all leads
        if (backfill_all) {
            const { data: allLeads, error: leadsError } = await supabase
                .from('relatorio_leads_cliente')
                .select('id');

            if (leadsError) throw leadsError;

            const results = [];
            for (const lead of allLeads || []) {
                const status = await calculateLeadStatus(supabase, lead.id);
                results.push({ lead_id: lead.id, status });
            }

            return new Response(JSON.stringify({ success: true, updated: results.length, results }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Single lead update
        if (!lead_id) {
            return new Response(JSON.stringify({ error: 'lead_id is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const status = await calculateLeadStatus(supabase, lead_id);

        return new Response(JSON.stringify({ success: true, lead_id, status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

async function calculateLeadStatus(supabase: any, leadId: string): Promise<string> {
    // Fetch all messages for this lead, ordered by sent_at
    const { data: messages, error } = await supabase
        .from('messages_relatorios_clientes')
        .select('direction, sent_at')
        .eq('lead_id', leadId)
        .order('sent_at', { ascending: true });

    if (error) {
        console.error('Error fetching messages:', error);
        return 'Novo';
    }

    if (!messages || messages.length === 0) {
        await updateLeadStatus(supabase, leadId, 'Novo');
        return 'Novo';
    }

    // Count alternating exchanges
    // An exchange is counted when direction changes from previous message
    let alternatingCount = 0;
    let lastDirection: string | null = null;
    let hasOutboundThenInbound = false;

    for (const msg of messages) {
        if (lastDirection !== null && msg.direction !== lastDirection) {
            alternatingCount++;

            // Check for "Conectado" condition: outbound followed by inbound
            if (lastDirection === 'outbound' && msg.direction === 'inbound') {
                hasOutboundThenInbound = true;
            }
        }
        lastDirection = msg.direction;
    }

    // Determine status based on alternating count
    let status = 'Novo';

    if (alternatingCount >= 10) {
        status = 'SuperEngajado';
    } else if (alternatingCount >= 4) {
        status = 'Engajado';
    } else if (hasOutboundThenInbound || alternatingCount >= 1) {
        status = 'Conectado';
    }

    await updateLeadStatus(supabase, leadId, status);
    return status;
}

async function updateLeadStatus(supabase: any, leadId: string, status: string) {
    const { error } = await supabase
        .from('relatorio_leads_cliente')
        .update({ lead_status: status })
        .eq('id', leadId);

    if (error) {
        console.error('Error updating lead status:', error);
    }
}
