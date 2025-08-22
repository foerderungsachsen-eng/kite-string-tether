import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Play, Download, FileText, Upload, Coins, Globe, History } from "lucide-react";

interface Webhook {
  id: string;
  name: string;
  description: string | null;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: any;
  input_type: 'TEXT' | 'FILE';
  output_type: 'TEXT' | 'FILE';
  is_active: boolean;
  tokens_cost: number;
  created_at: string;
  client_id: string;
}

const ExecuteWebhook = () => {
  const { webhookId } = useParams<{ webhookId: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    response?: string;
    error?: string;
    downloadBlob?: Blob;
    fileName?: string;
  } | null>(null);
  const [tokensBalance, setTokensBalance] = useState<number>(0);

  useEffect(() => {
    if (user && webhookId) {
      fetchWebhook();
      if (!isAdmin) {
        fetchTokenBalance();
      }
    }
  }, [user, webhookId, isAdmin]);

  const fetchWebhook = async () => {
    if (!user || !webhookId) return;

    setLoading(true);
    try {
      if (isAdmin) {
        // Admin can access any webhook
        const { data: webhookData, error } = await supabase
          .from('webhooks')
          .select('*')
          .eq('id', webhookId)
          .single();

        if (error) {
          console.error('Admin webhook error:', error);
          throw error;
        }

        setWebhook(webhookData);
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
          setWebhook(null);
          return;
        }

        // Get webhook for this client
        const { data: webhookData, error: webhookError } = await supabase
          .from('webhooks')
          .select('*')
          .eq('id', webhookId)
          .eq('client_id', clientData.id)
          .single();

        if (webhookError) {
          console.error('Client webhook error:', webhookError);
          throw webhookError;
        }

        setWebhook(webhookData);
      }
    } catch (error) {
      console.error('Error fetching webhook:', error);
      toast({
        title: "Fehler beim Laden des Webhooks",
        description: (error && typeof error.message === 'string') ? error.message : "Der Webhook konnte nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenBalance = async () => {
    if (!user) return;

    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('tokens_balance')
        .eq('user_id', user.id)
        .single();
      
      if (clientData) {
        setTokensBalance(clientData.tokens_balance);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const executeWebhook = async () => {
    if (!webhook || !user) return;

    // Check token balance for clients
    if (!isAdmin && tokensBalance < webhook.tokens_cost) {
      toast({
        title: "Nicht genügend Tokens",
        description: `Sie benötigen ${webhook.tokens_cost} Token${webhook.tokens_cost !== 1 ? 's' : ''}, haben aber nur ${tokensBalance}.`,
        variant: "destructive",
      });
      return;
    }

    // Validate input
    if (webhook.input_type === 'TEXT' && !textInput.trim()) {
      toast({
        title: "Text erforderlich",
        description: "Bitte geben Sie einen Text ein.",
        variant: "destructive",
      });
      return;
    }

    if (webhook.input_type === 'FILE' && !selectedFile) {
      toast({
        title: "Datei erforderlich",
        description: "Bitte wählen Sie eine Datei aus.",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setResult(null);

    try {
      // Get client data for non-admin users
      let clientId = null;
      if (!isAdmin) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .single();
        clientId = clientData?.id;
      }

      // Prepare the request
      const formData = new FormData();
      let payload: any = {};

      if (webhook.input_type === 'TEXT') {
        formData.append('text', textInput);
        payload = { text: textInput };
      } else if (webhook.input_type === 'FILE' && selectedFile) {
        formData.append('file', selectedFile);
        payload = { fileName: selectedFile.name, fileSize: selectedFile.size };
      }

      // Add headers
      const headers: Record<string, string> = {};
      if (webhook.headers && typeof webhook.headers === 'object') {
        Object.assign(headers, webhook.headers);
      }

      // Execute the webhook
      const startTime = Date.now();
      let response: Response;
      
      if (webhook.method === 'GET') {
        const url = new URL(webhook.url);
        if (webhook.input_type === 'TEXT' && textInput) {
          url.searchParams.append('text', textInput);
        }
        response = await fetch(url.toString(), {
          method: 'GET',
          headers
        });
      } else {
        response = await fetch(webhook.url, {
          method: webhook.method,
          headers,
          body: formData
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      let responseData: string | null = null;
      let downloadBlob: Blob | null = null;
      let fileName = 'download';

      if (response.ok) {
        if (webhook.output_type === 'FILE') {
          // Handle binary response
          downloadBlob = await response.blob();
          
          // Try to get filename from headers
          const contentDisposition = response.headers.get('content-disposition');
          if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (fileNameMatch) {
              fileName = fileNameMatch[1].replace(/['"]/g, '');
            }
          }
          
          // Use original filename if available
          if (selectedFile) {
            fileName = selectedFile.name;
          }
        } else {
          // Handle text response
          responseData = await response.text();
        }

        // Record successful execution
        if (!isAdmin && clientId) {
          try {
            const { error: executionError } = await supabase
              .from('executions')
              .insert({
                webhook_id: webhook.id,
                client_id: clientId,
                status: 'SUCCESS',
                duration_ms: duration,
                tokens_used: webhook.tokens_cost,
                request_type: webhook.input_type,
                status_code: response.status,
                response: webhook.output_type === 'FILE' ? null : responseData,
                payload: JSON.stringify(payload)
              });

            if (executionError) {
              console.error('Error recording execution:', executionError);
            }

            // Deduct tokens on successful execution
            const { error: tokenError } = await supabase
              .from('clients')
              .update({ 
                tokens_balance: tokensBalance - webhook.tokens_cost 
              })
              .eq('id', clientId);

            if (tokenError) {
              console.error('Error deducting tokens:', tokenError);
            } else {
              setTokensBalance(prev => prev - webhook.tokens_cost);
            }
          } catch (recordError) {
            console.error('Error recording execution:', recordError);
          }
        }

        setResult({
          success: true,
          response: responseData,
          downloadBlob: downloadBlob || undefined,
          fileName
        });

        toast({
          title: "Webhook erfolgreich ausgeführt",
          description: !isAdmin ? `${webhook.tokens_cost} Token${webhook.tokens_cost !== 1 ? 's' : ''} verwendet` : "Ausführung erfolgreich",
        });
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Webhook execution error:', error);
      
      const errorMessage = (error && typeof error.message === 'string') ? error.message : "Unbekannter Fehler";
      
      // Record failed execution (no token deduction)
      if (!isAdmin) {
        try {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .single();

          if (clientData) {
            const { error: executionError } = await supabase
              .from('executions')
              .insert({
                webhook_id: webhook.id,
                client_id: clientData.id,
                status: 'ERROR',
                tokens_used: 0, // No tokens used on failure
                request_type: webhook.input_type,
                error: errorMessage.length > 1000 ? errorMessage.substring(0, 1000) + '...' : errorMessage,
                payload: JSON.stringify(payload)
              });

            if (executionError) {
              console.error('Error recording failed execution:', executionError);
            }
          }
        } catch (recordError) {
          console.error('Error recording failed execution:', recordError);
        }
      }

      setResult({
        success: false,
        error: errorMessage
      });

      toast({
        title: "Webhook-Ausführung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const downloadFile = () => {
    if (!result?.downloadBlob) return;

    try {
      const url = URL.createObjectURL(result.downloadBlob);

      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download gestartet",
        description: `Datei ${result.fileName || 'download'} wird heruntergeladen.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download-Fehler",
        description: (error && typeof error.message === 'string') ? error.message : "Die Datei konnte nicht heruntergeladen werden.",
        variant: "destructive",
      });
    }
  };

  const hasInsufficientTokens = !isAdmin && webhook && tokensBalance < webhook.tokens_cost;

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
                Der angeforderte Webhook konnte nicht gefunden werden oder Sie haben keinen Zugriff darauf.
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
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/webhooks')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu Webhooks
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Webhook ausführen</h1>
              <p className="text-muted-foreground">{webhook.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/history')}>
            <History className="h-4 w-4 mr-2" />
            Historie anzeigen
          </Button>
        </div>

        {/* Webhook Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                {webhook.name}
              </CardTitle>
              <Badge variant={webhook.is_active ? "default" : "secondary"}>
                {webhook.is_active ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            {webhook.description && (
              <CardDescription>{webhook.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium">HTTP Methode</Label>
                <Badge variant="outline" className="mt-1">{webhook.method}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">Input Typ</Label>
                <Badge variant="outline" className="mt-1">{webhook.input_type}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">Output Typ</Label>
                <Badge variant="outline" className="mt-1">{webhook.output_type}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">Token-Kosten</Label>
                <div className="flex items-center gap-1 mt-1">
                  <Coins className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{webhook.tokens_cost}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Balance for Clients */}
        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-green-500" />
                Token-Guthaben
              </CardTitle>
              <CardDescription>
                Ihr aktuelles Token-Guthaben
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex