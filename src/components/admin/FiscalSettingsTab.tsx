import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { FileText, Upload, Check, Loader2 } from "lucide-react";

interface FiscalSettingsTabProps {
  restaurantId: string;
}

interface FiscalConfig {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio_codigo: string;
  uf: string;
  csc_id: string;
  csc_code: string;
  certificate_password: string;
  certificate_file_path: string;
}

const emptyConfig: FiscalConfig = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  inscricao_estadual: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio_codigo: "",
  uf: "SP",
  csc_id: "",
  csc_code: "",
  certificate_password: "",
  certificate_file_path: "",
};

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const formatCEP = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
};

export default function FiscalSettingsTab({ restaurantId }: FiscalSettingsTabProps) {
  const [config, setConfig] = useState<FiscalConfig>(emptyConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [certificateFileName, setCertificateFileName] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("fiscal_configs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          cnpj: data.cnpj || "",
          razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "",
          inscricao_estadual: data.inscricao_estadual || "",
          email: data.email || "",
          telefone: data.telefone || "",
          cep: data.cep || "",
          logradouro: data.logradouro || "",
          numero: data.numero || "",
          complemento: data.complemento || "",
          bairro: data.bairro || "",
          municipio_codigo: data.municipio_codigo || "",
          uf: data.uf || "SP",
          csc_id: data.csc_id || "",
          csc_code: data.csc_code || "",
          certificate_password: data.certificate_password || "",
          certificate_file_path: data.certificate_file_path || "",
        });
        if (data.certificate_file_path) {
          setCertificateFileName(data.certificate_file_path.split("/").pop() || null);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações fiscais:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FiscalConfig, value: string) => {
    let formatted = value;
    if (field === "cnpj") formatted = formatCNPJ(value);
    if (field === "telefone") formatted = formatPhone(value);
    if (field === "cep") formatted = formatCEP(value);
    setConfig((prev) => ({ ...prev, [field]: formatted }));
  };

  const handleUploadCertificate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pfx")) {
      toast.error("Apenas arquivos .pfx são aceitos");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${restaurantId}/certificate.pfx`;

      const { error } = await supabase.storage
        .from("fiscal-certificates")
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      setConfig((prev) => ({ ...prev, certificate_file_path: filePath }));
      setCertificateFileName(file.name);
      toast.success("Certificado enviado com sucesso");
    } catch (error: any) {
      console.error("Erro ao enviar certificado:", error);
      toast.error("Erro ao enviar certificado");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        ...config,
      };

      const { error } = await supabase
        .from("fiscal_configs")
        .upsert(payload, { onConflict: "restaurant_id" });

      if (error) throw error;
      toast.success("Configurações fiscais salvas com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações fiscais");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Configurações Fiscais</h2>
      </div>

      {/* Dados da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              placeholder="00.000.000/0000-00"
              value={config.cnpj}
              onChange={(e) => handleChange("cnpj", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Razão Social</Label>
            <Input
              placeholder="Razão Social da empresa"
              value={config.razao_social}
              onChange={(e) => handleChange("razao_social", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome Fantasia</Label>
            <Input
              placeholder="Nome Fantasia"
              value={config.nome_fantasia}
              onChange={(e) => handleChange("nome_fantasia", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Estadual</Label>
            <Input
              placeholder="Inscrição Estadual"
              value={config.inscricao_estadual}
              onChange={(e) => handleChange("inscricao_estadual", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={config.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              placeholder="(00) 00000-0000"
              value={config.telefone}
              onChange={(e) => handleChange("telefone", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Endereço Fiscal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endereço Fiscal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              placeholder="00000-000"
              value={config.cep}
              onChange={(e) => handleChange("cep", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Logradouro</Label>
            <Input
              placeholder="Rua, Avenida..."
              value={config.logradouro}
              onChange={(e) => handleChange("logradouro", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input
              placeholder="Nº"
              value={config.numero}
              onChange={(e) => handleChange("numero", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input
              placeholder="Sala, Bloco..."
              value={config.complemento}
              onChange={(e) => handleChange("complemento", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input
              placeholder="Bairro"
              value={config.bairro}
              onChange={(e) => handleChange("bairro", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Código do Município (IBGE)</Label>
            <Input
              placeholder="Ex: 3550308"
              value={config.municipio_codigo}
              onChange={(e) => handleChange("municipio_codigo", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input
              placeholder="SP"
              maxLength={2}
              value={config.uf}
              onChange={(e) => handleChange("uf", e.target.value.toUpperCase())}
            />
          </div>
        </CardContent>
      </Card>

      {/* Certificado Digital */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Certificado Digital (NFC-e)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ID do CSC</Label>
            <Input
              placeholder="ID do CSC"
              value={config.csc_id}
              onChange={(e) => handleChange("csc_id", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Código do CSC</Label>
            <Input
              placeholder="Código do CSC"
              value={config.csc_code}
              onChange={(e) => handleChange("csc_code", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Senha do Certificado</Label>
            <Input
              type="password"
              placeholder="Senha do certificado .pfx"
              value={config.certificate_password}
              onChange={(e) => handleChange("certificate_password", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Certificado Digital (.pfx)</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors">
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : certificateFileName ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span className="text-muted-foreground truncate">
                    {uploading
                      ? "Enviando..."
                      : certificateFileName
                        ? certificateFileName
                        : "Selecionar arquivo .pfx"}
                  </span>
                </div>
                <input
                  type="file"
                  accept=".pfx"
                  className="hidden"
                  onChange={handleUploadCertificate}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          "Salvar Configurações Fiscais"
        )}
      </Button>
    </div>
  );
}
