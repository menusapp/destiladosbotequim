// Payment Service - Desacoplado do Supabase
// Comunicação exclusiva via HTTP para Edge Functions
// Permite migração futura para VPS própria sem refatorar frontend

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const API_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Helper para headers padrão
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'apikey': API_KEY,
});

// Helper para headers autenticados (usando token do localStorage)
const getAuthHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': API_KEY,
  };
  
  // Tentar obter token de autenticação
  const tokenKey = Object.keys(localStorage).find(key => 
    key.startsWith('sb-') && key.endsWith('-auth-token')
  );
  
  if (tokenKey) {
    try {
      const tokenData = JSON.parse(localStorage.getItem(tokenKey) || '{}');
      if (tokenData.access_token) {
        headers['Authorization'] = `Bearer ${tokenData.access_token}`;
      }
    } catch (e) {
      console.warn('Failed to parse auth token');
    }
  }
  
  return headers;
};

export interface PaymentConfig {
  enabled: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  connectedAt?: string;
  requirePrepayment: boolean;
  acceptPix: boolean;
  acceptCard: boolean;
  enableForDelivery: boolean;
  mpUserId?: string;
}

export interface CreatePaymentRequest {
  restaurantId: string;
  orderId?: string;
  amount: number;
  description: string;
  paymentMethod: 'pix' | 'credit_card';
  customer: {
    name: string;
    email?: string;
    cpf: string;
    phone?: string;
  };
  callbackUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixExpiration?: string;
  checkoutUrl?: string;
  error?: string;
}

export interface PaymentStatus {
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  paidAt?: string;
  paymentMethod?: string;
}

export const paymentService = {
  /**
   * Buscar configuração de pagamento online do restaurante
   */
  async getConfig(restaurantId: string): Promise<PaymentConfig | null> {
    try {
      const res = await fetch(`${BASE_URL}/payment-config?restaurantId=${restaurantId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      
      return res.json();
    } catch (error) {
      console.error('paymentService.getConfig error:', error);
      return null;
    }
  },

  /**
   * Atualizar configuração de pagamento online
   */
  async updateConfig(restaurantId: string, config: Partial<PaymentConfig>): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/payment-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ restaurantId, ...config }),
      });
      
      return res.ok;
    } catch (error) {
      console.error('paymentService.updateConfig error:', error);
      return false;
    }
  },

  /**
   * Iniciar fluxo OAuth do Mercado Pago
   * Retorna URL para redirecionar o usuário
   */
  async startOAuth(restaurantId: string): Promise<{ authUrl?: string; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/payment-oauth`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'authorize', restaurantId }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        return { error: data.error || 'Falha ao iniciar OAuth' };
      }
      
      return data;
    } catch (error) {
      console.error('paymentService.startOAuth error:', error);
      return { error: 'Erro de conexão' };
    }
  },

  /**
   * Processar callback do OAuth (chamado pela Edge Function, não pelo frontend)
   */
  async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/payment-oauth`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'callback', code, state }),
      });
      
      const data = await res.json();
      return { success: res.ok, error: data.error };
    } catch (error) {
      console.error('paymentService.handleOAuthCallback error:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  },

  /**
   * Desconectar conta do Mercado Pago
   */
  async disconnect(restaurantId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/payment-oauth`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'disconnect', restaurantId }),
      });
      
      return res.ok;
    } catch (error) {
      console.error('paymentService.disconnect error:', error);
      return false;
    }
  },

  /**
   * Criar pagamento (chamado pelo cliente no checkout)
   * Suporta Pix e Cartão de Crédito
   */
  async createPayment(data: CreatePaymentRequest): Promise<PaymentResult> {
    try {
      const res = await fetch(`${BASE_URL}/payment-create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        return { success: false, error: result.error || 'Falha ao criar pagamento' };
      }
      
      return result;
    } catch (error) {
      console.error('paymentService.createPayment error:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  },

  /**
   * Consultar status do pagamento (para polling)
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const res = await fetch(`${BASE_URL}/payment-status?paymentId=${paymentId}`, {
        headers: getHeaders(),
      });
      
      if (!res.ok) {
        return { status: 'pending' };
      }
      
      return res.json();
    } catch (error) {
      console.error('paymentService.getPaymentStatus error:', error);
      return { status: 'pending' };
    }
  },

  /**
   * Verificar se pagamento online está disponível para o restaurante
   */
  async isAvailable(restaurantId: string): Promise<boolean> {
    const config = await this.getConfig(restaurantId);
    return config?.enabled === true && config?.connectionStatus === 'connected';
  },

  /**
   * Verificar se Pix está habilitado
   */
  async isPixAvailable(restaurantId: string): Promise<boolean> {
    const config = await this.getConfig(restaurantId);
    return config?.enabled === true && 
           config?.connectionStatus === 'connected' && 
           config?.acceptPix === true;
  },

  /**
   * Verificar se Cartão está habilitado
   */
  async isCardAvailable(restaurantId: string): Promise<boolean> {
    const config = await this.getConfig(restaurantId);
    return config?.enabled === true && 
           config?.connectionStatus === 'connected' && 
           config?.acceptCard === true;
  },
};

export default paymentService;
