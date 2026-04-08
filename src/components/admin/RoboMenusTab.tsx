import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Bot, Plus, Trash2, AlertTriangle, Send, RotateCcw, MessageSquare, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RoboMenusTabProps {
  restaurantId: string;
}

interface AiConfig {
  is_active: boolean;
  accept_orders_via_whatsapp: boolean;
  personality: string;
  welcome_message_type: string;
  custom_welcome_message: string;
  instructions: string;
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

const DEFAULT_CONFIG: AiConfig = {
  is_active: false,
  accept_orders_via_whatsapp: false,
  personality: 'friendly',
  welcome_message_type: 'numeric_menu',
  custom_welcome_message: '',
  instructions: '',
};

const DEFAULT_MENU_OPTIONS: Omit<MenuOption, 'id'>[] = [
  { position: 1, label: 'Ver cardápio', action_type: 'send_menu', custom_message: '', is_active: true },
  { position: 2, label: 'Status do pedido', action_type: 'order_status', custom_message: '', is_active: true },
  { position: 3, label: 'Horário de funcionamento', action_type: 'business_hours', custom_message: '', is_active: true },
  { position: 4, label: 'Falar com atendente', action_type: 'human_attendant', custom_message: '', is_active: true },
  { position: 5, label: 'Fazer pedido', action_type: 'start_order', custom_message: '', is_active: true },
];

const PERSONALITIES = [
  { value: 'classic_waiter', label: 'Garçom Clássico', desc: 'Formal e polido, trata por senhor(a)', emoji: '🎩' },
  { value: 'friendly', label: 'Amigável', desc: 'Simpático e descontraído com emojis', emoji: '😊' },
  { value: 'objective', label: 'Objetivo', desc: 'Direto ao ponto, respostas curtas', emoji: '🎯' },
  { value: 'patient', label: 'Paciente', desc: 'Detalhista e calmo, explica tudo', emoji: '🧘' },
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
  { value: 'free_flow', label: 'Fluxo Livre Conversacional', desc: 'O bot diz "Olá! Como posso te ajudar hoje?"' },
  { value: 'link_only', label: 'Apenas o Link Digital', desc: 'Foca 100% em conversão, só entrega o link direto' },
  { value: 'custom', label: 'Totalmente Personalizada', desc: 'Você digita a mensagem de boas-vindas' },
];

const RoboMenusTab = ({ restaurantId }: RoboMenusTabProps) => {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_CONFIG);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  // Simulator state
  const [simMessages, setSimMessages] = useState<SimMessage[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, optionsRes, whatsappRes] = await Promise.all([
        supabase.from('whatsapp_ai_config').select('*').eq('restaurant_id', restaurantId).maybeSingle(),
        supabase.from('whatsapp_menu_options').select('*').eq('restaurant_id', restaurantId).order('position'),
        supabase.from('whatsapp_config').select('instance_status').eq('restaurant_id', restaurantId).maybeSingle(),
      ]);

      if (configRes.data) {
        setConfig({
          is_active: configRes.data.is_active ?? false,
          accept_orders_via_whatsapp: configRes.data.accept_orders_via_whatsapp ?? false,
          personality: configRes.data.personality ?? 'friendly',
          welcome_message_type: configRes.data.welcome_message_type ?? 'numeric_menu',
          custom_welcome_message: configRes.data.custom_welcome_message ?? '',
          instructions: configRes.data.instructions ?? '',
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

      setWhatsappConnected(whatsappRes.data?.instance_status === 'connected');
    } catch (e) {
      console.error('Error loading AI config:', e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert AI config
      const { error: configError } = await supabase
        .from('whatsapp_ai_config')
        .upsert({
          restaurant_id: restaurantId,
          is_active: config.is_active,
          accept_orders_via_whatsapp: config.accept_orders_via_whatsapp,
          personality: config.personality,
          welcome_message_type: config.welcome_message_type,
          custom_welcome_message: config.custom_welcome_message || null,
          instructions: config.instructions || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id' });

      if (configError) throw configError;

      // Delete existing menu options and re-insert
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
    // Delete simulator conversation
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
          <p className="text-sm text-muted-foreground">Atendente virtual IA para WhatsApp</p>
        </div>
      </div>

      {/* Banners */}
      {!whatsappConnected && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">O WhatsApp não está conectado. Conecte um dispositivo nas Notificações WhatsApp.</span>
        </div>
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

          {/* Personality */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalidade</CardTitle>
              <CardDescription>Escolha o tom das respostas do bot</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setConfig(prev => ({ ...prev, personality: p.value }))}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      config.personality === p.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{p.emoji}</span>
                      <span className="font-medium text-sm">{p.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </button>
                ))}
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
              {config.welcome_message_type === 'custom' && (
                <Textarea
                  value={config.custom_welcome_message}
                  onChange={e => setConfig(p => ({ ...p, custom_welcome_message: e.target.value }))}
                  placeholder="Digite sua mensagem de boas-vindas personalizada... Use {{nome_restaurante}} e {{link_cardapio}}"
                  rows={4}
                />
              )}
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
                      <Textarea
                        value={opt.custom_message}
                        onChange={e => updateMenuOption(i, 'custom_message', e.target.value)}
                        placeholder="Mensagem personalizada..."
                        rows={2}
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

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Instruções para a IA
              </CardTitle>
              <CardDescription>Informações que o bot deve considerar nas respostas</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={config.instructions}
                onChange={e => setConfig(p => ({ ...p, instructions: e.target.value }))}
                placeholder="Ex: Não abrimos segundas. Taxa grátis acima de R$100. Não aceitamos cheque..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>

        {/* Right column - Simulator */}
        <div className="lg:sticky lg:top-4 h-fit">
          <Card className="flex flex-col" style={{ height: '600px' }}>
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
