
'use client';
import type { FC} from 'react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DataTable from './data-table';
import type { ExtractedDataItem, AppSchema, PdfStatus, InvoiceTemplate } from '@/lib/types';
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
  templates: InvoiceTemplate[]; // Pass templates for DataTable
}

const DataDashboard: FC<DataDashboardProps> = ({ 
  data, 
  schema, 
  onUpdateItem, 
  onDeleteItem, 
  onExportCsv, 
  isLoading,
  selectedExportColumns,
  onSelectedExportColumnsChange,
  templates,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PdfStatus | 'all'>('all');

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const searchString = [
        item.fileName,
        item.status,
        item.activeTemplateName,
        item.extractedValues.date,
        item.extractedValues.supplier,
        item.extractedValues.totalPrice,
        item.extractedValues.currency,
        item.extractedValues.documentLanguage,
        ...(item.extractedValues.products?.map(p => {
            return Object.values(p).join(' ');
        }) || [])
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
            <CardTitle className="text-xl text-primary">Rezultate Extragere</CardTitle>
            <CardDescription>Vizualizați, editați și exportați datele extrase.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Coloane Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[250px]">
                <DropdownMenuLabel>Selectează Coloane pentru Export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {schema.fields
                  .filter(field => field.key !== 'actions') 
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
            <Card className="bg-success/10 border-success/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-success-foreground">Procesate</CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-success-foreground">{processedCount}</div>
                    <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
             <Card className="bg-primary/10 border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-primary-foreground">În Procesare</CardTitle>
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary-foreground">{processingCount}</div>
                     <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
            <Card className="bg-warning/10 border-warning/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-warning-foreground">Necesită Validare</CardTitle>
                    <AlertTriangle className="h-5 w-5 text-warning" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-warning-foreground">{validationCount}</div>
                    <p className="text-xs text-muted-foreground">fișiere</p>
                </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/50">
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
            templates={templates} 
           />
        )}
      </CardContent>
    </Card>
  );
};

export default DataDashboard;
