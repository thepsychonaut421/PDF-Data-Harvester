'use client';
import type { FC} from 'react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DataTable from './data-table';
import type { ExtractedDataItem, AppSchema, PdfStatus } from '@/lib/types';
import { Download, Filter, Search, AlertTriangle, CheckCircle2, XCircle, Loader2, ListFilter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

interface DataDashboardProps {
  data: ExtractedDataItem[];
  schema: AppSchema;
  onUpdateItem: (item: ExtractedDataItem) => void;
  onDeleteItem: (itemId: string) => void; 
  onExportCsv: () => void;
  isLoading?: boolean;
  selectedExportColumns: string[];
  onSelectedExportColumnsChange: (keys: string[]) => void;
}

const DataDashboard: FC<DataDashboardProps> = ({ 
  data, 
  schema, 
  onUpdateItem, 
  onDeleteItem, 
  onExportCsv, 
  isLoading,
  selectedExportColumns,
  onSelectedExportColumnsChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PdfStatus | 'all'>('all');

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const searchString = [
        item.fileName,
        item.status,
        item.extractedValues.date,
        item.extractedValues.supplier,
        item.extractedValues.totalPrice,
        item.extractedValues.currency,
        item.extractedValues.documentLanguage,
        ...(item.extractedValues.products?.map(p => `${p.name} ${p.quantity} ${p.price}`) || [])
      ].join(' ').toLowerCase();
      
      const matchesSearchTerm = searchString.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearchTerm && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);
  
  const processedCount = useMemo(() => data.filter(item => item.status === 'processed').length, [data]);
  const validationCount = useMemo(() => data.filter(item => item.status === 'needs_validation').length, [data]);
  const errorCount = useMemo(() => data.filter(item => item.status === 'error').length, [data]);
  const processingCount = useMemo(() => data.filter(item => item.status === 'processing' || item.status === 'uploading').length, [data]);


  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl text-primary">Dashboard Date Extrase</CardTitle>
            <CardDescription>Vizualizați, editați și exportați datele extrase din fișierele PDF.</CardDescription>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Selectează Coloane
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px]">
                <DropdownMenuLabel>Coloane pentru Export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {schema.fields
                  .filter(field => field.key !== 'actions') // 'actions' column is not exportable
                  .map(field => (
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
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              onClick={onExportCsv} 
              disabled={data.filter(item => item.status === 'processed' || item.status === 'needs_validation').length === 0 || selectedExportColumns.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Exportă CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-success/10 dark:bg-success/20 border-success/30 dark:border-success/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-success-foreground/80 dark:text-success-foreground/70">Procesate</CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success-foreground dark:text-success-foreground/90">{processedCount}</div>
                    <p className="text-xs text-success-foreground/70 dark:text-success-foreground/60">documente</p>
                </CardContent>
            </Card>
             <Card className="bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-primary-foreground/80 dark:text-primary-foreground/70">În Procesare</CardTitle>
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary-foreground dark:text-primary-foreground/90">{processingCount}</div>
                     <p className="text-xs text-primary-foreground/70 dark:text-primary-foreground/60">documente</p>
                </CardContent>
            </Card>
            <Card className="bg-warning/10 dark:bg-warning/20 border-warning/30 dark:border-warning/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-warning-foreground/80 dark:text-warning-foreground/70">Necesită Validare</CardTitle>
                    <AlertTriangle className="h-5 w-5 text-warning" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-warning-foreground dark:text-warning-foreground/90">{validationCount}</div>
                    <p className="text-xs text-warning-foreground/70 dark:text-warning-foreground/60">documente</p>
                </CardContent>
            </Card>
            <Card className="bg-destructive/10 dark:bg-destructive/20 border-destructive/30 dark:border-destructive/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-destructive-foreground/80 dark:text-destructive-foreground/70">Erori</CardTitle>
                    <XCircle className="h-5 w-5 text-destructive" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-destructive-foreground dark:text-destructive-foreground/90">{errorCount}</div>
                     <p className="text-xs text-destructive-foreground/70 dark:text-destructive-foreground/60">documente</p>
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
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value: PdfStatus | 'all') => setStatusFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrează după status" />
              </SelectTrigger>
              <SelectContent>
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
           />
        )}
      </CardContent>
    </Card>
  );
};

export default DataDashboard;
