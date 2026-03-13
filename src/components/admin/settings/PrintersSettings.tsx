import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Printer, RefreshCw, AlertCircle, CheckCircle2, Monitor, Globe } from "lucide-react";
import { toast } from "sonner";
import { isElectronApp } from "@/lib/localDB";
import { supabase } from "@/integrations/supabase/client";

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

interface WebPrinterConfig {
  paperSize: string;
  autoPrintOrders: boolean;
  autoPrintReceipts: boolean;
  fontFamily: string;
  fontSize: number;
  fontBold: boolean;
}

const FONT_OPTIONS = [
  { value: 'Arial Black', label: 'Arial Black' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Lucida Console', label: 'Lucida Console' },
  { value: 'monospace', label: 'Monospace' },
];

const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 16, 18];

const PrintersSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isElectron = isElectronApp();

  // Electron config
  const [config, setConfig] = useState<PrinterConfig>({
    comanda: { printerName: '', paperSize: '80mm', autoPrint: false },
    cupom: { printerName: '', paperSize: '80mm', autoPrint: false }
  });

  // Web config
  const [webConfig, setWebConfig] = useState<WebPrinterConfig>({
    paperSize: '80mm',
    autoPrintOrders: false,
    autoPrintReceipts: false,
    fontFamily: 'Arial Black',
    fontSize: 12,
    fontBold: true,
  });

  useEffect(() => {
    if (isElectron) {
      loadPrinters();
      loadElectronConfig();
    } else {
      loadWebConfig();
    }
  }, [restaurantId]);

  // ── Electron helpers ──────────────────────────────────────
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

  const loadElectronConfig = async () => {
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

  const saveElectronConfig = async () => {
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

  const testElectronPrint = async (type: 'comanda' | 'cupom') => {
    const electronPrinter = getElectronPrinter();
    if (!electronPrinter) return;
    const printerName = config[type].printerName;
    const paperSize = config[type].paperSize;
    if (!printerName) { toast.error('Selecione uma impressora primeiro'); return; }
    setTesting(type);
    try {
      const result = await electronPrinter.test(printerName, paperSize);
      if (result.success) toast.success('Impressão de teste enviada!');
      else toast.error(result.error || 'Erro ao imprimir');
    } catch (error) {
      console.error('Test print error:', error);
      toast.error('Erro ao imprimir teste');
    } finally {
      setTesting(null);
    }
  };

  // ── Web helpers ───────────────────────────────────────────
  const loadWebConfig = async () => {
    try {
      const { data } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (data) {
        setWebConfig({
          paperSize: data.paper_size || '80mm',
          autoPrintOrders: Boolean(data.auto_print_orders),
          autoPrintReceipts: Boolean(data.auto_print_receipts),
          fontFamily: (data as any).font_family || 'Arial Black',
          fontSize: (data as any).font_size || 12,
          fontBold: (data as any).font_bold !== undefined ? Boolean((data as any).font_bold) : true,
        });
      }
    } catch (error) {
      console.error('Error loading web printer config:', error);
    }
  };

  const saveWebConfig = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('printer_settings')
        .upsert({
          restaurant_id: restaurantId,
          paper_size: webConfig.paperSize,
          auto_print_orders: webConfig.autoPrintOrders,
          auto_print_receipts: webConfig.autoPrintReceipts,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'restaurant_id' });
      if (error) throw error;
      toast.success('Configurações salvas!');
    } catch (error) {
      console.error('Error saving web config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const testWebPrint = () => {
    setTesting('web');
    const width = webConfig.paperSize === '58mm' ? '58mm' : '80mm';
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error('Popup bloqueado. Permita popups para imprimir.');
      setTesting(null);
      return;
    }
    printWindow.document.write(`
      <html>
      <head>
        <title>Teste de Impressão</title>
        <style>
          @page { margin: 0; size: ${width} auto; }
          body { font-family: monospace; width: ${width}; margin: 0 auto; padding: 8px; font-size: 12px; }
          .center { text-align: center; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          h2 { margin: 4px 0; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="center">
          <h2>*** TESTE DE IMPRESSÃO ***</h2>
          <p>Menu's - Sistema de Gestão</p>
        </div>
        <div class="line"></div>
        <p>Tamanho do papel: ${width}</p>
        <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
        <div class="line"></div>
        <table style="width:100%">
          <tr><td>Item Exemplo 1</td><td style="text-align:right">R$ 25,90</td></tr>
          <tr><td>Item Exemplo 2</td><td style="text-align:right">R$ 18,50</td></tr>
          <tr><td>Item Exemplo 3</td><td style="text-align:right">R$ 32,00</td></tr>
        </table>
        <div class="line"></div>
        <table style="width:100%">
          <tr><td><strong>TOTAL</strong></td><td style="text-align:right"><strong>R$ 76,40</strong></td></tr>
        </table>
        <div class="line"></div>
        <div class="center">
          <p>✓ Impressão funcionando!</p>
          <p>Obrigado pela preferência</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTesting(null);
    }, 500);
  };

  // ── Render: Web mode ──────────────────────────────────────
  if (!isElectron) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Impressoras</h2>
          <p className="text-muted-foreground">Configure a impressão de pedidos e cupons via navegador</p>
        </div>

        {/* Como funciona */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Impressão via Navegador
            </CardTitle>
            <CardDescription>
              Na versão web, a impressão usa o diálogo nativo do navegador (Ctrl+P / Cmd+P)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como configurar:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Instale o driver da impressora térmica no seu computador</li>
                  <li>Conecte a impressora (USB, rede ou Bluetooth)</li>
                  <li>Escolha o tamanho do papel abaixo</li>
                  <li>Clique em "Testar Impressão" para verificar</li>
                  <li>No diálogo de impressão do navegador, selecione sua impressora térmica</li>
                  <li>Salve as configurações</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Configurações de Impressão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2 max-w-xs">
              <Label>Tamanho do Papel</Label>
              <Select
                value={webConfig.paperSize}
                onValueChange={(value) => setWebConfig(prev => ({ ...prev, paperSize: value }))}
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

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Imprimir ao aceitar pedido</Label>
                <p className="text-sm text-muted-foreground">
                  Ao aceitar um pedido, abre automaticamente o diálogo de impressão com a comanda formatada
                </p>
              </div>
              <Switch
                checked={webConfig.autoPrintOrders}
                onCheckedChange={(checked) => setWebConfig(prev => ({ ...prev, autoPrintOrders: checked }))}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Imprimir cupom ao fechar conta</Label>
                <p className="text-sm text-muted-foreground">
                  Ao marcar uma conta como paga, abre automaticamente o diálogo de impressão do cupom
                </p>
              </div>
              <Switch
                checked={webConfig.autoPrintReceipts}
                onCheckedChange={(checked) => setWebConfig(prev => ({ ...prev, autoPrintReceipts: checked }))}
              />
            </div>

            <Button
              variant="outline"
              onClick={testWebPrint}
              disabled={testing === 'web'}
            >
              <Printer className="h-4 w-4 mr-2" />
              {testing === 'web' ? 'Abrindo...' : 'Testar Impressão'}
            </Button>
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={saveWebConfig} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: Electron mode (unchanged) ─────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Impressoras</h2>
          <p className="text-muted-foreground">Configure as impressoras para comandas e cupons</p>
        </div>
        <Button variant="outline" onClick={loadPrinters} disabled={loading}>
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
          <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" />Impressora de Comandas</CardTitle>
          <CardDescription>Impressora usada para imprimir pedidos que vão para a cozinha/bar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Impressora</Label>
              <Select value={config.comanda.printerName} onValueChange={(v) => setConfig(p => ({ ...p, comanda: { ...p.comanda, printerName: v } }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma impressora" /></SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.displayName}{p.isDefault && ' (Padrão)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanho do Papel</Label>
              <Select value={config.comanda.paperSize} onValueChange={(v) => setConfig(p => ({ ...p, comanda: { ...p.comanda, paperSize: v } }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <p className="text-sm text-muted-foreground">Imprimir automaticamente quando um novo pedido chegar</p>
            </div>
            <Switch checked={config.comanda.autoPrint} onCheckedChange={(c) => setConfig(p => ({ ...p, comanda: { ...p.comanda, autoPrint: c } }))} />
          </div>
          <Button variant="outline" onClick={() => testElectronPrint('comanda')} disabled={testing === 'comanda' || !config.comanda.printerName}>
            <Printer className="h-4 w-4 mr-2" />
            {testing === 'comanda' ? 'Imprimindo...' : 'Testar Impressão'}
          </Button>
        </CardContent>
      </Card>

      {/* Impressora de Cupons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" />Impressora de Cupons</CardTitle>
          <CardDescription>Impressora usada para imprimir recibos para o cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Impressora</Label>
              <Select value={config.cupom.printerName} onValueChange={(v) => setConfig(p => ({ ...p, cupom: { ...p.cupom, printerName: v } }))}>
                <SelectTrigger><SelectValue placeholder="Selecione uma impressora" /></SelectTrigger>
                <SelectContent>
                  {printers.map((p) => (
                    <SelectItem key={p.name} value={p.name}>{p.displayName}{p.isDefault && ' (Padrão)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tamanho do Papel</Label>
              <Select value={config.cupom.paperSize} onValueChange={(v) => setConfig(p => ({ ...p, cupom: { ...p.cupom, paperSize: v } }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">80mm (padrão)</SelectItem>
                  <SelectItem value="58mm">58mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" onClick={() => testElectronPrint('cupom')} disabled={testing === 'cupom' || !config.cupom.printerName}>
            <Printer className="h-4 w-4 mr-2" />
            {testing === 'cupom' ? 'Imprimindo...' : 'Testar Impressão'}
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
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

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={saveElectronConfig}>Salvar Configurações</Button>
      </div>
    </div>
  );
};

export default PrintersSettings;
