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
        
        // Upload file to Supabase Storage (you'll need to set up storage bucket)
        const fileName = `${Date.now()}-${selectedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('webhook-files')
          .upload(fileName, selectedFile);

        if (uploadError) {
          toast({
            title: "Upload-Fehler",
            description: "Datei konnte nicht hochgeladen werden",
            variant: "destructive",
          });
          return;
        }

        fileKey = uploadData.path;
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

      // Simulate webhook execution (in real implementation, you'd call the actual webhook)
      const mockResponse = {
        status: 'success',
        message: 'Webhook executed successfully',
        timestamp: new Date().toISOString(),
        data: webhook.input_type === 'FILE' ? 'File processed' : `Processed: ${payload}`
      };

      setExecutionResult({
        execution: executionData,
        response: mockResponse
      });

      toast({
        title: "Webhook ausgeführt",
        description: "Der Webhook wurde erfolgreich ausgeführt",
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
                  <Badge variant="default" className="ml-2">Erfolgreich</Badge>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Antwort</Label>
                  <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto">
                    {JSON.stringify(executionResult.response, null, 2)}
                  </pre>
                </div>

                {webhook.output_type === 'FILE' && (
                  <div>
                    <Label className="text-sm font-medium">Output-Datei</Label>
                    <Button variant="outline" size="sm" className="ml-2">
                      <Download className="w-4 h-4 mr-2" />
                      Datei herunterladen
                    </Button>
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