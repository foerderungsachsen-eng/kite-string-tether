import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw } from "lucide-react";

interface Execution {
  id: string;
  webhook_id: string;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  requested_at: string;
  duration_ms: number | null;
  tokens_used: number;
  request_type: 'TEXT' | 'FILE';
  status_code: number | null;
  response: string | null;
  error: string | null;
  webhooks: {
    name: string;
  };
}

const History = () => {
  const { user, isAdmin } = useAuth();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchExecutions();
    }
  }, [user]);

  const fetchExecutions = async () => {
    if (!user) return;

    try {
      if (isAdmin) {
        // Admin can see all executions
        const { data: executionsData } = await supabase
          .from('executions')
          .select(`
            *,
            webhooks (
              name
            )
          `)
          .order('requested_at', { ascending: false })
          .limit(50);

        setExecutions(executionsData || []);
      } else {
        // Get client data first for regular users
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!clientData) {
          setExecutions([]);
          return;
        }

        // Get executions with webhook names for this client
        const { data: executionsData } = await supabase
          .from('executions')
          .select(`
            *,
            webhooks (
              name
            )
          `)
          .eq('client_id', clientData.id)
          .order('requested_at', { ascending: false })
          .limit(50);

        setExecutions(executionsData || []);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast({
        title: "Fehler beim Laden der Historie",
        description: "Die Ausführungshistorie konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'default';
      case 'ERROR':
        return 'destructive';
      case 'TIMEOUT':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'Erfolgreich';
      case 'ERROR':
        return 'Fehler';
      case 'TIMEOUT':
        return 'Timeout';
      default:
        return status;
    }
  };

  const showExecutionDetails = (execution: Execution) => {
    setSelectedExecution(execution);
    setDetailsDialogOpen(true);
  };

  const formatResponse = (response: string | null) => {
    if (!response) return 'Keine Antwort';
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, check if it's binary data
      if (response.includes('\\u0000') || response.includes('��') || /[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(response)) {
        return '[Binäre Datei empfangen - Inhalt kann nicht angezeigt werden]';
      }
      return response;
    }
  };

  const isResponseBinary = (response: string | null) => {
    if (!response) return false;
    return response.includes('\\u0000') || response.includes('��') || /[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(response);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
          <h1 className="text-3xl font-bold tracking-tight">Ausführungshistorie</h1>
          <p className="text-muted-foreground">Übersicht über alle Webhook-Ausführungen</p>
          </div>
          <Button onClick={fetchExecutions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        ) : executions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Keine Ausführungen</CardTitle>
              <CardDescription>
                Es wurden noch keine Webhooks ausgeführt.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            {executions.map((execution) => (
              <Card key={execution.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{execution.webhooks.name}</h3>
                        <Badge variant={getStatusColor(execution.status) as any}>
                          {getStatusText(execution.status)}
                        </Badge>
                        {execution.status_code && (
                          <Badge variant="outline">
                            HTTP {execution.status_code}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {execution.request_type}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {new Date(execution.requested_at).toLocaleString('de-DE')}
                        </span>
                        {execution.duration_ms && (
                          <span>{execution.duration_ms}ms</span>
                        )}
                        <span>{execution.tokens_used} Token verwendet</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => showExecutionDetails(execution)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                  
                  {execution.error && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive font-medium">Fehler:</p>
                      <p className="text-sm text-destructive/80 mt-1">
                        {typeof execution.error === 'string' 
                          ? execution.error 
                          : JSON.stringify(execution.error)
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Execution Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ausführungsdetails</DialogTitle>
              <DialogDescription>
                Details für Webhook: {selectedExecution?.webhooks?.name}
              </DialogDescription>
            </DialogHeader>
            
            {selectedExecution && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="mt-1">
                      <Badge variant={getStatusColor(selectedExecution.status) as any}>
                        {getStatusText(selectedExecution.status)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Ausführungszeit</Label>
                    <p className="mt-1 text-sm">{selectedExecution.duration_ms}ms</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Token verwendet</Label>
                    <p className="mt-1 text-sm">{selectedExecution.tokens_used}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Zeitpunkt</Label>
                    <p className="mt-1 text-sm">
                      {new Date(selectedExecution.requested_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                </div>

                {/* Request Details */}
                <div>
                  <Label className="text-sm font-medium">Anfrage</Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{selectedExecution.request_type}</Badge>
                      {selectedExecution.status_code && (
                        <Badge variant="outline">HTTP {selectedExecution.status_code}</Badge>
                      )}
                    </div>
                    {selectedExecution.payload && (
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(JSON.parse(selectedExecution.payload), null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Response */}
                <div>
                  <Label className="text-sm font-medium">Antwort</Label>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    {isResponseBinary(selectedExecution.response) ? (
                      <div className="text-center py-4">
                        <div className="text-muted-foreground mb-2">
                          📁 Binäre Datei empfangen
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Der Webhook hat eine Datei zurückgegeben. Der Inhalt kann nicht als Text angezeigt werden.
                        </p>
                      </div>
                    ) : (
                      <pre className="text-xs overflow-auto max-h-96">
                        {formatResponse(selectedExecution.response)}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Error Details */}
                {selectedExecution.error && (
                  <div>
                    <Label className="text-sm font-medium text-destructive">Fehlerdetails</Label>
                    <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <pre className="text-xs text-destructive overflow-auto">
                        {selectedExecution.error}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default History;