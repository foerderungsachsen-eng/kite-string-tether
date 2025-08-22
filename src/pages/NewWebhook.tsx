import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw, Download } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface User {
  user_id: string;
  email: string;
  role: string;
  client_id?: string;
  client_name?: string;
}

interface Execution {
  id: string;
  webhook_id: string;
  client_id: string;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  requested_at: string;
  duration_ms: number | null;
  tokens_used: number;
  request_type: 'TEXT' | 'FILE';
  status_code: number | null;
  response: string | null;
  error: string | null;
  payload: string | null;
  webhooks: {
    name: string;
  };
}

const History = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    url: '',
    headers: '{}',
    input_type: 'TEXT' as 'TEXT' | 'FILE',
    output_type: 'TEXT' as 'TEXT' | 'FILE',
    tokens_cost: 1,
    is_active: true,
    selected_user_id: ''
  });

  useEffect(() => {
    if (user) {
      fetchExecutions();
    }
  }, [user]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
    }
  }, [user, isAdmin]);

  // Redirect non-admin users
  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Zugriff verweigert</h2>
            <p className="text-muted-foreground mb-4">
              Sie haben keine Berechtigung, neue Webhooks zu erstellen.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zum Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      // Get all users with their client information
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          role,
          clients (
            id,
            name
          )
        `)
        .eq('role', 'CLIENT')
        .order('email');

      if (error) throw error;

      // Format users with client info
      const formattedUsers = (usersData || []).map(user => ({
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        client_id: user.clients?.[0]?.id,
        client_name: user.clients?.[0]?.name || user.email.split('@')[0]
      })).filter(user => user.client_id); // Only users with client records

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Fehler beim Laden der Benutzer",
        description: "Die Benutzerliste konnte nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchExecutions = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (isAdmin) {
        // Admin can see all executions
        const { data: executionsData, error } = await supabase
          .from('executions')
          .select(`
            *,
            webhooks (
              name
            )
          `)
          .order('requested_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Admin executions error:', error);
          throw error;
        }

        setExecutions(executionsData || []);
      } else {
        // Get client data first for regular users
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (clientError) {
          console.error('Client data error:', clientError);
          throw clientError;
        }

        if (!clientData) {
          console.log('No client data found for user:', user.id);
          setExecutions([]);
          return;
        }

        // Get executions with webhook names for this client
        const { data: executionsData, error: executionsError } = await supabase
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

        if (executionsError) {
          console.error('Client executions error:', executionsError);
          throw executionsError;
        }

        console.log('Found executions for client:', executionsData?.length || 0);
        setExecutions(executionsData || []);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast({
        title: "Fehler beim Laden der Historie",
        description: error?.message || "Die Ausführungshistorie konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!form.name.trim() || !form.url.trim() || !form.selected_user_id.trim()) {
      toast({
        title: "Felder erforderlich",
        description: "Name, URL und Benutzer sind erforderlich.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Validate headers JSON
      try {
        JSON.parse(form.headers);
      } catch {
        throw new Error('Headers müssen gültiges JSON sein');
      }

      // Find the selected user's client ID
      const selectedUser = users.find(u => u.user_id === form.selected_user_id);
      if (!selectedUser?.client_id) {
        throw new Error('Ausgewählter Benutzer hat keinen Client-Datensatz.');
      }

      const { error } = await supabase
        .from('webhooks')
        .insert({
          name: form.name.trim(),
          description: form.description.trim() || null,
          url: form.url.trim(),
          headers: JSON.parse(form.headers),
          input_type: form.input_type,
          output_type: form.output_type,
          tokens_cost: form.tokens_cost,
          is_active: form.is_active,
          client_id: selectedUser.client_id
        });

      if (error) throw error;

      toast({
        title: "Webhook erstellt",
        description: "Der Webhook wurde erfolgreich erstellt.",
      });

      navigate('/admin/webhooks');
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast({
        title: "Fehler beim Erstellen",
        description: error?.message || "Der Webhook konnte nicht erstellt werden.",
        variant: "destructive"
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

  const downloadBinaryResponse = (execution: Execution) => {
    if (!execution.response) return;
    
    try {
      // Try to parse the response to get the actual binary data
      let binaryData = execution.response;
      
      // If it's JSON wrapped, try to extract
      try {
        const parsed = JSON.parse(execution.response);
        if (typeof parsed === 'string') {
          binaryData = parsed;
        }
      } catch {
        // Use response as is
      }
      
      // Convert the binary string to a Blob
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Get filename from payload if available
      let filename = 'download';
      if (execution.payload) {
        try {
          const payload = JSON.parse(execution.payload);
          if (payload.fileName) {
            filename = payload.fileName;
          }
        } catch {
          // Use default filename
        }
      }
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download gestartet",
        description: `Datei ${filename} wird heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download-Fehler",
        description: "Die Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
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

        <Card>
          <CardHeader>
            <CardTitle>Neuen Webhook erstellen</CardTitle>
            <CardDescription>
              Erstellen Sie einen neuen Webhook für einen Benutzer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="user-select">Benutzer auswählen *</Label>
              <Select 
                value={form.selected_user_id} 
                onValueChange={(value) => setForm(prev => ({ ...prev, selected_user_id: value }))}
                disabled={usersLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Lade Benutzer..." : "Benutzer auswählen"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.email} ({user.client_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Wählen Sie den Benutzer aus, dem dieser Webhook zugewiesen werden soll
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Webhook Name"
                />
              </div>
              <div>
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://api.example.com/webhook"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung des Webhooks..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Input-Typ</Label>
                <Select 
                  value={form.input_type} 
                  onValueChange={(value: 'TEXT' | 'FILE') => setForm(prev => ({ ...prev, input_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="FILE">Datei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Output-Typ</Label>
                <Select 
                  value={form.output_type} 
                  onValueChange={(value: 'TEXT' | 'FILE') => setForm(prev => ({ ...prev, output_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="FILE">Datei</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="tokens">Token-Kosten</Label>
              <Input
                id="tokens"
                type="number"
                min="1"
                value={form.tokens_cost}
                onChange={(e) => setForm(prev => ({ ...prev, tokens_cost: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div>
              <Label htmlFor="headers">HTTP Headers (JSON)</Label>
              <Textarea
                id="headers"
                value={form.headers}
                onChange={(e) => setForm(prev => ({ ...prev, headers: e.target.value }))}
                placeholder='{"Content-Type": "application/json"}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="active">Webhook aktiv</Label>
            </div>

            <div className="flex gap-4">
              <Button onClick={createWebhook} disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Erstelle...
                  </>
                ) : (
                  'Webhook erstellen'
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/webhooks')}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>

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
                      {execution.status === 'SUCCESS' && isResponseBinary(execution.response) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => downloadBinaryResponse(execution)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      )}
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