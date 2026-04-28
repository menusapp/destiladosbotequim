import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Bot, Plus, Trash2, AlertTriangle, Send, RotateCcw, MessageSquare, UserCheck, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface RoboMenusTabProps {
  restaurantId: string;
}

interface AiConfig {
  is_active: boolean;
  accept_orders_via_whatsapp: boolean;
  welcome_message_type: string;
}

interface MenuOption {
  id?: string;
  position: number;
  label: string;
  action_type: string;
  custom_message: string;
  is_active: boolean;
}

interface SimMessage {
  role: 'user' | 'bot';
  text: string;
}

interface PausedConversation {
  id: string;
  customer_phone: string;
  bot_paused_until: string;
  paused_reason: string | null;
}

const DEFAULT_CONFIG: AiConfig = {
  is_active: false,
  accept_orders_via_whatsapp: false,
  welcome_message_type: 'numeric_menu',
};

const DEFAULT_MENU_OPTIONS: Omit<MenuOption, 'id'>[] = [
  { position: 1, label: 'Ver cardápio', action_type: 'send_menu', custom_message: '', is_active: true },
  { position: 2, label: 'Status do pedido', action_type: 'order_status', custom_message: '', is_active: true },
  { position: 3, label: 'Horário de funcionamento', action_type: 'business_hours', custom_message: '', is_active: true },
  { position: 4, label: 'Falar com atendente', action_type: 'human_attendant', custom_message: '', is_active: true },
  { position: 5, label: 'Fazer pedido', action_type: 'start_order', custom_message: '', is_active: true },
];

const ACTION_TYPES = [
  { value: 'send_menu', label: 'Enviar link do cardápio' },
  { value: 'order_status', label: 'Status do pedido' },
  { value: 'business_hours', label: 'Horário de funcionamento' },
  { value: 'human_attendant', label: 'Transferir para atendente' },
  { value: 'start_order', label: 'Iniciar pedido' },
  { value: 'custom_message', label: 'Mensagem personalizada' },
];

const WELCOME_TYPES = [
  { value: 'numeric_menu', label: 'Menu Numérico Padrão', desc: 'Entrega o link do cardápio e lista as opções principais' },
  { value: 'link_only', label: 'Apenas o Link Digital', desc: 'Foca 100% em conversão, só entrega o link direto' },
];

function formatTimeRemaining(until: string): string {
  const diff = new Date(until).getTime() - Date.now();
  if (diff <= 0) return 'expirando...';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min restantes`;
  return `${m}min restantes`;
}

const RoboMenusTab = ({ restaurantId }: RoboMenusTabProps) => {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_CONFIG);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [pausedConversations, setPausedConversations] = useState<PausedConversation[]>([]);

  // Simulator state
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  const loadPausedConversations = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('id, customer_phone, bot_paused_until, paused_reason')
      .eq('restaurant_id', restaurantId)
      .eq('bot_paused', true)
      .not('bot_paused_until', 'is', null);
    
    if (data) {
      // Filter only those still active
      const active = data.filter((c: any) => new Date(c.bot_paused_until) > new Date());
      setPausedConversations(active as PausedConversation[]);
    }
  }, [restaurantId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, optionsRes] = await Promise.all([
        supabase.from('whatsapp_ai_config').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
        supabase.from('whatsapp_menu_options').select('*').eq('restaurant_id', restaurantId).order('position'),
      ]);

      if (configRes.data) {
        setConfig({
          is_active: configRes.data.is_active ?? false,
          accept_orders_via_whatsapp: configRes.data.accept_orders_via_whatsapp ?? false,
          welcome_message_type: configRes.data.welcome_message_type ?? 'numeric_menu',
        });
      }

      if (optionsRes.data && optionsRes.data.length > 0) {
        setMenuOptions(optionsRes.data.map((o: any) => ({
          id: o.id,
          position: o.position,
          label: o.label,
          action_type: o.action_type,
          custom_message: o.custom_message ?? '',
          is_active: o.is_active ?? true,
        })));
      } else {
        setMenuOptions(DEFAULT_MENU_OPTIONS.map(o => ({ ...o })));
      }

      try {
        const statusRes = await fetch(`https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/whatsapp-instance?restaurantId=${restaurantId}`);
        const statusData = await statusRes.json();
        setWhatsappConnected(statusData.status === 'connected');
      } catch {
        const { data: whatsappData } = await supabase.from('whatsapp_config').select('instance_status').eq('restaurant_id', restaurantId).maybeSingle();
        setWhatsappConnected(whatsappData?.instance_status === 'connected');
      }

      await loadPausedConversations();
    } catch (e) {
      console.error('Error loading AI config:', e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, loadPausedConversations]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReactivateBot = async (conversationId: string) => {
    await supabase
      .from('whatsapp_conversations')
      .update({
        bot_paused: false,
        bot_paused_until: null,
        paused_reason: null,
        current_step: 'welcome',
      })
      .eq('id', conversationId);
    
    toast.success('Bot reativado para este contato!');
    await loadPausedConversations();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: configError } = await supabase
        .from('whatsapp_ai_config')
        .upsert({
          restaurant_id: restaurantId,
          is_active: config.is_active,
          accept_orders_via_whatsapp: config.accept_orders_via_whatsapp,
          personality: 'objective',
          welcome_message_type: config.welcome_message_type,
          custom_welcome_message: null,
          instructions: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id' });

      if (configError) throw configError;

      await supabase.from('whatsapp_menu_options').delete().eq('restaurant_id', restaurantId);

      if (menuOptions.length > 0) {
        const { error: optionsError } = await supabase
          .from('whatsapp_menu_options')
          .insert(menuOptions.map((o, i) => ({
            restaurant_id: restaurantId,
            position: i + 1,
            label: o.label,
            action_type: o.action_type,
            custom_message: o.action_type === 'custom_message' ? o.custom_message : null,
            is_active: o.is_active,
          })));
        if (optionsError) throw optionsError;
      }

      toast.success('Configurações salvas com sucesso!');
      loadData();
    } catch (e: any) {
      console.error('Save error:', e);
      toast.error('Erro ao salvar: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  const addMenuOption = () => {
    setMenuOptions(prev => [...prev, {
      position: prev.length + 1,
      label: '',
      action_type: 'custom_message',
      custom_message: '',
      is_active: true,
    }]);
  };

  const removeMenuOption = (index: number) => {
    setMenuOptions(prev => prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, position: i + 1 })));
  };

  const updateMenuOption = (index: number, field: keyof MenuOption, value: any) => {
    setMenuOptions(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  // Simulator
  const handleSimSend = async () => {
    if (!simInput.trim()) return;
    const userMsg = simInput.trim();
    setSimInput('');
    setSimMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSimLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-ai-bot', {
        body: {
          restaurant_id: restaurantId,
          customer_phone: 'simulator',
          message_text: userMsg,
          simulate: true,
        }
      });

      if (error) throw error;
      const botText = data?.response || 'Sem resposta.';
      setSimMessages(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (e: any) {
      setSimMessages(prev => [...prev, { role: 'bot', text: `Erro: ${e.message}` }]);
    } finally {
      setSimLoading(false);
    }
  };

  const resetSimulator = async () => {
    await supabase
      .from('whatsapp_conversations')
      .delete()
      .eq('restaurant_id', restaurantId)
      .eq('customer_phone', 'simulator');
    setSimMessages([]);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        {[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Robô Menu's</h2>
          <p className="text-sm text-muted-foreground">Atendente virtual para WhatsApp</p>
        </div>
      </div>

      {!whatsappConnected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">O WhatsApp não está conectado. Conecte um dispositivo nas Notificações WhatsApp.</span>
        </div>
      )}

      {/* Paused conversations */}
      {pausedConversations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Atendimentos Humanos Ativos
            </CardTitle>
            <CardDescription>Contatos com bot pausado aguardando atendimento humano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pausedConversations.map((conv) => (
              <div key={conv.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{conv.customer_phone}</span>
                  <Badge variant="warning" className="text-xs">
                    Atendimento humano
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeRemaining(conv.bot_paused_until)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReactivateBot(conv.id)}
                  className="gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reativar bot
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column - Configuration */}
        <div className="space-y-6">
          {/* Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>IA Ativa</Label>
                  <p className="text-xs text-muted-foreground">Ativa o atendente virtual no WhatsApp</p>
                </div>
                <Switch checked={config.is_active} onCheckedChange={v => setConfig(p => ({ ...p, is_active: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Aceitar Pedidos via WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Permite iniciar pedidos pela conversa</p>
                </div>
                <Switch checked={config.accept_orders_via_whatsapp} onCheckedChange={v => setConfig(p => ({ ...p, accept_orders_via_whatsapp: v }))} />
              </div>
            </CardContent>
          </Card>

          {/* Welcome message */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mensagem de Boas-Vindas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {WELCOME_TYPES.map(w => (
                <label key={w.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  config.welcome_message_type === w.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}>
                  <input
                    type="radio"
                    name="welcome_type"
                    value={w.value}
                    checked={config.welcome_message_type === w.value}
                    onChange={() => setConfig(p => ({ ...p, welcome_message_type: w.value }))}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-sm">{w.label}</span>
                    <p className="text-xs text-muted-foreground">{w.desc}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Menu options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Menu do WhatsApp
              </CardTitle>
              <CardDescription>Configure as opções numeradas que o cliente verá</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {menuOptions.map((opt, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
                  <span className="mt-2 font-bold text-sm text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={opt.label}
                      onChange={e => updateMenuOption(i, 'label', e.target.value)}
                      placeholder="Nome da opção"
                      className="h-8 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Select value={opt.action_type} onValueChange={v => updateMenuOption(i, 'action_type', v)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_TYPES.map(a => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Switch
                        checked={opt.is_active}
                        onCheckedChange={v => updateMenuOption(i, 'is_active', v)}
                      />
                    </div>
                    {opt.action_type === 'custom_message' && (
                      <Input
                        value={opt.custom_message}
                        onChange={e => updateMenuOption(i, 'custom_message', e.target.value)}
                        placeholder="Mensagem personalizada..."
                        className="text-sm"
                      />
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 mt-0.5" onClick={() => removeMenuOption(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMenuOption} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova opção
              </Button>
            </CardContent>
          </Card>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        {/* Right column - Simulator */}
        <div className="lg:sticky lg:top-4 h-fit">
          <Card data-tour="robo-simulator" className="flex flex-col" style={{ height: '600px' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Simulador
                </span>
                <Button variant="ghost" size="sm" onClick={resetSimulator}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Resetar
                </Button>
              </CardTitle>
              <CardDescription>Teste o bot sem enviar mensagens reais</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-3 pt-0 min-h-0">
              <ScrollArea className="flex-1 pr-2 mb-3">
                <div className="space-y-3 py-2">
                  {simMessages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Envie "oi" para iniciar a conversa
                    </p>
                  )}
                  {simMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {simLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                        Digitando...
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={simInput}
                  onChange={e => setSimInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSimSend()}
                  placeholder="Digite uma mensagem..."
                  disabled={simLoading}
                  className="h-9 text-sm"
                />
                <Button size="icon" onClick={handleSimSend} disabled={simLoading || !simInput.trim()} className="h-9 w-9 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoboMenusTab;
