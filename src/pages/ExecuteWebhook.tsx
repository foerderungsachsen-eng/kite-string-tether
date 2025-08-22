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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Upload, FileText, Download } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  target_url: string;
  method: string;
  headers: any;
  description?: string;
  is_active: boolean;
}

const ExecuteWebhook = () => {
  const { webhookId } = useParams<{ webhookId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [inputType, setInputType] = useState<'TEXT' | 'FILE'>('TEXT');
  const [textInput, setTextInput] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [tokensBalance, setTokensBalance] = useState<number>(0);

  useEffect(() => {
    if (user && webhookId) {
      fetchWebhook();
      fetchTokenBalance();
    }
  }, [user, webhookId]);

  const fetchWebhook = async () => {
    if (!user || !webhookId) return;

    try {
      // Get webhook (will be filtered by RLS policies)
      const { data: webhookData } = await supabase
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .single();

      if (webhookData) {
        setWebhook(webhookData);
        // Set input type based on webhook headers if available
        if (webhookData.headers?.input_type) {
          setInputType(webhookData.headers.input_type);
        }
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

  const fetchTokenBalance = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('clients')
      .select('tokens_balance')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setTokensBalance(data.tokens_balance);
    }
  };

  const executeWebhook = async () => {
    if (!webhook || !user) return;

    if (tokensBalance <= 0) {
      toast({
        title: "Nicht genügend Tokens",
        description: "Sie haben keine Tokens mehr. Bitte laden Sie Ihr Guthaben auf.",
        variant: "destructive",
      });
      return;
    }

    if (inputType === 'TEXT' && !textInput.trim()) {
      toast({
        title: "Eingabe erforderlich",
        description: "Bitte geben Sie Text ein",
        variant: "destructive",
      });
      return;
    }

    if (inputType === 'FILE' && !fileInput) {
      toast({
        title: "Datei erforderlich",
        description: "Bitte wählen Sie eine Datei aus",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setResponse(null);
    setExecutionError(null);

    try {

      let fileKey: string | null = null;
      let requestBody: any;
      let contentType: string;

      if (inputType === 'TEXT') {
        requestBody = JSON.stringify({ text: textInput });
        contentType = 'application/json';
      } else if (inputType === 'FILE' && fileInput) {
        // Create FormData to send the actual file
        const formData = new FormData();
        formData.append('file', fileInput);
        formData.append('fileName', fileInput.name);
        formData.append('fileSize', fileInput.size.toString());
        formData.append('fileType', fileInput.type);
        
        requestBody = formData;
        contentType = 'multipart/form-data';
        fileKey = `${Date.now()}-${fileInput.name}`;
      }

      const startTime = Date.now();

      // Prepare headers
      const headers: Record<string, string> = { ...webhook.headers };

      // Remove internal metadata from headers before sending
      const { input_type, output_type, ...cleanHeaders } = headers;

      // Set Content-Type only for JSON requests (FormData sets its own Content-Type with boundary)
      if (inputType === 'TEXT') {
        cleanHeaders['Content-Type'] = 'application/json';
      }
      // For FormData, don't set Content-Type - let the browser set it with boundary

      // Make the actual HTTP request to the webhook
      const response = await fetch(webhook.target_url, {
        method: webhook.method,
        headers: cleanHeaders,
        body: requestBody
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();
      let responseData;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Prepare payload for database storage
      let payloadForDb: any;
      if (inputType === 'TEXT') {
        payloadForDb = { text: textInput };
      } else {
        payloadForDb = { 
          fileName: fileInput?.name,
          fileSize: fileInput?.size,
          fileType: fileInput?.type
        };
      }

      // Record the execution in the database
      const { error: executionError } = await supabase
        .from('executions')
        .insert({
          webhook_id: webhook.id,
          request_type: inputType,
          payload: JSON.stringify(payloadForDb),
          file_key: fileKey,
          status: response.ok ? 'SUCCESS' : 'ERROR',
          status_code: response.status,
          response: JSON.stringify(responseData),
          duration_ms: duration,
          tokens_used: 1,
          error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
        });

      if (executionError) {
        console.error('Error recording execution:', executionError);
      }


      if (response.ok) {
        setResponse(responseData);
        toast({
          title: "Webhook erfolgreich ausgeführt",
          description: `Status: ${response.status}`,
        });
      } else {
        setExecutionError(`HTTP ${response.status}: ${response.statusText}`);
        toast({
          title: "Webhook-Fehler",
          description: `Status: ${response.status}`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Execution error:', error);
      setExecutionError(error.message);
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
            <p className="text-muted-foreground">{webhook.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Eingabe
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{webhook.method}</Badge>
                  <Badge variant={webhook.is_active ? "default" : "secondary"}>
                    {webhook.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </div>
              </CardTitle>
              <CardDescription>
                Webhook ID: {webhookId}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Eingabetyp</Label>
                <RadioGroup
                  value={inputType}
                  onValueChange={(value: 'TEXT' | 'FILE') => setInputType(value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="TEXT" id="input-text" />
                    <Label htmlFor="input-text" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Text
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="FILE" id="input-file" />
                    <Label htmlFor="input-file" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Datei
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {inputType === 'TEXT' ? (
                <div className="space-y-2">
                  <Label htmlFor="text-input">Text eingeben</Label>
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
                    onChange={handleFileChange}
                    className="cursor-pointer"
                  />
                  {fileInput && (
                    <div className="text-sm text-muted-foreground">
                      Ausgewählt: {fileInput.name} ({(fileInput.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Token-Guthaben: {tokensBalance}
                </div>
                <Button 
                  onClick={executeWebhook} 
                  disabled={executing || !webhook.is_active || tokensBalance <= 0}
                  className="min-w-[120px]"
                >
                  {executing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Ausführen...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Ausführen
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Response Section */}
          <Card>
            <CardHeader>
              <CardTitle>Antwort</CardTitle>
              <CardDescription>
                Antwort vom Webhook-Endpunkt
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!response && !executionError ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Führen Sie den Webhook aus, um die Antwort zu sehen</p>
                </div>
              ) : executionError ? (
                <div className="space-y-4">
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <h4 className="font-medium text-destructive mb-2">Fehler</h4>
                    <p className="text-sm text-destructive/80">{executionError}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="default">Erfolgreich</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(response, null, 2));
                        toast({ title: "Kopiert", description: "Antwort in Zwischenablage kopiert" });
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Kopieren
                    </Button>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4">
                    <pre className="text-sm overflow-auto max-h-96">
                      {typeof response === 'string' 
                        ? response 
                        : JSON.stringify(response, null, 2)
                      }
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Webhook Details */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook-Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Ziel-URL</Label>
                <p className="font-mono break-all">{webhook.target_url}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Methode</Label>
                <p>{webhook.method}</p>
              </div>
              {webhook.description && (
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">Beschreibung</Label>
                  <p>{webhook.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ExecuteWebhook;