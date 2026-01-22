-- Migration: Add lead_status column to relatorio_leads_cliente
-- Status values: 'Novo', 'Conectado', 'Engajado', 'SuperEngajado'

ALTER TABLE relatorio_leads_cliente 
ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'Novo';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_leads_status ON relatorio_leads_cliente(lead_status);

-- Comment for documentation
COMMENT ON COLUMN relatorio_leads_cliente.lead_status IS 'Lead engagement status: Novo, Conectado, Engajado, SuperEngajado';
