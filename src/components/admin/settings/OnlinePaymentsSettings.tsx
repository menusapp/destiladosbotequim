import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OnlinePaymentsSettingsProps {
  restaurantId: string;
}

interface PaymentConfig {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  provider: string;
  accept_pix: boolean;
  accept_card: boolean;
  enable_for_delivery: boolean;
  connection_status: string;
  asaas_account_id: string | null;
  asaas_api_key: string | null;
  asaas_wallet_id: string | null;
  asaas_onboarding_url: string | null;
  asaas_account_status: string | null;
  connected_at: string | null;
}

type ViewState = "loading" | "not_connected" | "pending" | "connected";

const OnlinePaymentsSettings = ({ restaurantId }: OnlinePaymentsSettingsProps) => {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formCpfCnpj, setFormCpfCnpj] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPostalCode, setFormPostalCode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formAddressNumber, setFormAddressNumber] = useState("");
  const [formComplement, setFormComplement] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formIncomeValue, setFormIncomeValue] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("online_payment_config")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.asaas_account_id) {
        setConfig(data as PaymentConfig);
        if (data.asaas_api_key && data.connection_status === "connected") {
          setViewState("connected");
        } else {
          setViewState("pending");
        }
      } else {
        setConfig(data as PaymentConfig | null);
        setViewState("not_connected");
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      setViewState("not_connected");
    }
  };

  const handleCreateAccount = async () => {
    if (!formName || !formCpfCnpj || !formEmail || !formPhone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-provision", {
        body: {
          restaurant_id: restaurantId,
          name: formName,
          cpf_cnpj: formCpfCnpj,
          email: formEmail,
          mobile_phone: formPhone,
          address: formAddress,
          address_number: formAddressNumber,
          complement: formComplement,
          province: formProvince,
          postal_code: formPostalCode,
          city: formCity,
          state: formState,
          income_value: formIncomeValue ? parseFloat(formIncomeValue) : undefined,
          birth_date: formBirthDate || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Conta de pagamentos criada com sucesso!");
      await fetchConfig();
    } catch (error: any) {
      console.error("Error creating account:", error);
      toast.error(error.message || "Erro ao criar conta de pagamentos");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (field: string, value: boolean) => {
    if (!config) return;

    setSavingToggles(true);
    try {
      const updateData: Record<string, unknown> = { [field]: value };

      // If enabling, also set enabled = true
      if (field === "enable_for_delivery" && value) {
        updateData.enabled = true;
      }

      const { error } = await supabase
        .from("online_payment_config")
        .update(updateData)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;

      setConfig({ ...config, [field]: value, ...(field === "enable_for_delivery" && value ? { enabled: true } : {}) });
      toast.success("Configuração atualizada!");
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("Erro ao atualizar configuração");
    } finally {
      setSavingToggles(false);
    }
  };

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormAddress(data.logradouro || "");
        setFormProvince(data.bairro || "");
        setFormCity(data.localidade || "");
        setFormState(data.uf || "");
      }
    } catch {
      // Silent fail on CEP lookup
    }
  };

  if (viewState === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pagamentos Online</h2>
        <p className="text-muted-foreground">
          Receba pagamentos via Pix e Cartão de Crédito diretamente no delivery
        </p>
      </div>

      {viewState === "not_connected" && (
        <NotConnectedView
          formName={formName}
          formCpfCnpj={formCpfCnpj}
          formEmail={formEmail}
          formPhone={formPhone}
          formPostalCode={formPostalCode}
          formAddress={formAddress}
          formAddressNumber={formAddressNumber}
          formComplement={formComplement}
          formProvince={formProvince}
          formCity={formCity}
          formState={formState}
          formIncomeValue={formIncomeValue}
          formBirthDate={formBirthDate}
          onNameChange={setFormName}
          onCpfCnpjChange={setFormCpfCnpj}
          onEmailChange={setFormEmail}
          onPhoneChange={setFormPhone}
          onPostalCodeChange={(v) => {
            setFormPostalCode(v);
            handleCepLookup(v);
          }}
          onAddressChange={setFormAddress}
          onAddressNumberChange={setFormAddressNumber}
          onComplementChange={setFormComplement}
          onProvinceChange={setFormProvince}
          onCityChange={setFormCity}
          onStateChange={setFormState}
          onIncomeValueChange={setFormIncomeValue}
          onBirthDateChange={setFormBirthDate}
          onSubmit={handleCreateAccount}
          submitting={submitting}
        />
      )}

      {viewState === "pending" && config && (
        <PendingView config={config} onRefresh={fetchConfig} />
      )}

      {viewState === "connected" && config && (
        <ConnectedView
          config={config}
          onToggle={handleToggle}
          savingToggles={savingToggles}
        />
      )}
    </div>
  );
};

// ─── Not Connected (Onboarding Form) ──────────────────────────

interface NotConnectedViewProps {
  formName: string;
  formCpfCnpj: string;
  formEmail: string;
  formPhone: string;
  formPostalCode: string;
  formAddress: string;
  formAddressNumber: string;
  formComplement: string;
  formProvince: string;
  formCity: string;
  formState: string;
  formIncomeValue: string;
  formBirthDate: string;
  onNameChange: (v: string) => void;
  onCpfCnpjChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onPostalCodeChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onAddressNumberChange: (v: string) => void;
  onComplementChange: (v: string) => void;
  onProvinceChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onIncomeValueChange: (v: string) => void;
  onBirthDateChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

const NotConnectedView = (props: NotConnectedViewProps) => (
  <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Criar Conta de Pagamentos
        </CardTitle>
        <CardDescription>
          Preencha os dados da empresa para ativar pagamentos online via Pix e Cartão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company Data */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Dados da Empresa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome / Razão Social *</Label>
              <Input
                value={props.formName}
                onChange={(e) => props.onNameChange(e.target.value)}
                placeholder="Nome completo ou razão social"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF ou CNPJ *</Label>
              <Input
                value={props.formCpfCnpj}
                onChange={(e) => props.onCpfCnpjChange(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={props.formEmail}
                onChange={(e) => props.onEmailChange(e.target.value)}
                placeholder="email@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone / Celular *</Label>
              <Input
                value={props.formPhone}
                onChange={(e) => props.onPhoneChange(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <Input
                type="date"
                value={props.formBirthDate}
                onChange={(e) => props.onBirthDateChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Obrigatório para pessoa física (CPF)
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Address */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Endereço
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={props.formPostalCode}
                onChange={(e) => props.onPostalCodeChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Rua / Logradouro</Label>
              <Input
                value={props.formAddress}
                onChange={(e) => props.onAddressChange(e.target.value)}
                placeholder="Rua, Avenida..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={props.formAddressNumber}
                onChange={(e) => props.onAddressNumberChange(e.target.value)}
                placeholder="123"
              />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input
                value={props.formComplement}
                onChange={(e) => props.onComplementChange(e.target.value)}
                placeholder="Sala, Andar..."
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={props.formProvince}
                onChange={(e) => props.onProvinceChange(e.target.value)}
                placeholder="Bairro"
              />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                value={props.formCity}
                onChange={(e) => props.onCityChange(e.target.value)}
                placeholder="Cidade"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Input
                value={props.formState}
                onChange={(e) => props.onStateChange(e.target.value)}
                placeholder="SP"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Faturamento Mensal Estimado (R$)</Label>
              <Input
                type="number"
                value={props.formIncomeValue}
                onChange={(e) => props.onIncomeValueChange(e.target.value)}
                placeholder="10000"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={props.onSubmit}
          disabled={props.submitting}
          className="w-full"
          size="lg"
        >
          {props.submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando conta...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Criar Conta de Pagamentos
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  </>
);

// ─── Pending (Waiting for documents/approval) ──────────────

interface PendingViewProps {
  config: PaymentConfig;
  onRefresh: () => void;
}

const PendingView = ({ config, onRefresh }: PendingViewProps) => (
  <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-yellow-500" />
          Conta Criada — Aguardando Ativação
        </CardTitle>
        <CardDescription>
          Sua conta de pagamentos foi criada. Complete o envio de documentos para ativá-la.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
          <div>
            <p className="font-medium text-sm">Documentação pendente</p>
            <p className="text-sm text-muted-foreground">
              Acesse o link abaixo para enviar os documentos necessários e ativar sua conta.
            </p>
          </div>
        </div>

        {config.asaas_onboarding_url && (
          <Button variant="outline" className="w-full" asChild>
            <a href={config.asaas_onboarding_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Enviar Documentos
            </a>
          </Button>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>ID da Conta:</strong> {config.asaas_account_id}</p>
          <p><strong>Status:</strong> {config.asaas_account_status || "pending"}</p>
        </div>

        <Button variant="ghost" onClick={onRefresh} className="w-full">
          Verificar Status
        </Button>
      </CardContent>
    </Card>
  </>
);

// ─── Connected (Active account) ────────────────────────────

interface ConnectedViewProps {
  config: PaymentConfig;
  onToggle: (field: string, value: boolean) => void;
  savingToggles: boolean;
}

const ConnectedView = ({ config, onToggle, savingToggles }: ConnectedViewProps) => (
  <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Pagamentos Online
          </CardTitle>
          <Badge variant="outline" className="border-green-500 text-green-600">
            Conectado
          </Badge>
        </div>
        <CardDescription>
          Sua conta de pagamentos está ativa e pronta para receber
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle: Accept Pix */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Aceitar Pix</Label>
              <p className="text-sm text-muted-foreground">
                Receba pagamentos instantâneos via QR Code Pix
              </p>
            </div>
          </div>
          <Switch
            checked={config.accept_pix ?? true}
            onCheckedChange={(v) => onToggle("accept_pix", v)}
            disabled={savingToggles}
          />
        </div>

        <Separator />

        {/* Toggle: Accept Card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Aceitar Cartão de Crédito</Label>
              <p className="text-sm text-muted-foreground">
                Receba pagamentos com cartão de crédito online
              </p>
            </div>
          </div>
          <Switch
            checked={config.accept_card ?? true}
            onCheckedChange={(v) => onToggle("accept_card", v)}
            disabled={savingToggles}
          />
        </div>

        <Separator />

        {/* Toggle: Enable for Delivery */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label className="font-medium">Ativar no Delivery</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar opções de pagamento online no checkout do delivery
              </p>
            </div>
          </div>
          <Switch
            checked={config.enable_for_delivery ?? true}
            onCheckedChange={(v) => onToggle("enable_for_delivery", v)}
            disabled={savingToggles}
          />
        </div>

        <Separator />

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>ID da Conta:</strong> {config.asaas_account_id}</p>
          <p><strong>Conectado em:</strong> {config.connected_at ? new Date(config.connected_at).toLocaleDateString("pt-BR") : "-"}</p>
        </div>
      </CardContent>
    </Card>
  </>
);

export default OnlinePaymentsSettings;
