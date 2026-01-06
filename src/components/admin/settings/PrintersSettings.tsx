import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Printer, RefreshCw, AlertCircle, CheckCircle2, Monitor } from "lucide-react";
import { toast } from "sonner";
import { isElectronApp } from "@/lib/localDB";

// Type assertions for Electron APIs
const getElectronPrinter = () => (window as any).electronPrinter;
const getElectronDB = () => (window as any).electronDB;

interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface PrinterConfig {
  comanda: {
    printerName: string;
    paperSize: string;
    autoPrint: boolean;
  };
  cupom: {
    printerName: string;
    paperSize: string;
    autoPrint: boolean;
  };
}

const PrintersSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [config, setConfig] = useState<PrinterConfig>({
    comanda: { printerName: '', paperSize: '80mm', autoPrint: false },
    cupom: { printerName: '', paperSize: '80mm', autoPrint: false }
  });

  useEffect(() => {
    const checkElectron = isElectronApp();
    setIsElectron(checkElectron);
    
    if (checkElectron) {
      loadPrinters();
      loadConfig();
    }
  }, [restaurantId]);

  const loadPrinters = async () => {
    const electronPrinter = getElectronPrinter();
    if (!electronPrinter) return;
    
    setLoading(true);
    try {
      const list = await electronPrinter.getList();
      setPrinters(list || []);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('Erro ao carregar impressoras');
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    const electronDB = getElectronDB();
    if (!electronDB) return;
    
    try {
      const savedConfig = await electronDB.getPrinterConfig(restaurantId);
      if (savedConfig) {
        setConfig({
          comanda: {
            printerName: savedConfig.comanda_printer || '',
            paperSize: savedConfig.comanda_paper_size || '80mm',
            autoPrint: Boolean(savedConfig.comanda_auto_print)
          },
          cupom: {
            printerName: savedConfig.cupom_printer || '',
            paperSize: savedConfig.cupom_paper_size || '80mm',
            autoPrint: Boolean(savedConfig.cupom_auto_print)
          }
        });
      }
    } catch (error) {
      console.error('Error loading printer config:', error);
    }
  };

  const saveConfig = async () => {
    const electronDB = getElectronDB();
    if (!electronDB) return;
    
    try {
      await electronDB.savePrinterConfig({
        restaurant_id: restaurantId,
        comanda_printer: config.comanda.printerName,
        comanda_paper_size: config.comanda.paperSize,
        comanda_auto_print: config.comanda.autoPrint ? 1 : 0,
        cupom_printer: config.cupom.printerName,
        cupom_paper_size: config.cupom.paperSize,
        cupom_auto_print: config.cupom.autoPrint ? 1 : 0
      });
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  const testPrint = async (type: 'comanda' | 'cupom') => {
    const electronPrinter = getElectronPrinter();
    if (!electronPrinter) return;
    
    const printerName = config[type].printerName;
    const paperSize = config[type].paperSize;
    
    if (!printerName) {
      toast.error('Selecione uma impressora primeiro');
      return;
    }

    setTesting(type);
    try {
      const result = await electronPrinter.test(printerName, paperSize);
      if (result.success) {
        toast.success('Impressão de teste enviada!');
      } else {
        toast.error(result.error || 'Erro ao imprimir');
      }
    } catch (error) {
      console.error('Test print error:', error);
      toast.error('Erro ao imprimir teste');
    } finally {
      setTesting(null);
    }
  };

  // Show web-only message
  if (!isElectron) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Impressoras</h2>
          <p className="text-muted-foreground">Configure as impressoras para comandas e cupons</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Monitor className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Disponível apenas na versão Desktop</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              A configuração de impressoras está disponível apenas na versão desktop (Windows) do Menu's. 
              Baixe o instalador .exe para usar esta funcionalidade.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Impressoras</h2>
          <p className="text-muted-foreground">Configure as impressoras para comandas e cupons</p>
        </div>
        <Button 
          variant="outline" 
          onClick={loadPrinters} 
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Lista
        </Button>
      </div>

      {printers.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">Nenhuma impressora encontrada</h3>
            <p className="text-sm text-muted-foreground">
              Certifique-se de que suas impressoras estão instaladas e conectadas.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Impressora de Comandas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impressora de Comandas
          </CardTitle>
          <CardDescription>
            Impressora usada para imprimir pedidos que vão para a cozinha/bar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Impressora</Label>
              <Select
                value={config.comanda.printerName}
                onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  comanda: { ...prev.comanda, printerName: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma impressora" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.name} value={printer.name}>
                      {printer.displayName}
                      {printer.isDefault && ' (Padrão)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tamanho do Papel</Label>
              <Select
                value={config.comanda.paperSize}
                onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  comanda: { ...prev.comanda, paperSize: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (padrão)</SelectItem>
                  <SelectItem value="58mm">58mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Auto-imprimir novos pedidos</Label>
              <p className="text-sm text-muted-foreground">
                Imprimir automaticamente quando um novo pedido chegar
              </p>
            </div>
            <Switch
              checked={config.comanda.autoPrint}
              onCheckedChange={(checked) => setConfig(prev => ({
                ...prev,
                comanda: { ...prev.comanda, autoPrint: checked }
              }))}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => testPrint('comanda')}
            disabled={testing === 'comanda' || !config.comanda.printerName}
          >
            <Printer className="h-4 w-4 mr-2" />
            {testing === 'comanda' ? 'Imprimindo...' : 'Testar Impressão'}
          </Button>
        </CardContent>
      </Card>

      {/* Impressora de Cupons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impressora de Cupons
          </CardTitle>
          <CardDescription>
            Impressora usada para imprimir recibos para o cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Impressora</Label>
              <Select
                value={config.cupom.printerName}
                onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  cupom: { ...prev.cupom, printerName: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma impressora" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.name} value={printer.name}>
                      {printer.displayName}
                      {printer.isDefault && ' (Padrão)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tamanho do Papel</Label>
              <Select
                value={config.cupom.paperSize}
                onValueChange={(value) => setConfig(prev => ({
                  ...prev,
                  cupom: { ...prev.cupom, paperSize: value }
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (padrão)</SelectItem>
                  <SelectItem value="58mm">58mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => testPrint('cupom')}
            disabled={testing === 'cupom' || !config.cupom.printerName}
          >
            <Printer className="h-4 w-4 mr-2" />
            {testing === 'cupom' ? 'Imprimindo...' : 'Testar Impressão'}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Como configurar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Instale o driver da impressora no Windows</li>
                <li>Conecte a impressora (USB, rede ou Bluetooth)</li>
                <li>Clique em "Atualizar Lista" para detectar a impressora</li>
                <li>Selecione a impressora e tamanho do papel</li>
                <li>Teste a impressão para confirmar</li>
                <li>Salve as configurações</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveConfig}>
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default PrintersSettings;
