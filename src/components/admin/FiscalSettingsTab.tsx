import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { FileText, Upload, Check, Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";

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
  cnpj: "", razao_social: "", nome_fantasia: "", inscricao_estadual: "",
  email: "", telefone: "", cep: "", logradouro: "", numero: "",
  complemento: "", bairro: "", municipio_codigo: "", uf: "SP",
  csc_id: "", csc_code: "", certificate_password: "", certificate_file_path: "",
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [nuvemFiscalStatus, setNuvemFiscalStatus] = useState<string>("pending");

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
          cnpj: data.cnpj || "", razao_social: data.razao_social || "",
          nome_fantasia: data.nome_fantasia || "", inscricao_estadual: data.inscricao_estadual || "",
          email: data.email || "", telefone: data.telefone || "",
          cep: data.cep || "", logradouro: data.logradouro || "",
          numero: data.numero || "", complemento: data.complemento || "",
          bairro: data.bairro || "", municipio_codigo: data.municipio_codigo || "",
          uf: data.uf || "SP", csc_id: data.csc_id || "",
          csc_code: data.csc_code || "", certificate_password: data.certificate_password || "",
          certificate_file_path: data.certificate_file_path || "",
        });
        setNuvemFiscalStatus((data as any).nuvem_fiscal_status || "pending");
        if (data.certificate_file_path) {
          setExistingFileName(data.certificate_file_path.split("/").pop() || null);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações fiscais:", error);
      toast.error("Erro ao carregar configurações fiscais");
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pfx")) {
      toast.error("Apenas arquivos .pfx são aceitos");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleSave = async () => {
    console.log('Botão clicado, iniciando submit', config);
    setIsSubmitting(true);
    try {
      let certificatePath = config.certificate_file_path;

      // 1. Upload new certificate if selected
      if (selectedFile) {
        const filePath = `${restaurantId}/certificate.pfx`;
        const { error: uploadError } = await supabase.storage
          .from("fiscal-certificates")
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        certificatePath = filePath;
        toast.success("Certificado enviado com sucesso");
      }

      // 2. Upsert fiscal config
      const payload = {
        restaurant_id: restaurantId,
        ...config,
        certificate_file_path: certificatePath,
      };

      const { error } = await supabase
        .from("fiscal_configs")
        .upsert(payload, { onConflict: "restaurant_id" });

      if (error) throw error;

      // Update local state
      setConfig((prev) => ({ ...prev, certificate_file_path: certificatePath }));
      if (selectedFile) {
        setExistingFileName(selectedFile.name);
        setSelectedFile(null);
      }

      toast.success("Configurações fiscais salvas com sucesso!");

      // 3. Sync company with Nuvem Fiscal
      toast.info("Sincronizando empresa com a Receita...");
      try {
        const { data: nfData, error: nfError } = await supabase.functions.invoke(
          "nuvem-fiscal-company",
          { body: { restaurantId } }
        );

        if (nfError) {
          const errMsg = typeof nfError === 'string' ? nfError : nfError?.message || "Erro desconhecido";
          console.error("Erro ao chamar nuvem-fiscal-company:", errMsg);
          toast.error(`Erro ao sincronizar: ${errMsg}`);
        } else if (nfData && !nfData.success) {
          console.error("Nuvem Fiscal retornou erro:", nfData.error);
          toast.error(nfData.error || "Erro na sincronização fiscal");
        } else {
          toast.success("Empresa sincronizada com a Nuvem Fiscal!");
          await fetchConfig();
        }
      } catch (invokeErr: any) {
        console.error("Exceção ao invocar edge function:", invokeErr);
        toast.error("Falha na comunicação com o servidor fiscal");
      }
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error?.message || "Erro ao salvar configurações fiscais");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayFileName = selectedFile?.name || existingFileName;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Configurações Fiscais</h2>
      </div>

      {/* Status da Nuvem Fiscal */}
      {nuvemFiscalStatus === "synced" ? (
        <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/30">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400 font-medium ml-2">
            ✅ Empresa Sincronizada e Ativa na Nuvem Fiscal
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-400 font-medium ml-2">
            Empresa pendente de sincronização com a Sefaz
          </AlertDescription>
        </Alert>
      )}

      {/* Dados da Empresa */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Dados da Empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input placeholder="00.000.000/0000-00" value={config.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Razão Social</Label>
            <Input placeholder="Razão Social da empresa" value={config.razao_social} onChange={(e) => handleChange("razao_social", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nome Fantasia</Label>
            <Input placeholder="Nome Fantasia" value={config.nome_fantasia} onChange={(e) => handleChange("nome_fantasia", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Estadual</Label>
            <Input placeholder="Inscrição Estadual" value={config.inscricao_estadual} onChange={(e) => handleChange("inscricao_estadual", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@empresa.com" value={config.email} onChange={(e) => handleChange("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input placeholder="(00) 00000-0000" value={config.telefone} onChange={(e) => handleChange("telefone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Endereço Fiscal */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Endereço Fiscal</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input placeholder="00000-000" value={config.cep} onChange={(e) => handleChange("cep", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Logradouro</Label>
            <Input placeholder="Rua, Avenida..." value={config.logradouro} onChange={(e) => handleChange("logradouro", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input placeholder="Nº" value={config.numero} onChange={(e) => handleChange("numero", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input placeholder="Sala, Bloco..." value={config.complemento} onChange={(e) => handleChange("complemento", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input placeholder="Bairro" value={config.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Código do Município (IBGE)</Label>
            <Input placeholder="Ex: 3550308" value={config.municipio_codigo} onChange={(e) => handleChange("municipio_codigo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input placeholder="SP" maxLength={2} value={config.uf} onChange={(e) => handleChange("uf", e.target.value.toUpperCase())} />
          </div>
        </CardContent>
      </Card>

      {/* Certificado Digital */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Certificado Digital (NFC-e)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>ID do CSC</Label>
            <Input placeholder="ID do CSC" value={config.csc_id} onChange={(e) => handleChange("csc_id", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Código do CSC</Label>
            <Input placeholder="Código do CSC" value={config.csc_code} onChange={(e) => handleChange("csc_code", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Senha do Certificado</Label>
            <Input type="password" placeholder="Senha do certificado .pfx" value={config.certificate_password} onChange={(e) => handleChange("certificate_password", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Certificado Digital (.pfx)</Label>
            {displayFileName ? (
              <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 text-sm bg-muted/50">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate flex-1">{displayFileName}</span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-muted-foreground">Selecionar arquivo .pfx</span>
                </div>
                <input type="file" accept=".pfx" className="hidden" onChange={handleFileSelect} />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSubmitting} className="w-full md:w-auto">
        {isSubmitting ? (
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
