'use client';
import type { FC} from 'react';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import DataTable from './data-table';
import type { ExtractedDataItem, AppSchema, PdfStatus } from '@/lib/types';
import { Download, Filter, Search, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface DataDashboardProps {
  data: ExtractedDataItem[];
  schema: AppSchema;
  onUpdateItem: (item: ExtractedDataItem) => void;
  onExportCsv: () => void;
  isLoading?: boolean; // To show loading state for table/data
}

const DataDashboard: FC<DataDashboardProps> = ({ data, schema, onUpdateItem, onExportCsv, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PdfStatus | 'all'>('all');

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearchTerm = Object.values(item.extractedValues)
        .concat(item.fileName)
        .some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearchTerm && matchesStatus;
    });
  }, [data, searchTerm, statusFilter]);
  
  // Aggregate counts for card display
  const processedCount = useMemo(() => data.filter(item => item.status === 'processed').length, [data]);
  const validationCount = useMemo(() => data.filter(item => item.status === 'needs_validation').length, [data]);
  const errorCount = useMemo(() => data.filter(item => item.status === 'error').length, [data]);


  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl text-primary">Dashboard Date Extrase</CardTitle>
            <CardDescription>Vizualizați, editați și exportați datele extrase din fișierele PDF.</CardDescription>
          </div>
          <Button onClick={onExportCsv} disabled={data.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportă CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <Card className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Procesate cu Succes</CardTitle>
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{processedCount}</div>
                    <p className="text-xs text-green-600 dark:text-green-400">documente</p>
                </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Necesită Validare</CardTitle>
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{validationCount}</div>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">documente</p>
                </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">Erori Procesare</CardTitle>
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-700 dark:text-red-300">{errorCount}</div>
                     <p className="text-xs text-red-600 dark:text-red-400">documente</p>
                </CardContent>
            </Card>
        </div>


        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Caută în date..."
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
        
        {isLoading ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Se încarcă datele...</p>
          </div>
        ) : (
          <DataTable data={filteredData} schema={schema.fields} onUpdateItem={onUpdateItem} />
        )}
      </CardContent>
    </Card>
  );
};

export default DataDashboard;
