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
import { ArrowLeft, Play, Upload, Download, FileText } from "lucide-react";

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    if (user && webhookId) {
      fetchWebhook();
      fetchClientData();
    }
  }, [user, webhookId]);

  const fetchClientData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, tokens_balance')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Client data error:', error);
        throw new Error(`Client-Daten konnten nicht geladen werden: ${error.message || 'Unbekannter Fehler'}`);
      }

      setClientData(data);
    } catch (error: any) {
      console.error('Error fetching client data:', error);
      const errorMessage = error?.message || 'Client-Daten konnten nicht geladen werden';
      toast({
        title: "Fehler beim Laden der Client-Daten",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const fetchWebhook = async () => {
    if (!webhookId) return;

    try {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (error) {
        console.error('Webhook loading error:', error);
        throw new Error(`Webhook konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler'}`);
      }

      setWebhook(data);
    } catch (error: any) {
      console.error('Error fetching webhook:', error);
      const errorMessage = error?.message || 'Webhook konnte nicht geladen werden';
      toast({
        title: "Fehler beim Laden des Webhooks",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeWebhook = async () => {
    if (!webhook || !clientData) return;

    const inputType = webhook.headers?.input_type || 'TEXT';
    const outputType = webhook.headers?.output_type || 'TEXT';

    // Validate input based on type
    if (inputType === 'TEXT' && !textInput.trim()) {
      toast({
        title: "Eingabe erforderlich",
        description: "Bitte geben Sie Text ein.",
        variant: "destructive",
      });
      return;
    }

    if (inputType === 'FILE' && !fileInput) {
      toast({
        title: "Datei erforderlich",
        description: "Bitte wählen Sie eine Datei aus.",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setExecutionResult(null);

    try {
      let payload: any = {};
      let requestBody: any;

      if (inputType === 'TEXT') {
        payload = { text: textInput, inputType: 'TEXT', outputType };
        requestBody = JSON.stringify(payload);
      } else {
        // File input
        const formData = new FormData();
        formData.append('file', fileInput!);
        formData.append('inputType', 'FILE');
        formData.append('outputType', outputType);
        formData.append('fileName', fileInput!.name);
        
        payload = { 
          fileName: fileInput!.name, 
          fileSize: fileInput!.size,
          inputType: 'FILE',
          outputType 
        };
        requestBody = formData;
      }

      // Prepare headers
      const headers: any = {
        ...webhook.headers
      };

      // Remove our custom fields from headers
      delete headers.input_type;
      delete headers.output_type;

      // Add Content-Type for JSON requests
      if (inputType === 'TEXT') {
        headers['Content-Type'] = 'application/json';
      }

      const startTime = Date.now();

      // Make the webhook request
      const response = await fetch(webhook.target_url, {
        method: webhook.method,
        headers,
        body: requestBody,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      let responseData: any;
      let isResponseBinary = false;

      if (outputType === 'FILE') {
        // Handle file response
        const blob = await response.blob();
        responseData = await blobToBase64(blob);
        isResponseBinary = true;
      } else {
        // Handle text response
        responseData = await response.text();
        try {
          responseData = JSON.parse(responseData);
        } catch {
          // Keep as text if not JSON
        }
      }

      const executionData = {
        webhook_id: webhook.id,
        client_id: clientData.id,
        status: response.ok ? 'SUCCESS' : 'ERROR',
        status_code: response.status,
        duration_ms: duration,
        tokens_used: 1,
        request_type: inputType,
        payload: JSON.stringify(payload),
        response: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
        requested_at: new Date().toISOString(),
      };

      // Record execution in database
      const { error: executionError } = await supabase
        .from('executions')
        .insert(executionData);

      if (executionError) {
        console.error('Error recording execution:', executionError);
        const errorMessage = executionError?.message || 'Ausführung konnte nicht gespeichert werden';
        throw new Error(`Ausführung konnte nicht gespeichert werden: ${errorMessage}`);
      }

      // Set result for display
      setExecutionResult({
        ...executionData,
        responseData,
        isResponseBinary,
        blob: outputType === 'FILE' ? await fetch(webhook.target_url, {
          method: webhook.method,
          headers,
          body: requestBody,
        }).then(r => r.blob()) : null
      });

      if (response.ok) {
        toast({
          title: "Webhook erfolgreich ausgeführt",
          description: `Antwort erhalten in ${duration}ms`,
        });
      } else {
        toast({
          title: "Webhook-Fehler",
          description: `HTTP ${response.status}: ${response.statusText}`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Webhook execution error:', error);
      const errorMessage = error?.message || 'Webhook konnte nicht ausgeführt werden';
      
      // Record failed execution
      try {
        await supabase
          .from('executions')
          .insert({
            webhook_id: webhook.id,
            client_id: clientData.id,
            status: 'ERROR',
            duration_ms: null,
            tokens_used: 0,
            request_type: inputType,
            payload: JSON.stringify({ text: textInput, inputType, outputType }),
            response: null,
            error: errorMessage,
            requested_at: new Date().toISOString(),
          });
      } catch (recordError: any) {
        console.error('Error recording failed execution:', recordError);
      }

      toast({
        title: "Ausführungsfehler",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]); // Remove data:mime;base64, prefix
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const downloadFile = () => {
    if (!executionResult?.blob) return;

    try {
      const url = URL.createObjectURL(executionResult.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileInput?.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download gestartet",
        description: `Datei ${fileInput?.name || 'download'} wird heruntergeladen.`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      const errorMessage = error?.message || 'Datei konnte nicht heruntergeladen werden';
      toast({
        title: "Download-Fehler",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const formatResponse = (response: any) => {
    if (typeof response === 'string') {
      try {
        return JSON.stringify(JSON.parse(response), null, 2);
      } catch {
        return response;
      }
    }
    return JSON.stringify(response, null, 2);
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
                Der angeforderte Webhook konnte nicht gefunden werden.
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
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{webhook.name}</h1>
            <p className="text-muted-foreground">Webhook ausführen</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle>Eingabe</CardTitle>
              <CardDescription>
                {inputType === 'TEXT' ? 'Geben Sie Text ein' : 'Wählen Sie eine Datei aus'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Input: {inputType}</Badge>
                <Badge variant="outline">Output: {outputType}</Badge>
                <Badge variant={webhook.is_active ? "default" : "secondary"}>
                  {webhook.is_active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </div>

              {inputType === 'TEXT' ? (
                <div className="space-y-2">
                  <Label htmlFor="text-input">Text-Eingabe</Label>
                  <Textarea
                    id="text-input"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Geben Sie hier Ihren Text ein..."
                    rows={6}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="file-input">Datei auswählen</Label>
                  <Input
                    id="file-input"
                    type="file"
                    onChange={(e) => setFileInput(e.target.files?.[0] || null)}
                  />
                  {fileInput && (
                    <div className="text-sm text-muted-foreground">
                      Ausgewählt: {fileInput.name} ({(fileInput.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              )}

              <Button 
                onClick={executeWebhook} 
                disabled={executing || !webhook.is_active}
                className="w-full"
              >
                {executing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ausführen...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Webhook ausführen
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output Section */}
          <Card>
            <CardHeader>
              <CardTitle>Ergebnis</CardTitle>
              <CardDescription>
                Antwort des Webhooks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!executionResult ? (
                <div className="text-center py-8 text-muted-foreground">
                  Führen Sie den Webhook aus, um das Ergebnis zu sehen
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={executionResult.status === 'SUCCESS' ? "default" : "destructive"}>
                      {executionResult.status}
                    </Badge>
                    {executionResult.status_code && (
                      <Badge variant="outline">
                        HTTP {executionResult.status_code}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {executionResult.duration_ms}ms
                    </Badge>
                  </div>

                  {executionResult.isResponseBinary ? (
                    <div className="space-y-4">
                      <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">Datei empfangen</p>
                        <p className="text-sm text-muted-foreground">
                          Der Webhook hat eine Datei zurückgegeben
                        </p>
                      </div>
                      <Button onClick={downloadFile} className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Datei herunterladen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Antwort</Label>
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                        {formatResponse(executionResult.responseData)}
                      </pre>
                    </div>
                  )}

                  {executionResult.error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive font-medium">Fehler:</p>
                      <p className="text-sm text-destructive/80 mt-1">
                        {executionResult.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ExecuteWebhook;