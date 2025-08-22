import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Download, History, Upload } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  target_url: string;
  method: string;
  description?: string;
  is_active: boolean;
  headers: any;
  client_id: string;
}

const ExecuteWebhook = () => {
  const { webhookId } = useParams<{ webhookId: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [responseBlob, setResponseBlob] = useState<Blob | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (user && webhookId) {
      fetchWebhook();
      if (!isAdmin) {
        fetchClientId();
      }
    }
  }, [user, webhookId, isAdmin]);

  const fetchClientId = async () => {
    if (!user) return;
    
    try {
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Client data error:', error);
        throw new Error(`Client-Daten konnten nicht geladen werden: ${error?.message || 'Unbekannter Fehler'}`);
      }

      if (clientData) {
        setClientId(clientData.id);
      }
    } catch (error: any) {
      console.error('Error fetching client ID:', error);
      toast({
        title: "Fehler beim Laden der Client-Daten",
        description: error?.message || "Client-Daten konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const fetchWebhook = async () => {
    if (!webhookId) return;

    try {
      const { data: webhookData, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (error) {
        console.error('Webhook loading error:', error);
        throw new Error(`Webhook konnte nicht geladen werden: ${error?.message || 'Unbekannter Fehler'}`);
      }

      if (!webhookData) {
        throw new Error('Webhook nicht gefunden');
      }

      // Check if user has access to this webhook
      if (!isAdmin) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        if (!clientData || webhookData.client_id !== clientData.id) {
          throw new Error('Sie haben keine Berechtigung für diesen Webhook');
        }
      }

      setWebhook(webhookData);
    } catch (error: any) {
      console.error('Error fetching webhook:', error);
      toast({
        title: "Fehler beim Laden des Webhooks",
        description: error?.message || "Webhook konnte nicht geladen werden.",
        variant: "destructive",
      });
      navigate('/webhooks');
    } finally {
      setLoading(false);
    }
  };

  const executeWebhook = async () => {
    if (!webhook || !user) return;

    // Determine which client_id to use
    let executionClientId = clientId;
    if (isAdmin && !executionClientId) {
      executionClientId = webhook.client_id;
    }

    if (!executionClientId) {
      toast({
        title: "Fehler",
        description: "Client-ID konnte nicht ermittelt werden.",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setResponse(null);
    setResponseBlob(null);
    setExecutionTime(null);

    const startTime = Date.now();
    let executionData = null;

    try {
      const inputType = webhook.headers?.input_type || 'TEXT';
      const outputType = webhook.headers?.output_type || 'TEXT';
      
      let requestBody;
      let contentType = 'application/json';
      let payload: any = {};

      if (inputType === 'FILE' && fileInput) {
        // For file input, send as FormData
        requestBody = new FormData();
        requestBody.append('file', fileInput);
        requestBody.append('fileName', fileInput.name);
        requestBody.append('fileSize', fileInput.size.toString());
        contentType = 'multipart/form-data';
        
        payload = {
          fileName: fileInput.name,
          fileSize: fileInput.size,
          inputType: 'FILE'
        };
      } else {
        // For text input, send as JSON
        requestBody = JSON.stringify({ 
          text: textInput,
          inputType: 'TEXT'
        });
        payload = {
          text: textInput,
          inputType: 'TEXT'
        };
      }

      // Prepare headers
      const headers: any = {
        ...webhook.headers
      };

      // Only set Content-Type for JSON requests
      if (contentType === 'application/json') {
        headers['Content-Type'] = contentType;
      }

      // Remove our internal fields from headers
      delete headers.input_type;
      delete headers.output_type;

      console.log('Executing webhook:', {
        url: webhook.target_url,
        method: webhook.method,
        headers,
        inputType,
        outputType
      });

      // Execute the webhook
      const response = await fetch(webhook.target_url, {
        method: webhook.method,
        headers,
        body: requestBody,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      setExecutionTime(duration);

      let responseData = null;
      let responseText = null;
      let isSuccess = response.ok;

      if (outputType === 'FILE' && response.ok) {
        // Handle file response
        const blob = await response.blob();
        setResponseBlob(blob);
        responseText = `[Binary File Received - ${blob.size} bytes]`;
        
        toast({
          title: "Datei empfangen",
          description: `Datei wurde erfolgreich empfangen (${Math.round(blob.size / 1024)} KB). Klicken Sie auf Download.`,
        });
      } else {
        // Handle text response
        responseText = await response.text();
        setResponse(responseText);
      }

      // Record execution in database
      executionData = {
        webhook_id: webhook.id,
        client_id: executionClientId,
        status: isSuccess ? 'SUCCESS' : 'ERROR',
        request_type: inputType,
        status_code: response.status,
        duration_ms: duration,
        tokens_used: 1,
        payload: JSON.stringify(payload),
        response: outputType === 'FILE' ? null : responseText, // Don't store binary data
        error: isSuccess ? null : (responseText?.substring(0, 500) || 'Unknown error')
      };

      const { error: dbError } = await supabase
        .from('executions')
        .insert(executionData);

      if (dbError) {
        console.error('Error recording execution:', dbError);
        throw new Error(`Ausführung konnte nicht gespeichert werden: ${dbError?.message || 'Unbekannter Fehler'}`);
      }

      if (isSuccess) {
        toast({
          title: "Webhook erfolgreich ausgeführt",
          description: `Ausführungszeit: ${duration}ms`,
        });
      } else {
        toast({
          title: "Webhook-Fehler",
          description: `HTTP ${response.status}: ${responseText?.substring(0, 100) || 'Unbekannter Fehler'}`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      setExecutionTime(duration);

      console.error('Webhook execution error:', error);

      // Try to record failed execution
      if (executionClientId) {
        try {
          const failedExecutionData = {
            webhook_id: webhook.id,
            client_id: executionClientId,
            status: 'ERROR' as const,
            request_type: webhook.headers?.input_type || 'TEXT',
            duration_ms: duration,
            tokens_used: 0,
            payload: JSON.stringify({
              text: textInput,
              fileName: fileInput?.name,
              inputType: webhook.headers?.input_type || 'TEXT'
            }),
            response: null,
            error: (error?.message || 'Unbekannter Fehler').substring(0, 500)
          };

          await supabase.from('executions').insert(failedExecutionData);
        } catch (dbError) {
          console.error('Error recording failed execution:', dbError);
        }
      }

      toast({
        title: "Ausführungsfehler",
        description: error?.message || "Webhook konnte nicht ausgeführt werden.",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const downloadFile = () => {
    if (!responseBlob) return;

    try {
      const url = URL.createObjectURL(responseBlob);
      const filename = fileInput?.name || 'download';
      
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileInput(file);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!webhook) {
    return (
      <Layout>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Webhook nicht gefunden</CardTitle>
              <CardDescription>
                Der angeforderte Webhook konnte nicht gefunden werden oder Sie haben keine Berechtigung.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/webhooks')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zu Webhooks
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const inputType = webhook.headers?.input_type || 'TEXT';
  const outputType = webhook.headers?.output_type || 'TEXT';

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/webhooks')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zu Webhooks
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/history')}>
            <History className="h-4 w-4 mr-2" />
            Historie anzeigen
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhook ausführen</h1>
            <p className="text-muted-foreground">{webhook.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Webhook Info */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook-Details</CardTitle>
              <CardDescription>Informationen über den Webhook</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-sm">{webhook.name}</p>
              </div>
              
              {webhook.description && (
                <div>
                  <Label className="text-sm font-medium">Beschreibung</Label>
                  <p className="text-sm text-muted-foreground">{webhook.description}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Badge variant={webhook.is_active ? "default" : "secondary"}>
                  {webhook.is_active ? "Aktiv" : "Inaktiv"}
                </Badge>
                <Badge variant="outline">{webhook.method}</Badge>
                <Badge variant="outline">Input: {inputType}</Badge>
                <Badge variant="outline">Output: {outputType}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Execution Form */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook ausführen</CardTitle>
              <CardDescription>
                {inputType === 'FILE' ? 'Datei hochladen und verarbeiten' : 'Text eingeben und verarbeiten'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {inputType === 'FILE' ? (
                <div className="space-y-2">
                  <Label htmlFor="file-input">Datei auswählen</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="file-input"
                      type="file"
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {fileInput && (
                    <p className="text-sm text-muted-foreground">
                      Ausgewählt: {fileInput.name} ({Math.round(fileInput.size / 1024)} KB)
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="text-input">Text eingeben</Label>
                  <Textarea
                    id="text-input"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Geben Sie hier Ihren Text ein..."
                    rows={4}
                  />
                </div>
              )}

              <Button 
                onClick={executeWebhook} 
                disabled={executing || !webhook.is_active || (inputType === 'FILE' ? !fileInput : !textInput.trim())}
                className="w-full"
              >
                {executing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Wird ausgeführt...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Webhook ausführen
                  </>
                )}
              </Button>

              {!webhook.is_active && (
                <p className="text-sm text-destructive">
                  Dieser Webhook ist deaktiviert und kann nicht ausgeführt werden.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {(response || responseBlob || executionTime) && (
          <Card>
            <CardHeader>
              <CardTitle>Ergebnis</CardTitle>
              <CardDescription>
                Antwort des Webhooks
                {executionTime && ` (Ausführungszeit: ${executionTime}ms)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {responseBlob && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Datei empfangen</Label>
                    <Button onClick={downloadFile} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Datei herunterladen ({Math.round(responseBlob.size / 1024)} KB)
                    </Button>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      📁 Binäre Datei empfangen - Klicken Sie auf "Datei herunterladen" um sie zu speichern
                    </p>
                  </div>
                </div>
              )}

              {response && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Antwort</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <pre className="text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                      {response}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ExecuteWebhook;