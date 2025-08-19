import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Play, FileText, Upload, Download } from "lucide-react";


interface Webhook {
  id: string;
  name: string;
  target_url: string;
  method: string;
  headers: any;
  input_type?: string;
  output_type?: string;
}

const ExecuteWebhook = () => {
  const { webhookId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && webhookId) {
      fetchWebhook();
    }
  }, [user, webhookId]);

  const fetchWebhook = async () => {
    if (!user || !webhookId) return;

    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!clientData) return;

      const { data: webhookData } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .eq('client_id', clientData.id)
        .single();

      if (webhookData) {
        setWebhook({
          ...webhookData,
          input_type: webhookData.headers?.input_type || 'TEXT',
          output_type: webhookData.headers?.output_type || 'TEXT'
        });
      }
    } catch (error) {
      console.error('Error fetching webhook:', error);
      toast({
        title: "Fehler",
        description: "Webhook konnte nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeWebhook = async () => {
    if (!webhook || !user) return;

    setExecuting(true);
    setExecutionResult(null);
    setDownloadUrl(null);

    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, tokens_balance')
        .eq('user_id', user.id)
        .single();

      if (!clientData || clientData.tokens_balance < 1) {
        toast({
          title: "Nicht genügend Tokens",
          description: "Sie haben nicht genügend Tokens für diese Ausführung",
          variant: "destructive",
        });
        return;
      }

      let payload = null;
      let fileKey = null;

            title: "Upload-Fehler",
            description: "Datei konnte nicht hochgeladen werden",
            variant: "destructive",
          });
          return;
        }

        fileKey = uploadData.path;
      // Handle input based on type
      if (webhook.input_type === 'FILE') {
        if (!selectedFile) {
          toast({
            title: "Datei erforderlich",
            description: "Bitte wählen Sie eine Datei aus",
            variant: "destructive",
          });
          return;
        }
        
        // For file input, we'll send the file as FormData
        const formData = new FormData();
        formData.append('file', selectedFile);
        payload = formData;
      } else {
        payload = textInput;
      }

      // Create execution record
      const { data: executionData, error: executionError } = await supabase
        .from('executions')
        .insert({
          client_id: clientData.id,
          webhook_id: webhook.id,
          request_type: webhook.input_type as 'TEXT' | 'FILE',
          payload: payload,
          file_key: fileKey,
          status: 'SUCCESS', // This would be determined by actual webhook call
          tokens_used: 1
        })
        .select()
        .single();

      if (executionError) throw executionError;

      // Update token balance
      await supabase
        .from('clients')
        .update({ tokens_balance: clientData.tokens_balance - 1 })
        .eq('id', clientData.id);

      // Actually call the webhook
      let webhookResponse;
      let statusCode = 200;
      let executionStatus: 'SUCCESS' | 'ERROR' | 'TIMEOUT' = 'SUCCESS';
      const startTime = Date.now();
      
      try {
        // Prepare headers
        const headers: Record<string, string> = { ...webhook.headers };
        
        // Remove internal headers that shouldn't be sent to the webhook
        delete headers.input_type;
        delete headers.output_type;
        
        // Set content type based on input type
        let requestBody;
        if (webhook.input_type === 'FILE') {
          // For file uploads, use FormData (don't set Content-Type, let browser set it)
          requestBody = payload;
        } else {
          // For text input, send as JSON
          headers['Content-Type'] = 'application/json';
          requestBody = JSON.stringify({ data: payload });
        }
        
        // Make the actual HTTP request to n8n
        const response = await fetch(webhook.target_url, {
          method: webhook.method,
          headers: headers,
          body: ['GET', 'HEAD'].includes(webhook.method) ? undefined : requestBody,
        });
        
        statusCode = response.status;
        
        // Check if response is a file (binary data)
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        
        if (webhook.output_type === 'FILE' || 
            contentDisposition?.includes('attachment') ||
            (contentType && !contentType.includes('application/json') && !contentType.includes('text/'))) {
        // Make the actual HTTP request to n8n
        const response = await fetch(webhook.target_url, {
          method: webhook.method,
          headers: headers,
          body: ['GET', 'HEAD'].includes(webhook.method) ? undefined : requestBody,
        });
        
        statusCode = response.status;
        
          // Handle file response
          const blob = await response.blob();
          const fileName = getFileNameFromResponse(response) || `download_${Date.now()}`;
          
          // Create download URL
          const url = window.URL.createObjectURL(blob);
          setDownloadUrl(url);
          
          webhookResponse = {
            type: 'file',
            fileName: fileName,
            size: blob.size,
            contentType: contentType || 'application/octet-stream'
          };
        } else {
          // Handle text/JSON response
          if (contentType && contentType.includes('application/json')) {
            webhookResponse = await response.json();
          } else {
            const textResponse = await response.text();
            webhookResponse = { response: textResponse };
          }
        }
        
        if (!response.ok) {
          executionStatus = 'ERROR';
        }
        
      } catch (error: any) {
        console.error('Webhook execution error:', error);
        executionStatus = 'ERROR';
        statusCode = 0;
        webhookResponse = {
          error: error.message,
          type: 'network_error'
        };
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Update execution record with actual results
      await supabase
        .from('executions')
        .update({
          status: executionStatus,
          status_code: statusCode,
          response: JSON.stringify(webhookResponse),
          duration_ms: duration,
          error: executionStatus === 'ERROR' ? JSON.stringify(webhookResponse) : null
        })
        .eq('id', executionData.id);

      setExecutionResult({
        execution: {
          ...executionData,
          status: executionStatus,
          status_code: statusCode,
          duration_ms: duration
        },
        response: webhookResponse
      });

      toast({
        title: executionStatus === 'SUCCESS' ? "Webhook ausgeführt" : "Webhook-Fehler",
        description: executionStatus === 'SUCCESS' 
          ? "Der Webhook wurde erfolgreich ausgeführt"
          : "Fehler beim Ausführen des Webhooks",
        variant: executionStatus === 'SUCCESS' ? 'default' : 'destructive'
      });

    } catch (error: any) {
      toast({
        title: "Ausführungsfehler",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
  };

  const getFileNameFromResponse = (response: Response): string | null => {
    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        return match[1].replace(/['"]/g, '');
      }
    }
    return null;
  };

  const handleDownload = () => {
    if (downloadUrl && executionResult?.response?.fileName) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = executionResult.response.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Webhook nicht gefunden</h2>
          <Button onClick={() => navigate('/webhooks')}>
            Zurück zu Webhooks
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/webhooks')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhook ausführen</h1>
            <p className="text-muted-foreground">Führen Sie "{webhook.name}" aus</p>
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
                <p className="text-sm text-muted-foreground">{webhook.name}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">URL</Label>
                <p className="text-sm text-muted-foreground font-mono break-all">{webhook.target_url}</p>
              </div>
              
              <div className="flex gap-4">
                <div>
                  <Label className="text-sm font-medium">Methode</Label>
                  <Badge variant="outline">{webhook.method}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Input</Label>
                  <Badge variant="secondary">
                    {webhook.input_type === 'FILE' ? <Upload className="w-3 h-3 mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                    {webhook.input_type}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Output</Label>
                  <Badge variant="secondary">
                    {webhook.output_type === 'FILE' ? <Download className="w-3 h-3 mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                    {webhook.output_type}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Execution Form */}
          <Card>
            <CardHeader>
              <CardTitle>Ausführung</CardTitle>
              <CardDescription>
                {webhook.input_type === 'FILE' 
                  ? 'Wählen Sie eine Datei zum Hochladen aus'
                  : 'Geben Sie den Text ein, der gesendet werden soll'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {webhook.input_type === 'FILE' ? (
                <div className="space-y-2">
                  <Label htmlFor="file-input">Datei auswählen</Label>
                  <Input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground">
                      Ausgewählt: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="text-input">Text-Input</Label>
                  <Textarea
                    id="text-input"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Geben Sie hier Ihren Text ein..."
                    rows={6}
                  />
                </div>
              )}

              <Button 
                onClick={executeWebhook} 
                disabled={executing || (webhook.input_type === 'FILE' ? !selectedFile : !textInput.trim())}
                className="w-full"
              >
                <Play className="mr-2 h-4 w-4" />
                {executing ? "Wird ausgeführt..." : "Webhook ausführen"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Execution Result */}
        {executionResult && (
          <Card>
            <CardHeader>
              <CardTitle>Ausführungsergebnis</CardTitle>
              <CardDescription>Antwort vom Webhook</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge 
                    variant={executionResult.execution.status === 'SUCCESS' ? 'default' : 'destructive'} 
                    className="ml-2"
                  >
                    {executionResult.execution.status === 'SUCCESS' ? 'Erfolgreich' : 'Fehler'}
                  </Badge>
                  {executionResult.execution.status_code && (
                    <Badge variant="outline" className="ml-2">
                      HTTP {executionResult.execution.status_code}
                    </Badge>
                  )}
                  {executionResult.execution.duration_ms && (
                    <Badge variant="outline" className="ml-2">
                      {executionResult.execution.duration_ms}ms
                    </Badge>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Antwort von n8n</Label>
                  <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-96">
                    {JSON.stringify(executionResult.response, null, 2)}
                  </pre>
                </div>

                {webhook.output_type === 'FILE' && (
                  <div>
                    <Label className="text-sm font-medium">Output-Datei</Label>
                    {executionResult.response?.type === 'file' && downloadUrl ? (
                      <Button variant="outline" size="sm" className="ml-2" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        {executionResult.response.fileName} herunterladen
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground ml-2">
                        Keine Datei zum Download verfügbar
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ExecuteWebhook;