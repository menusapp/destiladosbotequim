import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Download, Upload, Cloud, HardDrive, AlertTriangle, CheckCircle, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface BackupSettingsProps {
  restaurantId: string;
}

interface BackupPreview {
  date: string;
  products: number;
  categories: number;
  customers: number;
  tables: number;
  stockItems: number;
  suppliers: number;
}

const BACKUP_TABLES_FULL = [
  "products", "categories", "product_extras", "extra_categories", "extra_category_items",
  "customers", "tables", "stock_items", "stock_categories", "suppliers",
  "delivery_config", "delivery_zones", "business_hours", "payment_methods",
  "whatsapp_config", "fiscal_configs", "loyalty_programs", "loyalty_program_rewards",
  "coupons", "reservation_tables", "reservation_hours", "printer_settings",
  "card_fees_config", "fixed_costs", "variable_costs", "labor_costs",
] as const;

const BACKUP_TABLES_ESSENTIAL = [
  "products", "categories", "product_extras", "extra_categories", "extra_category_items",
  "customers", "tables", "stock_items", "stock_categories", "suppliers",
  "delivery_config", "delivery_zones", "business_hours", "payment_methods",
  "whatsapp_config", "fiscal_configs", "loyalty_programs", "loyalty_program_rewards",
  "coupons", "reservation_tables", "reservation_hours", "printer_settings",
] as const;

export default function BackupSettings({ restaurantId }: BackupSettingsProps) {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<{ name: string; created_at: string }[]>([]);
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingRestore, setPendingRestore] = useState<any>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  useEffect(() => {
    fetchCloudBackups();
    const stored = localStorage.getItem(`lastBackup_${restaurantId}`);
    if (stored) setLastBackupDate(stored);
  }, [restaurantId]);

  const fetchCloudBackups = async () => {
    setLoadingCloud(true);
    try {
      const { data, error } = await supabase.storage
        .from("backups")
        .list(`${restaurantId}`, { limit: 7, sortBy: { column: "created_at", order: "desc" } });
      if (!error && data) {
        setCloudBackups(data.filter(f => f.name.endsWith(".json")).map(f => ({
          name: f.name,
          created_at: f.created_at || "",
        })));
      }
    } catch (err) {
      console.error("Error fetching cloud backups:", err);
    } finally {
      setLoadingCloud(false);
    }
  };

  const fetchBackupData = async (tables: readonly string[]) => {
    const data: Record<string, any[]> = {};

    // Fetch categories first to get IDs for products
    const { data: categories } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId);
    data.categories = categories || [];

    const categoryIds = (categories || []).map(c => c.id);

    for (const table of tables) {
      if (table === "categories") continue; // Already fetched
      if (table === "products" && categoryIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("*")
          .in("category_id", categoryIds);
        data.products = products || [];
        continue;
      }
      if (table === "product_extras") {
        const productIds = (data.products || []).map(p => p.id);
        if (productIds.length > 0) {
          const { data: extras } = await supabase
            .from("product_extras")
            .select("*")
            .in("product_id", productIds);
          data.product_extras = extras || [];
        } else {
          data.product_extras = [];
        }
        continue;
      }
      if (table === "extra_category_items") {
        const catIds = (data.extra_categories || []).map(c => c.id);
        if (catIds.length > 0) {
          const { data: items } = await supabase
            .from("extra_category_items")
            .select("*")
            .in("category_id", catIds);
          data.extra_category_items = items || [];
        } else {
          data.extra_category_items = [];
        }
        continue;
      }

      // Default: fetch by restaurant_id
      try {
        const { data: tableData } = await supabase
          .from(table as any)
          .select("*")
          .eq("restaurant_id", restaurantId);
        data[table] = tableData || [];
      } catch {
        data[table] = [];
      }
    }

    return data;
  };

  const handleDownloadBackup = async () => {
    setDownloading(true);
    try {
      const data = await fetchBackupData(BACKUP_TABLES_FULL);

      const backup = {
        version: "1.0",
        type: "full",
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
        data,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${restaurantId}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem(`lastBackup_${restaurantId}`, now);
      setLastBackupDate(now);
      toast.success("Backup local baixado com sucesso!");
    } catch (err) {
      console.error("Backup error:", err);
      toast.error("Erro ao gerar backup");
    } finally {
      setDownloading(false);
    }
  };

  const handleCloudBackup = async () => {
    setDownloading(true);
    try {
      const data = await fetchBackupData(BACKUP_TABLES_ESSENTIAL);

      const backup = {
        version: "1.0",
        type: "essential",
        restaurant_id: restaurantId,
        created_at: new Date().toISOString(),
        data,
      };

      const fileName = `${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
      const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });

      const { error } = await supabase.storage
        .from("backups")
        .upload(`${restaurantId}/${fileName}`, blob, { upsert: true });

      if (error) throw error;

      toast.success("Backup em cloud salvo com sucesso!");
      fetchCloudBackups();
    } catch (err) {
      console.error("Cloud backup error:", err);
      toast.error("Erro ao salvar backup em cloud");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCloudBackup = async (fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("backups")
        .download(`${restaurantId}/${fileName}`);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cloud_backup_${fileName}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Erro ao baixar backup");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.data || !backup.restaurant_id) {
        toast.error("Arquivo de backup inválido");
        setUploading(false);
        return;
      }

      // Generate preview
      const preview: BackupPreview = {
        date: backup.created_at || "Desconhecida",
        products: backup.data.products?.length || 0,
        categories: backup.data.categories?.length || 0,
        customers: backup.data.customers?.length || 0,
        tables: backup.data.tables?.length || 0,
        stockItems: backup.data.stock_items?.length || 0,
        suppliers: backup.data.suppliers?.length || 0,
      };

      setBackupPreview(preview);
      setPendingRestore(backup);
    } catch (err) {
      toast.error("Erro ao ler arquivo de backup");
    } finally {
      setUploading(false);
    }
  };

  const handleRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    setShowConfirmRestore(false);

    try {
      const data = pendingRestore.data;

      // Restore in order: categories first, then products, etc.
      // Delete existing data first
      if (data.categories?.length > 0) {
        // Delete existing products and categories
        const { data: existingCats } = await supabase
          .from("categories")
          .select("id")
          .eq("restaurant_id", restaurantId);

        if (existingCats?.length) {
          const catIds = existingCats.map(c => c.id);
          // Delete product extras first
          const { data: existingProducts } = await supabase
            .from("products")
            .select("id")
            .in("category_id", catIds);
          if (existingProducts?.length) {
            const prodIds = existingProducts.map(p => p.id);
            await supabase.from("product_extras").delete().in("product_id", prodIds);
            await supabase.from("products").delete().in("category_id", catIds);
          }
          await supabase.from("categories").delete().eq("restaurant_id", restaurantId);
        }

        // Insert categories with new IDs mapped
        for (const cat of data.categories) {
          await supabase.from("categories").insert({
            id: cat.id,
            name: cat.name,
            restaurant_id: restaurantId,
            display_order: cat.display_order,
          });
        }
      }

      if (data.products?.length > 0) {
        for (const prod of data.products) {
          await supabase.from("products").insert({
            ...prod,
            id: prod.id,
          });
        }
      }

      if (data.product_extras?.length > 0) {
        for (const extra of data.product_extras) {
          await supabase.from("product_extras").insert({
            ...extra,
            id: extra.id,
          });
        }
      }

      // Restore customers
      if (data.customers?.length > 0) {
        await supabase.from("customers").delete().eq("restaurant_id", restaurantId);
        for (const customer of data.customers) {
          await supabase.from("customers").insert({
            ...customer,
            restaurant_id: restaurantId,
          });
        }
      }

      // Restore tables
      if (data.tables?.length > 0) {
        await supabase.from("tables").delete().eq("restaurant_id", restaurantId);
        for (const table of data.tables) {
          await supabase.from("tables").insert({
            ...table,
            restaurant_id: restaurantId,
          });
        }
      }

      // Restore stock items
      if (data.stock_items?.length > 0) {
        await supabase.from("stock_items").delete().eq("restaurant_id", restaurantId);
        for (const item of data.stock_items) {
          await supabase.from("stock_items").insert({
            ...item,
            restaurant_id: restaurantId,
          });
        }
      }

      // Restore suppliers
      if (data.suppliers?.length > 0) {
        await supabase.from("suppliers").delete().eq("restaurant_id", restaurantId);
        for (const supplier of data.suppliers) {
          await supabase.from("suppliers").insert({
            ...supplier,
            restaurant_id: restaurantId,
          });
        }
      }

      toast.success("Backup restaurado com sucesso!");
      setPendingRestore(null);
      setBackupPreview(null);
    } catch (err) {
      console.error("Restore error:", err);
      toast.error("Erro ao restaurar backup");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Backup e Restauração</h2>
        <p className="text-sm text-muted-foreground">Proteja os dados do seu restaurante com backups regulares</p>
      </div>

      {/* Local Backup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Backup Local</CardTitle>
          </div>
          <CardDescription>
            Baixe um backup completo dos dados do restaurante para o seu computador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              {lastBackupDate && (
                <p className="text-sm text-muted-foreground">
                  Último backup: {format(new Date(lastBackupDate), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              )}
            </div>
            <Button onClick={handleDownloadBackup} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Baixar Backup Agora
            </Button>
          </div>
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
            <p>O backup local é salvo no seu computador. Recomendamos armazenar em local seguro como HD externo ou Google Drive.</p>
          </div>
        </CardContent>
      </Card>

      {/* Cloud Backup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Backup em Cloud</CardTitle>
          </div>
          <CardDescription>
            Backup salvo na nuvem com dados essenciais (produtos, clientes, configurações).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {cloudBackups.length} backup(s) disponível(is)
            </p>
            <Button onClick={handleCloudBackup} disabled={downloading} variant="outline">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Cloud className="h-4 w-4 mr-2" />}
              Salvar Backup em Cloud
            </Button>
          </div>

          {cloudBackups.length > 0 && (
            <div className="space-y-2">
              {cloudBackups.map((backup) => (
                <div key={backup.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{backup.name}</p>
                    {backup.created_at && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(backup.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadCloudBackup(backup.name)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
            <p>Backup em cloud salva apenas dados essenciais. Para backup completo incluindo histórico de pedidos, use o backup local.</p>
          </div>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Restauração</CardTitle>
          </div>
          <CardDescription>
            Restaure os dados do restaurante a partir de um arquivo de backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={uploading || restoring}
            />
          </div>

          {backupPreview && (
            <div className="p-4 border border-border rounded-lg space-y-3">
              <h4 className="font-semibold text-sm">Preview do Backup</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium">{backupPreview.date !== "Desconhecida" ? format(new Date(backupPreview.date), "dd/MM/yyyy") : "Desconhecida"}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Produtos:</span>
                  <span className="font-medium">{backupPreview.products}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Categorias:</span>
                  <span className="font-medium">{backupPreview.categories}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Clientes:</span>
                  <span className="font-medium">{backupPreview.customers}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Mesas:</span>
                  <span className="font-medium">{backupPreview.tables}</span>
                </div>
                <div className="flex justify-between p-2 bg-muted/30 rounded">
                  <span className="text-muted-foreground">Insumos:</span>
                  <span className="font-medium">{backupPreview.stockItems}</span>
                </div>
              </div>
              <Button
                onClick={() => setShowConfirmRestore(true)}
                disabled={restoring}
                variant="destructive"
                className="w-full"
              >
                {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Restaurar Backup
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>A restauração substituirá todos os dados atuais. Faça um backup antes de restaurar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmRestore} onOpenChange={setShowConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Restauração</AlertDialogTitle>
            <AlertDialogDescription>
              Isso substituirá todos os dados atuais do restaurante (produtos, categorias, clientes, mesas, insumos e fornecedores). Essa ação não pode ser desfeita. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
