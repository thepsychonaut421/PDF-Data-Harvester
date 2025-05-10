
'use client';
import type { FC} from 'react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DataTable from './data-table';
import type { ExtractedDataItem, AppSchema, PdfStatus, InvoiceTemplate, SchemaField } from '@/lib/types';
import { Download, Filter, Search, AlertTriangle, CheckCircle2, XCircle, Loader2, ListFilter, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';


interface DataDashboardProps {
  data: ExtractedDataItem[];
  schema: AppSchema;
  onUpdateItem: (item: ExtractedDataItem) => void;
  onDeleteItem: (itemId: string) => void; 
  onExportCsv: () => void;
  onClearAllItems: () => void;
  isLoading?: boolean;
  selectedExportColumns: string[];
  onSelectedExportColumnsChange: (keys: string[]) => void;
  templates: InvoiceTemplate[]; 
}

const DataDashboard: FC<DataDashboardProps> = ({ 
  data, 
  schema, 
  onUpdateItem, 
  onDeleteItem, 
  onExportCsv,
  onClearAllItems,
  isLoading,
  selectedExportColumns,
  onSelectedExportColumnsChange,
  templates,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PdfStatus | 'all'>('all');

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const templateUsed = item.activeTemplateId ? templates.find(t => t.id === item.activeTemplateId) : null;
      const templateNameToSearch = templateUsed ? templateUsed.name : 'Standard';

      const searchString = [
        item.fileName,
        item.status,
        templateNameToSearch, 
        item.extractedValues.date,
        item.extractedValues.supplier,
        item.extractedValues.totalPrice,
        item.extractedValues.currency,
        item.extractedValues.documentLanguage,
        item.extractedValues.invoiceNumber,
        item.extractedValues.subtotal,
        item.extractedValues.totalDiscountAmount,
        item.extractedValues.totalTaxAmount,
        item.extractedValues.paymentTerms,
        item.extractedValues.dueDate,
        ...(item.extractedValues.products?.map(p => {
            return Object.values(p).join(' ');
        }) || [])
      ].join(' ').toLowerCase();
      
      const matchesSearchTerm = searchString.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearchTerm && matchesStatus;
    });
  }, [data, searchTerm, statusFilter, templates]); 
  
  const processedCount = useMemo(() => data.filter(item => item.status === 'processed').length, [data]);
  const validationCount = useMemo(() => data.filter(item => item.status === 'needs_validation').length, [data]);
  const errorCount = useMemo(() => data.filter(item => item.status === 'error').length, [data]);
  const processingCount = useMemo(() => data.filter(item => item.status === 'processing' || item.status === 'uploading').length, [data]);

  const nonProductFields = schema.fields.filter(field => !field.isProductField && field.key !== 'actions');
  const productFields = schema.fields.filter(field => field.isProductField && field.key !== 'actions');


  return (
    <Card className="shadow-lg w-full rounded-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl text-primary">Rezultate Extragere</CardTitle>
            <CardDescription>Vizualizați, editați și exportați datele extrase.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-md">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Coloane Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[300px] rounded-md">
                 <ScrollArea className="h-[400px]">
                  <DropdownMenuLabel>Selectează Coloane Factură</DropdownMenuLabel>
                  {nonProductFields.map(field => (
                      <DropdownMenuCheckboxItem
                        key={field.key}
                        checked={selectedExportColumns.includes(field.key as string)}
                        onCheckedChange={(checked) => {
                          const newSelectedColumns = checked
                            ? [...selectedExportColumns, field.key as string]
                            : selectedExportColumns.filter(key => key !== field.key);
                          onSelectedExportColumnsChange(newSelectedColumns);
                        }}
                      >
                        {field.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Selectează Coloane Produs (pentru Export Detaliat)</DropdownMenuLabel>
                   {productFields.map(field => (
                      <DropdownMenuCheckboxItem
                        key={field.key}
                        checked={selectedExportColumns.includes(field.key as string)}
                        onCheckedChange={(checked) => {
                          const newSelectedColumns = checked
                            ? [...selectedExportColumns, field.key as string]
                            : selectedExportColumns.filter(key => key !== field.key);
                          onSelectedExportColumnsChange(newSelectedColumns);
                        }}
                      >
                        {field.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                 </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={onExportCsv} 
              disabled={data.filter(item => item.status === 'processed' || item.status === 'needs_validation').length === 0 || selectedExportColumns.length === 0}
              className="rounded-md"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportă CSV
            </Button>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={data.length === 0} className="rounded-md">
                  <Trash className="mr-2 h-4 w-4" />
                  Șterge Tot
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Sunteți sigur?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Această acțiune va șterge toate datele încărcate și procesate. Această acțiune nu poate fi anulată.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-md">Anulează</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearAllItems} className="rounded-md bg-destructive hover:bg-destructive/90">
                    Șterge Tot
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-success/10 border-success/50 rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-success-foreground">Procesate</CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success-foreground">{processedCount}</div>
                    <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
             <Card className="bg-primary/10 border-primary/50 rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-primary">În Procesare</CardTitle>
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">{processingCount}</div>
                     <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
            <Card className="bg-warning/10 border-warning/50 rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-warning-foreground">Necesită Validare</CardTitle>
                    <AlertTriangle className="h-5 w-5 text-warning" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-warning-foreground">{validationCount}</div>
                    <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/50 rounded-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-destructive-foreground">Erori</CardTitle>
                    <XCircle className="h-5 w-5 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive-foreground">{errorCount}</div>
                     <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
        </div>


        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Caută în toate câmpurile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-md"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value: PdfStatus | 'all') => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-md">
                <SelectValue placeholder="Filtrează după status" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                <SelectItem value="all">Toate Statusurile</SelectItem>
                <SelectItem value="pending">În așteptare</SelectItem>
                <SelectItem value="uploading">Se încarcă</SelectItem>
                <SelectItem value="processing">Se procesează</SelectItem>
                <SelectItem value="processed">Procesat</SelectItem>
                <SelectItem value="needs_validation">Necesită Validare</SelectItem>
                <SelectItem value="error">Eroare</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {isLoading && filteredData.length === 0 ? ( 
          <div className="text-center py-10">
            <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
            <p className="text-muted-foreground">Se încarcă datele...</p>
          </div>
        ) : (
          <DataTable 
            data={filteredData} 
            schema={schema.fields} 
            onUpdateItem={onUpdateItem}
            onDeleteItem={onDeleteItem}
            templates={templates} 
           />
        )}
      </CardContent>
    </Card>
  );
};

export default DataDashboard;
