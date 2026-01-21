// Enhanced Supabase client for database operations and real-time subscriptions
// Replaces legacy data fetching with direct Supabase integration
// Includes retry logic, connection optimization, and better error handling

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create optimized Supabase client with custom settings
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true, // Changed to true to persist auth state
    autoRefreshToken: true, // Changed to true for better UX
  },
  global: {
    headers: {
      'Connection': 'keep-alive',
    },
  },
  // Disable real-time if not needed to reduce connection overhead
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface DisparadorData {
  numero: string;
  tipo_envio: string;
  usarIA?: boolean; // Keep as optional for backward compatibility
  usaria?: boolean; // Actual column name in database
  instancia: string;
  texto: string;
  nome_campanha: string;
  publico: string;
  criativo: string;
  tipo_campanha: string;
  created_at?: string;
  id?: number | string; // Changed to allow UUID
  scheduled_for?: string;
  responded_at?: string;
  message_type?: string;
}

interface SaaSLog {
  id: number | string;
  phone_number: string;
  status: string;
  instance_name: string;
  message_content: string;
  campaign_name: string;
  campaign_type: string;
  created_at: string;
  scheduled_for?: string;
  responded_at?: string;
  message_type?: string;
  provider_message_id?: string;
  provider_response?: any;
  metadata?: {
    usaria?: boolean;
    publico?: string;
    criativo?: string;
    ai_rewritten?: boolean;
  };
}

// Helper to map new SaaS schema to legacy interface
const mapSaaSLogToDisparadorData = (log: SaaSLog): DisparadorData => {
  return {
    id: log.id,
    numero: log.phone_number,
    tipo_envio: log.status === 'sent' ? 'sucesso' : (log.status === 'queued' ? 'fila' : 'falha'),
    usaria: log.metadata?.usaria || log.metadata?.ai_rewritten || false,
    usarIA: log.metadata?.usaria || log.metadata?.ai_rewritten || false,
    instancia: log.instance_name,
    texto: log.message_content,
    nome_campanha: log.campaign_name,
    publico: log.metadata?.publico || '',
    criativo: log.metadata?.criativo || '',
    tipo_campanha: log.campaign_type,
    created_at: log.created_at,
    scheduled_for: log.scheduled_for,
    responded_at: log.responded_at,
    message_type: log.message_type || 'texto'
  };
};

// Retry utility for exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      const err = error as { status?: number };
      // Don't retry on client errors (4xx)
      if (err.status && err.status >= 400 && err.status < 500) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
};

import { useAdminStore } from '@/store/adminStore';

// Helper to get effective tenant ID (Impersonated OR Authenticated)
const getEffectiveTenantId = async () => {
  const impersonated = useAdminStore.getState().impersonatedTenantId;
  if (impersonated) return impersonated;

  // Fallback to authenticated user's tenant
  const { data } = await supabase.rpc('get_my_tenant_id');
  return data;
};

// ... (existing imports)

// Fetch paginated data from message_logs_dispara_lead_saas_03 table with retry logic
export async function fetchDisparadorDataPaginated(
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    instance?: string;
    tipo?: string;
    campaign?: string;
    dateStart?: string;
    dateEnd?: string;
  }
): Promise<{ data: DisparadorData[], count: number }> {
  const operation = async () => {
    const tenantId = await getEffectiveTenantId();
    if (!tenantId) {
      console.warn("No tenant ID found for pagination fetch");
      return { data: [], count: 0 };
    }

    // Build the query with optimized column selection
    let query = supabase
      .from('message_logs_dispara_lead_saas_03')
      .select('*', { count: 'exact', head: false })
      .eq('tenant_id', tenantId);

    // Apply filters efficiently
    if (filters?.instance) {
      query = query.eq('instance_name', filters.instance);
    }
    if (filters?.tipo) {
      // Map legacy filter 'sucesso'/'falha' to 'sent'/'failed'
      const status = filters.tipo === 'sucesso' ? 'sent' : (filters.tipo === 'falha' ? 'failed' : filters.tipo);
      query = query.eq('status', status);
    }
    if (filters?.campaign) {
      query = query.eq('campaign_name', filters.campaign);
    }
    if (filters?.dateStart) {
      query = query.gte('created_at', filters.dateStart);
    }
    if (filters?.dateEnd) {
      query = query.lte('created_at', filters.dateEnd);
    }

    // Apply pagination and ordering with proper index hints
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    const mappedData = (data || []).map(mapSaaSLogToDisparadorData);

    return { data: mappedData, count: count || 0 };
  };

  try {
    return await retryWithBackoff(operation, 3, 1000);
  } catch (error) {
    console.error('Failed to fetch paginated data after retries:', error);
    throw new Error('Failed to load data. Please check your connection and try again.');
  }
}

// Fetch recent data with caching
const recentDataCache = new Map<string, { data: DisparadorData[], timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export async function fetchRecentDisparadorData(limit: number = 100): Promise<DisparadorData[]> {
  const impersonatedTenantId = useAdminStore.getState().impersonatedTenantId;
  const cacheKey = `recent_${limit}_${impersonatedTenantId || 'all'}`;
  const cached = recentDataCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const operation = async () => {
    const tenantId = await getEffectiveTenantId();
    if (!tenantId) return [];

    let query = supabase
      .from('message_logs_dispara_lead_saas_03')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .eq('tenant_id', tenantId);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching recent disparador data:', error);
      throw new Error(`Failed to fetch recent data: ${error.message}`);
    }

    return (data || []).map(mapSaaSLogToDisparadorData);
  };

  try {
    const data = await retryWithBackoff(operation, 2, 800);

    // Cache the result
    recentDataCache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    // Return cached data if available, even if expired
    if (cached) {
      console.warn('Returning expired cached data due to fetch failure');
      return cached.data;
    }

    console.error('Failed to fetch recent data after retries:', error);
    throw new Error('Unable to load recent data. Please check your connection.');
  }
}

// Legacy function - now optimized to fetch all data recursively
export async function fetchAllDisparadorData(): Promise<DisparadorData[]> {
  const operation = async () => {
    const tenantId = await getEffectiveTenantId();
    if (!tenantId) return [];

    let allData: DisparadorData[] = [];
    let page = 0;
    const pageSize = 1000; // Supabase default limit
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('message_logs_dispara_lead_saas_03')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)
        .eq('tenant_id', tenantId);

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching disparador data chunk:', error);
        throw new Error(`Failed to fetch data chunk: ${error.message}`);
      }

      if (data) {
        console.log(`Fetched page ${page}, items: ${data.length}`);
        allData = [...allData, ...data.map(mapSaaSLogToDisparadorData)];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`Total items fetched: ${allData.length}`);
    return allData;
  };

  try {
    return await retryWithBackoff(operation, 3, 1000);
  } catch (error) {
    console.error('Failed to fetch all data after retries:', error);
    throw new Error('Unable to load all data. Please check your connection.');
  }
}

// Optimized real-time subscription with connection management
export function subscribeToDisparadorUpdates(
  callback: (data: DisparadorData[]) => void,
  initialLimit: number = 1000
) {
  const isFirstLoad = true;
  let retryCount = 0;
  const maxRetries = 5;

  const createChannel = async () => {
    const tenantId = await getEffectiveTenantId();
    if (!tenantId) return null;

    const filter = `tenant_id=eq.${tenantId}`;

    const channel = supabase
      .channel('message_logs_changes', {
        config: {
          broadcast: { self: false },
          presence: { key: 'dashboard' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_logs_dispara_lead_saas_03',
          filter: filter
        },
        async (payload) => {
          try {
            // Invalidate cache on new data
            recentDataCache.clear();
            statsCache.clear(); // Also clear stats cache

            const recentData = await fetchRecentDisparadorData(initialLimit);
            callback(recentData);
            retryCount = 0; // Reset retry count on success
          } catch (error) {
            console.error('Error handling real-time update:', error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Real-time subscription error');
          handleSubscriptionError();
        }
      });

    return channel;
  };

  const handleSubscriptionError = () => {
    retryCount++;
    if (retryCount <= maxRetries) {
      console.log(`Retrying subscription connection (${retryCount}/${maxRetries})`);
      setTimeout(() => {
        currentChannel = createChannel();
      }, Math.min(1000 * Math.pow(2, retryCount), 10000)); // Max 10 seconds
    } else {
      console.error('Max subscription retries exceeded');
    }
  };

  // Initial fetch
  fetchRecentDisparadorData(initialLimit)
    .then(callback)
    .catch(error => {
      console.error('Initial data fetch failed:', error);
    });

  // Create initial subscription
  let currentChannel: any = null;
  createChannel().then(channel => {
    currentChannel = channel;
  });

  // Return unsubscribe function
  return () => {
    if (currentChannel) {
      supabase.removeChannel(currentChannel);
    }
  };
}

// Optimized dashboard statistics with better caching
const statsCache = new Map<string, { data: any, timestamp: number }>();
const STATS_CACHE_TTL = 60000; // 1 minute

export async function getDashboardStatsOptimized() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get tenant_id
    const { data: userData } = await supabase
      .from('users_dispara_lead_saas_02')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('Tenant not found');

    // Call the RPC function
    const { data, error } = await supabase
      .rpc('get_dashboard_stats', { p_tenant_id: userData.tenant_id });

    if (error) throw error;

    return {
      total: data.total_envios + data.total_queued + data.total_failed, // Total is now sum of all states
      successful: data.total_envios, // This is now strictly 'sent'
      failed: data.total_failed,
      queued: data.total_queued, // Expose queued explicitly
      withAI: data.total_ia,
      responded: data.total_responded,
      responseRate: data.total_envios > 0
        ? (data.total_responded / data.total_envios) * 100
        : 0,
      successRate: (data.total_envios + data.total_failed) > 0
        ? (data.total_envios / (data.total_envios + data.total_failed)) * 100
        : 0,
      instanceStats: {},
      campaignStats: {
        scheduled: data.scheduled_campaigns,
        pending_messages: data.scheduled_messages
      },
      dailyStats: data.daily_stats
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Fallback to empty stats
    return {
      total: 0,
      successful: 0,
      failed: 0,
      queued: 0,
      withAI: 0,
      responded: 0,
      responseRate: 0,
      successRate: 0,
      instanceStats: {},
      campaignStats: {}
    };
  }
}

// Get statistics from the data
export function getDisparadorStats(data: DisparadorData[]) {
  const total = data.length;
  const successful = data.filter(item => item.tipo_envio === 'sucesso').length;
  const queued = data.filter(item => item.tipo_envio === 'fila').length;
  const failed = total - successful - queued;
  const withAI = data.filter(item => item.usaria || item.usarIA).length;

  // Group by instance
  const instanceStats = data.reduce((acc, item) => {
    if (!acc[item.instancia]) {
      acc[item.instancia] = { total: 0, successful: 0, failed: 0, queued: 0 };
    }
    acc[item.instancia].total++;
    if (item.tipo_envio === 'sucesso') {
      acc[item.instancia].successful++;
    } else if (item.tipo_envio === 'fila') {
      acc[item.instancia].queued = (acc[item.instancia].queued || 0) + 1;
    } else {
      acc[item.instancia].failed++;
    }
    return acc;
  }, {} as Record<string, { total: number; successful: number; failed: number; queued?: number }>);

  // Group by campaign
  const campaignStats = data.reduce((acc, item) => {
    if (!acc[item.nome_campanha]) {
      acc[item.nome_campanha] = { total: 0, successful: 0, failed: 0, withAI: 0, queued: 0 };
    }
    acc[item.nome_campanha].total++;
    if (item.tipo_envio === 'sucesso') {
      acc[item.nome_campanha].successful++;
    } else if (item.tipo_envio === 'fila') {
      acc[item.nome_campanha].queued = (acc[item.nome_campanha].queued || 0) + 1;
    } else {
      acc[item.nome_campanha].failed++;
    }
    if (item.usaria || item.usarIA) {
      acc[item.nome_campanha].withAI++;
    }
    return acc;
  }, {} as Record<string, { total: number; successful: number; failed: number; withAI: number; queued?: number }>);

  return {
    total,
    successful,
    failed,
    queued,
    withAI,
    successRate: (successful + failed) > 0 ? (successful / (successful + failed)) * 100 : 0, // Exclude queued from rate
    instanceStats,
    campaignStats
  };
}

// Connection health check utility
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('message_logs_dispara_lead_saas_03')
      .select('id')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Connection check failed:', error);
    return false;
  }
}

// Clear all caches (useful for force refresh)
export function clearAllCaches() {
  recentDataCache.clear();
  statsCache.clear();
}

// Fetch campaign statistics
export async function fetchCampaignStats() {
  const tenantId = await getEffectiveTenantId();
  if (!tenantId) return [];

  let query = supabase
    .from('campaigns_dispara_lead_saas_02')
    .select('*')
    .eq('tenant_id', tenantId);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching campaign stats:', error);
    throw new Error(`Failed to fetch campaign stats: ${error.message}`);
  }

  return data || [];
}